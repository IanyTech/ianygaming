-- Enable Row Level Security
ALTER TABLE IF EXISTS public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing tables if they exist (for idempotency)
DROP TABLE IF EXISTS public.loyalty_transactions;
DROP TABLE IF EXISTS public.loyalty_points;

-- Create loyalty_points table to store user point balances
CREATE TABLE public.loyalty_points (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    points_balance INTEGER NOT NULL DEFAULT 0,
    points_earned_total INTEGER NOT NULL DEFAULT 0,
    points_redeemed_total INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'bronze',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loyalty_transactions table to track all point movements
CREATE TABLE public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for better query performance
CREATE INDEX idx_loyalty_transactions_user_id ON public.loyalty_transactions(user_id);
CREATE INDEX idx_loyalty_transactions_created_at ON public.loyalty_transactions(created_at);
CREATE INDEX idx_loyalty_transactions_reference ON public.loyalty_transactions(reference_type, reference_id);

-- Set up RLS policies for loyalty_points
CREATE POLICY "Users can view their own loyalty points"
    ON public.loyalty_points
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow trigger/function to insert new loyalty_points rows
-- Note: This is needed so the SECURITY DEFINER trigger can create the row even with RLS enabled
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'loyalty_points' 
          AND policyname = 'Allow insert for trigger'
    ) THEN
        CREATE POLICY "Allow insert for trigger"
            ON public.loyalty_points
            FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;

-- Allow trigger/function to update loyalty_points rows
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'loyalty_points' 
          AND policyname = 'Allow update for trigger'
    ) THEN
        CREATE POLICY "Allow update for trigger"
            ON public.loyalty_points
            FOR UPDATE
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Set up RLS policies for loyalty_transactions
CREATE POLICY "Users can view their own loyalty transactions"
    ON public.loyalty_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own loyalty transactions
CREATE POLICY "Users can insert their own loyalty transactions"
    ON public.loyalty_transactions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update points balance
CREATE OR REPLACE FUNCTION public.update_loyalty_points_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update the points balance when a new transaction is inserted
        INSERT INTO public.loyalty_points (user_id, points_balance, points_earned_total, points_redeemed_total, last_updated, tier)
        VALUES (
            NEW.user_id,
            CASE 
                WHEN NEW.transaction_type = 'earn' THEN NEW.points
                WHEN NEW.transaction_type = 'redeem' THEN -NEW.points
                ELSE 0
            END,
            CASE WHEN NEW.transaction_type = 'earn' THEN NEW.points ELSE 0 END,
            CASE WHEN NEW.transaction_type = 'redeem' THEN NEW.points ELSE 0 END,
            NOW(),
            'bronze' -- Default tier, can be updated by another trigger
        )
        ON CONFLICT (user_id) DO UPDATE
        SET 
            points_balance = loyalty_points.points_balance + 
                CASE 
                    WHEN NEW.transaction_type = 'earn' THEN NEW.points
                    WHEN NEW.transaction_type = 'redeem' THEN -NEW.points
                    ELSE 0
                END,
            points_earned_total = loyalty_points.points_earned_total + 
                CASE WHEN NEW.transaction_type = 'earn' THEN NEW.points ELSE 0 END,
            points_redeemed_total = loyalty_points.points_redeemed_total + 
                CASE WHEN NEW.transaction_type = 'redeem' THEN NEW.points ELSE 0 END,
            last_updated = NOW(),
            tier = CASE
                WHEN (loyalty_points.points_balance + 
                    CASE 
                        WHEN NEW.transaction_type = 'earn' THEN NEW.points
                        WHEN NEW.transaction_type = 'redeem' THEN -NEW.points
                        ELSE 0
                    END) >= 5000 THEN 'platinum'
                WHEN (loyalty_points.points_balance + 
                    CASE 
                        WHEN NEW.transaction_type = 'earn' THEN NEW.points
                        WHEN NEW.transaction_type = 'redeem' THEN -NEW.points
                        ELSE 0
                    END) >= 2000 THEN 'gold'
                WHEN (loyalty_points.points_balance + 
                    CASE 
                        WHEN NEW.transaction_type = 'earn' THEN NEW.points
                        WHEN NEW.transaction_type = 'redeem' THEN -NEW.points
                        ELSE 0
                    END) >= 500 THEN 'silver'
                ELSE 'bronze'
            END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reward coupon assignments (track coupons issued from loyalty)
CREATE TABLE IF NOT EXISTS public.loyalty_reward_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL, -- e.g., '10_off' | '15_off' | '20_off'
  discount_percent INT NOT NULL CHECK (discount_percent IN (10,15,20)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used BOOLEAN NOT NULL DEFAULT false
);

-- RLS: user can see their own issued reward coupons
ALTER TABLE public.loyalty_reward_coupons ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_reward_coupons' AND policyname='select_own_reward_coupons'
  ) THEN
    CREATE POLICY select_own_reward_coupons
      ON public.loyalty_reward_coupons
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- RPC: Issue a coupon for a redeemed reward (security definer bypasses RLS on coupons)
CREATE OR REPLACE FUNCTION public.issue_loyalty_reward_coupon(
  p_user_id UUID,
  p_reward_type TEXT,
  p_expires_days INTEGER DEFAULT 30
)
RETURNS TEXT AS $$
DECLARE
  v_percent INT;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Map reward type to percent
  IF p_reward_type = '10_off' THEN v_percent := 10; 
  ELSIF p_reward_type = '15_off' THEN v_percent := 15; 
  ELSIF p_reward_type = '20_off' THEN v_percent := 20; 
  ELSE
    RAISE EXCEPTION 'Unsupported reward type: %', p_reward_type;
  END IF;

  -- Generate unique code
  v_code := upper(replace(gen_random_uuid()::text, '-', '')::text);
  v_code := ('IANY' || v_percent::text || '-' || substr(v_code, 1, 8));

  -- Set expiry
  IF p_expires_days IS NULL OR p_expires_days <= 0 THEN
    v_expires := NULL;
  ELSE
    v_expires := now() + make_interval(days => p_expires_days);
  END IF;

  -- Create coupon definition (percent)
  INSERT INTO public.coupons(code, type, value, active, expires_at)
  VALUES (v_code, 'percent', v_percent, true, v_expires);

  -- Track assignment
  INSERT INTO public.loyalty_reward_coupons(user_id, code, reward_type, discount_percent, expires_at)
  VALUES (p_user_id, v_code, p_reward_type, v_percent, v_expires);

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award points on first review per product (avoid duplicates)
CREATE OR REPLACE FUNCTION public.award_points_on_review()
RETURNS TRIGGER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Grant points only for the first review of a given product by the same user
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.user_id = NEW.user_id AND r.product_id = NEW.product_id AND r.id <> NEW.id
  ) INTO v_exists;

  IF NOT v_exists THEN
    PERFORM public.add_loyalty_points(
      NEW.user_id,
      10,
      'review',
      NEW.product_id,
      jsonb_build_object('reason','Recensione prodotto')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_award_points_on_review ON public.reviews;
CREATE TRIGGER trigger_award_points_on_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.award_points_on_review();

-- Leaderboard: Top users by points (exposes only display-safe fields)
CREATE OR REPLACE FUNCTION public.get_loyalty_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  rank INTEGER,
  user_id UUID,
  name TEXT,
  tier VARCHAR(20),
  points_balance INTEGER
) AS $$
BEGIN
  -- NOTE: Do not join profiles due to RLS restrictions. Provide a generic name.
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY lp.points_balance DESC, lp.last_updated DESC) AS rank,
    lp.user_id,
    'Utente'::text AS name,
    lp.tier,
    lp.points_balance
  FROM public.loyalty_points lp
  ORDER BY lp.points_balance DESC, lp.last_updated DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update points balance
DROP TRIGGER IF EXISTS trigger_update_loyalty_points_balance ON public.loyalty_transactions;
CREATE TRIGGER trigger_update_loyalty_points_balance
AFTER INSERT ON public.loyalty_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_loyalty_points_balance();

-- Function to get user's current points balance
CREATE OR REPLACE FUNCTION public.get_user_points_balance(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT COALESCE(points_balance, 0) INTO balance 
    FROM public.loyalty_points 
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add points to a user's account
CREATE OR REPLACE FUNCTION public.add_loyalty_points(
    p_user_id UUID,
    p_points INTEGER,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id VARCHAR(100) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 365
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
BEGIN
    -- Insert the transaction
    INSERT INTO public.loyalty_transactions (
        user_id,
        points,
        transaction_type,
        reference_type,
        reference_id,
        expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_points,
        'earn',
        p_reference_type,
        p_reference_id,
        CASE WHEN p_expires_in_days > 0 THEN NOW() + (p_expires_in_days || ' days')::INTERVAL ELSE NULL END,
        p_metadata
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem points from a user's account
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
    p_user_id UUID,
    p_points INTEGER,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id VARCHAR(100) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get current balance
    SELECT COALESCE(points_balance, 0) INTO v_balance 
    FROM public.loyalty_points 
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Check if user has enough points
    IF v_balance < p_points THEN
        RAISE EXCEPTION 'Insufficient points balance';
    END IF;
    
    -- Insert the redemption transaction
    INSERT INTO public.loyalty_transactions (
        user_id,
        points,
        transaction_type,
        reference_type,
        reference_id,
        metadata
    ) VALUES (
        p_user_id,
        p_points,
        'redeem',
        p_reference_type,
        p_reference_id,
        p_metadata
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

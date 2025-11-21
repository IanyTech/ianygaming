-- Add preferred_language column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'it';

-- Update RLS policies if needed
-- (Add your RLS policies here if you have any specific ones for the profiles table)

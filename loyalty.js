// Resolve Supabase client safely (prefers global SUPA, then fallbacks)
function getSupaClient() {
  try {
    if (typeof SUPA !== 'undefined' && SUPA) return SUPA;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.supabase) return window.supabase;
  } catch (_) {}
  return null;
}

// Funzione per controllare e assegnare i punti compleanno
async function checkAndAwardBirthdayPoints(userId) {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    const client = getSupaClient();
    if (!client) return;

    // Ottieni il profilo utente con la data di nascita
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('birthdate, last_birthday_points_year')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.birthdate) return;

    const birthDate = new Date(profile.birthdate);
    const birthMonth = birthDate.getMonth() + 1;
    const birthDay = birthDate.getDate();

    // Controlla se oggi è il compleanno e se non ha già ricevuto i punti quest'anno
    if (birthMonth === currentMonth && birthDay === currentDay && 
        profile.last_birthday_points_year !== currentYear) {
      
      // Assegna i punti compleanno (usa metadata per la reason)
      const { error: pointsError } = await client.rpc('add_loyalty_points', {
        p_user_id: userId,
        p_points: 50,
        p_reference_type: 'birthday',
        p_reference_id: null,
        p_metadata: { reason: 'Auguri di Buon Compleanno!' }
      });

      if (!pointsError) {
        // Aggiorna l'anno dell'ultimo premio compleanno
        await client
          .from('profiles')
          .update({ last_birthday_points_year: currentYear })
          .eq('id', userId);
        
        // Mostra notifica all'utente
        showToast('Hai ricevuto 50 punti fedeltà per il tuo compleanno! 🎉', 'success');
      }
    }
  } catch (error) {
    console.error('Errore nel controllo del compleanno:', error);
  }
}

class LoyaltySystem {
  constructor(userId) {
    this.userId = userId;
    this.pointsBalance = 0;
    this.tier = 'bronze';
    this.tiers = {
      bronze: { minPoints: 0, name: 'Bronzo', discount: 0.05 },
      silver: { minPoints: 500, name: 'Argento', discount: 0.07 },
      gold: { minPoints: 2000, name: 'Oro', discount: 0.1 },
      platinum: { minPoints: 5000, name: 'Platino', discount: 0.15 }
    };
    this.transactions = [];
  }

  async init() {
    try {
      const client = getSupaClient();
      if (!client) return false;
      // Controlla e assegna i punti compleanno all'avvio
      if (this.userId) {
        await checkAndAwardBirthdayPoints(this.userId);
      }
      // Load user's loyalty data
      const { data: loyaltyData, error: loyaltyError } = await client
        .from('loyalty_points')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (loyaltyError && loyaltyError.code !== 'PGRST116') {
        console.error('Error loading loyalty data:', loyaltyError);
        return false;
      }

      if (loyaltyData) {
        this.pointsBalance = loyaltyData.points_balance;
        this.tier = loyaltyData.tier;
        // Update UI with loaded data
        this.updateUIBalance();
        this.updateUITier();
      } else {
        // Nessun record ancora: verrà creato automaticamente dal trigger alla prima transazione earn
        this.pointsBalance = 0;
        this.tier = 'bronze';
        this.updateUIBalance();
        this.updateUITier();
      }

      // Load recent transactions
      await this.loadTransactions();
      return true;
      
    } catch (error) {
      console.error('Error initializing loyalty system:', error);
      return false;
    }
  }

  async loadTransactions(limit = 5) {
    try {
      const client = getSupaClient();
      if (!client) return [];
      const { data, error } = await client
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      this.transactions = data || [];
      this.updateUITransactions();
      return this.transactions;
      
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }

  async addPoints(points, reason = 'Punti aggiunti', referenceId = null) {
    try {
      const client = getSupaClient();
      if (!client) return { success: false, error: 'Supabase non inizializzato' };
      const { error } = await client.rpc('add_loyalty_points', {
        p_user_id: this.userId,
        p_points: points,
        p_reference_type: 'manual',
        p_reference_id: referenceId,
        p_metadata: { reason }
      });

      if (error) throw error;

      // Ricarica saldo e tier dal server
      await this.refreshBalance();
      await this.loadTransactions();
      
      return { 
        success: true, 
        newBalance: this.pointsBalance, 
        newTier: this.tier 
      };
      
    } catch (error) {
      console.error('Error adding points:', error);
      return { success: false, error: error.message };
    }
  }

  async redeemPoints(points, reason = 'Riscatto punti', referenceId = null) {
    try {
      const client = getSupaClient();
      if (!client) return { success: false, error: 'Supabase non inizializzato' };
      const { error } = await client.rpc('redeem_loyalty_points', {
        p_user_id: this.userId,
        p_points: points,
        p_reference_type: 'reward',
        p_reference_id: referenceId,
        p_metadata: { reason }
      });

      if (error) throw error;

      await this.refreshBalance();
      await this.loadTransactions();
      return { success: true, newBalance: this.pointsBalance };
      
    } catch (error) {
      console.error('Error redeeming points:', error);
      return { success: false, error: error.message };
    }
  }

  // Ricarica saldo e tier dal server e aggiorna la UI
  async refreshBalance() {
    try {
      const client = getSupaClient();
      if (!client) return;
      const { data, error } = await client
        .from('loyalty_points')
        .select('points_balance, tier')
        .eq('user_id', this.userId)
        .single();
      if (!error && data && (data.points_balance ?? 0) > 0) {
        this.pointsBalance = data.points_balance || 0;
        this.tier = data.tier || 'bronze';
        this.updateUIBalance();
        this.updateUITier();
        return;
      }

      // Fallback: ricalcola dai movimenti se il saldo non è ancora stato aggiornato dal trigger
      const { data: sumRows, error: sumErr } = await client
        .from('loyalty_transactions')
        .select('points, transaction_type')
        .eq('user_id', this.userId);
      if (!sumErr && Array.isArray(sumRows)) {
        const balance = sumRows.reduce((acc, row) => {
          if (row.transaction_type === 'earn') return acc + (row.points || 0);
          if (row.transaction_type === 'redeem') return acc - (row.points || 0);
          return acc;
        }, 0);
        this.pointsBalance = Math.max(0, balance);
        this.updateUIBalance();
        // Tier di fallback in base al saldo calcolato
        this.tier =
          this.pointsBalance >= 5000 ? 'platinum' :
          this.pointsBalance >= 2000 ? 'gold' :
          this.pointsBalance >= 500 ? 'silver' : 'bronze';
        this.updateUITier();
      }
    } catch (_) {}
  }

  getTierInfo() {
    const currentTier = this.tiers[this.tier];
    const tierKeys = Object.keys(this.tiers);
    const currentTierIndex = tierKeys.indexOf(this.tier);
    const nextTier = tierKeys[currentTierIndex + 1];
    
    return {
      currentTier: {
        name: currentTier.name,
        points: this.pointsBalance,
        minPoints: currentTier.minPoints,
        discount: currentTier.discount * 100
      },
      nextTier: nextTier ? {
        name: this.tiers[nextTier].name,
        minPoints: this.tiers[nextTier].minPoints,
        pointsNeeded: this.tiers[nextTier].minPoints - this.pointsBalance
      } : null,
      progress: nextTier 
        ? (this.pointsBalance / this.tiers[nextTier].minPoints) * 100 
        : 100
    };
  }

  // UI Update Methods
  updateUIBalance() {
    const balanceElement = document.getElementById('loyaltyPointsBalance');
    if (balanceElement) balanceElement.textContent = this.pointsBalance;
  }

  updateUITier() {
    const tierInfo = this.getTierInfo();
    const badge = document.getElementById('loyaltyTierBadge');
    const progressFill = document.getElementById('loyaltyProgressBar');
    const nextTierPoints = document.getElementById('nextTierPoints');
    const nextTierHint = document.getElementById('nextTierHint');

    // Badge visual
    if (badge) {
      Object.keys(this.tiers).forEach(t => badge.classList.remove(`tier-${t}`));
      badge.classList.add(`tier-${this.tier}`);
      const iconEl = badge.querySelector('.tier-icon');
      const nameEl = badge.querySelector('.tier-name');
      if (iconEl) iconEl.textContent = this.tier === 'platinum' ? '🏆' : this.tier === 'gold' ? '🥇' : this.tier === 'silver' ? '🥈' : '🥉';
      if (nameEl) nameEl.textContent = tierInfo.currentTier.name;
    }

    // Progress bar and texts
    const pct = Math.min(100, tierInfo.progress);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (nextTierPoints) {
      if (tierInfo.nextTier) nextTierPoints.textContent = `${this.pointsBalance}/${tierInfo.nextTier.minPoints}`;
      else nextTierPoints.textContent = `${this.pointsBalance}`;
    }
    if (nextTierHint) {
      if (tierInfo.nextTier) nextTierHint.textContent = `Mancano ${tierInfo.nextTier.pointsNeeded} punti per il livello ${tierInfo.nextTier.name}`;
      else nextTierHint.textContent = `Hai raggiunto il massimo livello`;
    }

    this.updateTierBenefits();

    // Donut progress (insights)
    try {
      const donut = document.getElementById('donutProgress');
      const donutLabel = document.getElementById('donutLabel');
      const donutHint = document.getElementById('donutHint');
      const pctInt = Math.round(Math.min(100, Math.max(0, tierInfo.progress)));
      if (donut) donut.setAttribute('stroke-dasharray', `${pctInt} ${100 - pctInt}`);
      if (donutLabel) donutLabel.textContent = `${pctInt}%`;
      if (donutHint) {
        if (tierInfo.nextTier) donutHint.textContent = `${this.pointsBalance}/${tierInfo.nextTier.minPoints}`;
        else donutHint.textContent = `${this.pointsBalance}`;
      }
    } catch(_) {}

    // Rank ladder highlight
    try {
      const ladder = document.getElementById('rankLadder');
      if (ladder) {
        const order = ['bronze','silver','gold','platinum'];
        const curIdx = Math.max(0, order.indexOf(this.tier));
        ladder.querySelectorAll('.rank-step').forEach((step, i) => {
          step.classList.toggle('active', i <= curIdx);
          step.classList.toggle('current', i === curIdx);
        });
      }
    } catch(_) {}
  }

  updateTierBenefits() {
    const benefitsList = document.getElementById('tierBenefitsList');
    if (!benefitsList) return;
    
    const tierBenefits = this.getTierBenefits(this.tier);
    benefitsList.innerHTML = tierBenefits.map(benefit => `
      <div class="tier-benefit">
        <i class="fas fa-check-circle"></i>
        <span>${benefit}</span>
      </div>
    `).join('');
  }

  getTierBenefits(tier) {
    const benefits = {
      bronze: [
        '1 punto ogni 1€ speso',
        '5% di sconto su acquisti con punti',
        'Accesso alle offerte esclusive'
      ],
      silver: [
        '1.2 punti ogni 1€ speso',
        '7% di sconto su acquisti con punti',
        'Accesso anticipato ai saldi',
        'Spedizione gratuita sopra 50€'
      ],
      gold: [
        '1.5 punti ogni 1€ speso',
        '10% di sconto su acquisti con punti',
        'Accesso VIP ai nuovi arrivi',
        'Spedizione gratuita sopra 30€',
        'Reso gratuito di 30 giorni'
      ],
      platinum: [
        '2 punti ogni 1€ speso',
        '15% di sconto su acquisti con punti',
        'Accesso in anteprima alle collezioni',
        'Spedizione gratuita illimitata',
        'Reso gratuito di 60 giorni',
        'Assistenza dedicata 24/7',
        'Inviti esclusivi agli eventi'
      ]
    };
    
    // Return all benefits up to and including the current tier
    const result = [];
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const currentTierIndex = tierOrder.indexOf(tier);
    
    for (let i = 0; i <= currentTierIndex; i++) {
      const currentTier = tierOrder[i];
      if (i === currentTierIndex) {
        // For the current tier, show all benefits
        result.push(...benefits[currentTier]);
      } else {
        // For previous tiers, show only the first two benefits
        result.push(...benefits[currentTier].slice(0, 2));
      }
    }
    
    return result;
  }

  updateUITransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    if (this.transactions.length === 0) {
      transactionsList.innerHTML = '<div class="no-transactions">Nessuna transazione recente</div>';
      return;
    }
    
    transactionsList.innerHTML = this.transactions.map(transaction => `
      <div class="transaction-item">
        <div class="transaction-details">
          <span class="transaction-reason">${transaction.reason}</span>
          <span class="transaction-date">${new Date(transaction.created_at).toLocaleDateString()}</span>
        </div>
        <div class="transaction-amount ${transaction.points > 0 ? 'positive' : 'negative'}">
          ${transaction.points > 0 ? '+' : ''}${transaction.points} pts
        </div>
      </div>
    `).join('');
  }
}

// Initialize loyalty system when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const client = getSupaClient();
  if (!client) return;
  
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  // Initialize loyalty system
  window.loyaltySystem = new LoyaltySystem(user.id);
  await window.loyaltySystem.init();

  // Setup event listeners
  const showTiersBtn = document.getElementById('showTiersBtn');
  const modal = document.getElementById('tiersModal');
  const closeBtn = modal?.querySelector('.modal-close');
  
  showTiersBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'block';
  });
  
  closeBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Leaderboard removed: no-op
});

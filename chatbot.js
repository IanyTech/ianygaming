// Chatbot functionality
class IanyChatbot {
  constructor() {
    this.chatbot = document.getElementById('chatbot');
    this.chatbotToggle = document.getElementById('chatbotToggle');
    this.chatbotPanel = document.querySelector('.chatbot-panel');
    this.chatbotMessages = document.getElementById('chatbotMessages');
    this.chatbotForm = document.getElementById('chatbotForm');
    this.chatbotText = document.getElementById('chatbotText');
    this.chatbotReset = document.getElementById('chatbotReset');
    this.chatbotClose = document.getElementById('chatbotClose');
    this.processing = false;
    this.lastSentAt = 0;
    this.context = { lastIntent: null };
    
    // Quick replies and greetings (will be localized via t())
    this.greetings = [
      this.t('chat.greet1', 'Ciao! Come posso aiutarti oggi?'),
      this.t('chat.greet2', 'Salve! Hai bisogno di informazioni su un prodotto?'),
      this.t('chat.greet3', 'Buongiorno! Come posso esserti utile?')
    ];
    
    this.quickReplies = [
      this.t('chat.qr_shipping', 'Quanto costa la spedizione?'),
      this.t('chat.qr_tracking', 'Dov’è il mio ordine? (tracking)'),
      this.t('chat.qr_payments', 'Quali metodi di pagamento accettate?'),
      this.t('chat.qr_returns', 'Come funziona il reso?'),
      this.t('chat.qr_coupons', 'Posso usare un codice sconto?'),
      this.t('chat.qr_loyalty', 'Come funzionano i punti fedeltà?'),
      this.t('chat.qr_search', 'Cercavo un gioco specifico')
    ];
    
    // Ensure the panel starts hidden for a11y and layout
    if (this.chatbotPanel) {
      this.chatbotPanel.hidden = true;
      this.chatbotPanel.removeAttribute('open');
      this.chatbotPanel.style.visibility = 'hidden';
      this.chatbotPanel.style.opacity = '0';
      this.chatbotPanel.style.transform = 'translateY(20px)';
    }

    this.initialize();
    // Restore past conversation
    this.restoreState();
  }

  // Translate helper using global i18n when available
  t(key, fallback) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        const out = window.i18n.t(key);
        // If the library returns the key itself or an empty/falsey value, use fallback
        if (!out || out === key) return fallback;
        return out;
      }
    } catch {}
    return fallback;
  }
  
  initialize() {
    // Show/hide chat panel
    this.chatbotToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleChat();
    });
    
    // Close button
    this.chatbotClose?.addEventListener('click', () => this.hideChat());
    
    // Reset chat
    this.chatbotReset?.addEventListener('click', (e) => {
      e.preventDefault();
      this.resetChat();
    });
    
    // Handle form submission
    this.chatbotForm?.addEventListener('submit', (e) => this.handleSubmit(e));

    // Basic a11y roles
    try {
      if (this.chatbotMessages) {
        this.chatbotMessages.setAttribute('role', 'log');
        this.chatbotMessages.setAttribute('aria-live', 'polite');
        this.chatbotMessages.setAttribute('aria-relevant', 'additions');
      }
    } catch {}

    // Clear quick replies when user types
    this.chatbotText?.addEventListener('input', () => {
      const qr = this.chatbotMessages.querySelector('.quick-replies');
      if (qr) qr.remove();
    });
    
    // Show welcome message if first visit
    if (!localStorage.getItem('chatbotSeen')) {
      setTimeout(() => this.showWelcomeMessage(), 1000);
      localStorage.setItem('chatbotSeen', 'true');
    }
    
    // Auto-hide after 15 seconds of inactivity
    this.inactivityTimer = setTimeout(() => this.hideChat(), 15000);
    
    // Reset inactivity timer on user action
    ['mousemove', 'keypress', 'click'].forEach(evt => {
      document.addEventListener(evt, () => this.resetInactivityTimer());
    });

    // Close on Escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.hideChat();
    });

    // Click outside to close (robust to nodes removed during handlers)
    document.addEventListener('click', (ev) => {
      const isOpen = this.chatbotPanel && this.chatbotPanel.getAttribute('open') !== null;
      if (!isOpen) return;
      const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
      const clickInsidePanel = (path && path.includes(this.chatbotPanel)) || ev.target.closest?.('.chatbot-panel');
      const clickOnToggle = (path && path.some(el => el && el.id === 'chatbotToggle')) || ev.target.closest?.('#chatbotToggle');
      if (!clickInsidePanel && !clickOnToggle) this.hideChat();
    });
  }
  
  toggleChat() {
    const isOpen = this.chatbotPanel.getAttribute('open') !== null;
    if (isOpen) {
      this.hideChat();
    } else {
      this.showChat();
    }
  }
  
  showChat() {
    // reveal and mark open
    this.chatbotPanel.hidden = false;
    this.chatbotPanel.setAttribute('open', '');
    this.chatbotPanel.style.visibility = 'visible';
    this.chatbotPanel.style.opacity = '1';
    this.chatbotPanel.style.transform = 'translateY(0)';
    this.chatbotText.focus();
    this.resetInactivityTimer();
    // ARIA
    if (this.chatbotToggle) this.chatbotToggle.setAttribute('aria-expanded', 'true');
  }
  
  hideChat() {
    this.chatbotPanel.style.opacity = '0';
    this.chatbotPanel.style.transform = 'translateY(20px)';
    this.chatbotPanel.style.visibility = 'hidden';
    this.chatbotPanel.removeAttribute('open');
    // hide after transition to remove from a11y tree
    window.clearTimeout(this._hideT);
    this._hideT = window.setTimeout(() => {
      this.chatbotPanel.hidden = true;
    }, 220);
    // ARIA
    if (this.chatbotToggle) this.chatbotToggle.setAttribute('aria-expanded', 'false');
  }
  
  resetInactivityTimer() {
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => this.hideChat(), 15000);
  }
  
  showWelcomeMessage() {
    this.addBotMessage(this.getRandomGreeting());
    this.showQuickReplies();
  }
  
  showQuickReplies() {
    const replies = this.quickReplies
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    quickReplies.setAttribute('role', 'group');
    
    replies.forEach(reply => {
      const button = document.createElement('button');
      button.className = 'quick-reply';
      button.type = 'button';
      button.textContent = reply;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.userMessage(reply);
        // Defer removal so global click handler sees the original event path
        setTimeout(() => quickReplies.remove(), 0);
        this.processMessage(reply);
      });
      quickReplies.appendChild(button);
    });
    
    this.chatbotMessages.appendChild(quickReplies);
    this.scrollToBottom();
  }
  
  handleSubmit(e) {
    e.preventDefault();
    if (this.processing) return;
    const now = Date.now();
    if (now - this.lastSentAt < 600) return; // simple rate limit
    const message = this.chatbotText.value.trim();
    if (!message) return;

    this.userMessage(message);
    this.chatbotText.value = '';
    this.processMessage(message);
  }
  
  userMessage(message) {
    this.addMessage(message, 'user');
  }
  
  addBotMessage(message) {
    this.addMessage(message, 'bot');
  }
  
  addMessage(message, sender) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'content';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.appendChild(this.linkifyTextNode(message));

    const timeStamp = document.createElement('div');
    timeStamp.className = 'message-time';
    timeStamp.textContent = this.getCurrentTime();

    content.appendChild(bubble);
    content.appendChild(timeStamp);
    wrap.appendChild(avatar);
    wrap.appendChild(content);

    this.chatbotMessages.appendChild(wrap);
    this.scrollToBottom();
    
    // Remove any existing typing indicators
    const typing = this.chatbotMessages.querySelector('.typing-indicator');
    if (typing) typing.remove();

    // Persist message
    this.saveState();
  }

  // Rich bot message (DOM nodes inside bubble)
  addBotRich(nodes) {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'content';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => bubble.appendChild(n));

    const timeStamp = document.createElement('div');
    timeStamp.className = 'message-time';
    timeStamp.textContent = this.getCurrentTime();

    content.appendChild(bubble);
    content.appendChild(timeStamp);
    wrap.appendChild(avatar);
    wrap.appendChild(content);

    this.chatbotMessages.appendChild(wrap);
    this.scrollToBottom();
    this.saveState();
  }
  
  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    this.chatbotMessages.appendChild(typingDiv);
    this.scrollToBottom();
    return typingDiv;
  }
  
  async processMessage(message) {
    this.processing = true;
    this.lastSentAt = Date.now();
    this.setInputDisabled(true);
    // Show typing indicator
    const typing = this.showTypingIndicator();
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      // Simple intent routing
      const lowerMsg = message.toLowerCase();
      let response = null;
      let handled = false;

    const intents = [
      {
        name: 'greeting',
        test: () => /(ciao|salve|buongiorno|buonasera)/.test(lowerMsg),
        run: () => this.getRandomGreeting()
      },
      {
        name: 'shipping',
        test: () => /(spedizion|consegn|tempi|tracking|tracciament)/.test(lowerMsg),
        run: () => "Le spedizioni avvengono entro 24-48h lavorative. In Italia: gratis sopra 50€, altrimenti 4,90€. Consegna stimata 1-3 giorni. Riceverai email di tracking quando l'ordine è spedito."
      },
      {
        name: 'tracking',
        test: () => /(dov[eé]|dove) (si trova|sta)?\s*(il mio )?ordine|tracking|traccia(re)?/.test(lowerMsg),
        run: () => "Puoi seguire lo stato dal link di tracking ricevuto via email dopo la spedizione. Se non trovi l’email, controlla lo spam o scrivici dal modulo Contatti indicando numero ordine."
      },
      {
        name: 'giftcards',
        test: () => /(gift|regal|carta|voucher)/.test(lowerMsg),
        run: () => "Sì, offriamo carte regalo digitali (Steam, PlayStation, Xbox, Nintendo). Le trovi nella sezione Gift Card e arrivano via email subito dopo l'acquisto."
      },
      {
        name: 'returns',
        test: () => /(res|rimborso|restituz|reso)/.test(lowerMsg),
        run: () => "Hai 14 giorni per il reso gratuito. Il rimborso viene emesso entro 14 giorni dalla ricezione. Per iniziare un reso, usa la sezione Contatti."
      },
      {
        name: 'refund_time',
        test: () => /(quanto|quando).*(rimborso|rimbors)/.test(lowerMsg),
        run: () => "Il rimborso viene elaborato entro 14 giorni dalla ricezione del reso o dall’approvazione della richiesta (prodotti digitali esclusi)."
      },
      {
        name: 'search',
        test: () => /(cerca|cerco|trova|gioco|prodotto|cercavo)/.test(lowerMsg),
        run: () => this.searchAndSuggestProducts(lowerMsg)
      },
      {
        name: 'availability',
        test: () => /(disponibil|disponibile|in stock|riassort|arriva|quando arriva)/.test(lowerMsg),
        run: () => "La disponibilità è visibile nella pagina prodotto. Se un articolo è esaurito, puoi attivare una notifica o scriverci per sapere tempi di riassortimento."
      },
      {
        name: 'preorder',
        test: () => /(preord|prenota|uscita|rilascio)/.test(lowerMsg),
        run: () => "I preordini vengono evasi appena il prodotto è disponibile. Ti avviseremo per email alla spedizione."
      },
      {
        name: 'payments',
        test: () => /(pagament|metodi|pay|paypal|carta|bonifico|klarna|scalapay)/.test(lowerMsg),
        run: () => "Accettiamo carte (Visa/Mastercard), PayPal e altri metodi popolari. I pagamenti sono processati in modo sicuro con provider certificati."
      },
      {
        name: 'invoice_vat',
        test: () => /(fattur|partita iva|p\.iva|iva)/.test(lowerMsg),
        run: () => "Per fattura con Partita IVA, inserisci i dati in checkout o contattaci con numero ordine e dati fiscali."
      },
      {
        name: 'coupons',
        test: () => /(coupon|codice sconto|sconto|promo|promozione)/.test(lowerMsg),
        run: () => "Puoi inserire il codice sconto in checkout. Se non funziona, verifica validità e requisiti minimi."
      },
      {
        name: 'loyalty_points',
        test: () => /(punti|fedelt|loyalty|premi|ricompens)/.test(lowerMsg),
        run: () => "Accumuli punti su ogni acquisto e puoi usarli per sconti futuri. Bonus compleanno disponibili se la data è presente nel profilo."
      },
      {
        name: 'digital_delivery',
        test: () => /(digitale|codice|key|chiave|consegna email)/.test(lowerMsg),
        run: () => "I prodotti digitali vengono inviati via email immediatamente dopo la conferma del pagamento. Controlla anche la cartella spam."
      },
      {
        name: 'region_lock',
        test: () => /(region|blocc|locked|regione)/.test(lowerMsg),
        run: () => "Alcune key possono essere vincolate a una regione. Controlla le note nella pagina prodotto prima dell’acquisto."
      },
      {
        name: 'compatibility',
        test: () => /(compatibilit|piattaforma|platform|pc|ps|xbox|switch)/.test(lowerMsg),
        run: () => "Verifica sempre la piattaforma indicata (PC/Steam, PlayStation, Xbox, Nintendo). Se hai dubbi, indicaci il titolo e la piattaforma."
      },
      {
        name: 'age_rating',
        test: () => /(pegi|et[aà]|classificazione)/.test(lowerMsg),
        run: () => "Controlla la classificazione PEGI nella pagina prodotto per età consigliata e contenuti."
      },
      {
        name: 'warranty',
        test: () => /(garanzi|difett|riparaz)/.test(lowerMsg),
        run: () => "I prodotti fisici sono coperti da garanzia legale. In caso di difetto, contattaci con numero ordine e descrizione del problema."
      },
      {
        name: 'account_login',
        test: () => /(login|acced|access|password|reset|recuper)/.test(lowerMsg),
        run: () => "Se non riesci ad accedere, usa la funzione di reset password dalla pagina di accesso. Se persiste, contattaci."
      },
      {
        name: 'languages',
        test: () => /(lingua|italiano|inglese|language|translate|traduz)/.test(lowerMsg),
        run: () => "Lo store supporta Italiano e Inglese. Puoi cambiare lingua dall’interfaccia e verrà salvata come preferenza nel profilo."
      },
      {
        name: 'security',
        test: () => /(sicurezz|privacy|dati|protezione)/.test(lowerMsg),
        run: () => "Proteggiamo i pagamenti con provider certificati e trattiamo i dati secondo normativa privacy."
      },
      {
        name: 'support_hours',
        test: () => /(orari|assistenza|disponibilit[aà] supporto|quando rispondete)/.test(lowerMsg),
        run: () => "Siamo online 7 giorni su 7. Per richieste, usa il modulo Contatti: rispondiamo solitamente entro 24 ore."
      },
      {
        name: 'order_modify_cancel',
        test: () => /(modific|cancell|annulla|cambia).*ordine/.test(lowerMsg),
        run: () => "Se l’ordine non è stato spedito, possiamo modificarlo o annullarlo: contattaci subito con il numero ordine."
      },
      {
        name: 'international',
        test: () => /(internaz|estero|eu|europe|world|mondo)/.test(lowerMsg),
        run: () => "Le spedizioni internazionali possono variare per costi e tempi. Scrivici la destinazione per una stima precisa."
      },
      {
        name: 'contact',
        test: () => /(contatt|assistenza|supporto)/.test(lowerMsg),
        run: () => "Puoi contattarci dalla sezione Contatti del sito. In alternativa, lascia qui il tuo indirizzo email e ti ricontattiamo al più presto."
      }
    ];

      for (const it of intents) {
        if (it.test()) {
          this.context.lastIntent = it.name;
          const out = it.run();
          if (out instanceof Node || Array.isArray(out)) {
            this.addBotRich(out);
          } else if (typeof out === 'string' && out) {
            response = out;
            this.addBotMessage(response);
          }
          handled = true;
          break;
        }
      }

      if (!handled) {
        response = "Mi dispiace, non ho capito. Puoi riformulare la domanda?";
        this.addBotMessage(response);
      }
      
      // Show quick replies after bot response
      if (Math.random() > 0.5) setTimeout(() => this.showQuickReplies(), 500);
    } finally {
      // Ensure typing indicator removed and input restored even on errors
      try { typing.remove(); } catch {}
      this.setInputDisabled(false);
      this.processing = false;
    }
  }
  
  resetChat() {
    this.chatbotMessages.innerHTML = '';
    this.addBotMessage(this.t('chat.reset', 'La conversazione è stata riavviata. Come posso aiutarti?'));
    this.showQuickReplies();
    this.saveState();
  }
  
  getRandomGreeting() {
    return this.greetings[Math.floor(Math.random() * this.greetings.length)];
  }
  
  getCurrentTime() {
    return new Date().toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }
  
  scrollToBottom() {
    // schedule to ensure DOM painted
    requestAnimationFrame(() => {
      if (!this.chatbotMessages) return;
      this.chatbotMessages.scrollTop = this.chatbotMessages.scrollHeight;
    });
  }

  setInputDisabled(disabled) {
    try {
      const btn = this.chatbotForm?.querySelector('button[type="submit"], .btn');
      this.chatbotText.disabled = !!disabled;
      if (btn) {
        btn.disabled = !!disabled;
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      }
    } catch {}
  }

  // Turn plain text into node with linkified URLs
  linkifyTextNode(text) {
    const span = document.createElement('span');
    const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
    parts.forEach(part => {
      if (/^https?:\/\//.test(part)) {
        const a = document.createElement('a');
        a.href = part;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = part;
        span.appendChild(a);
      } else if (part) {
        span.appendChild(document.createTextNode(part));
      }
    });
    return span;
  }

  // Search products using global arrays if present
  searchAndSuggestProducts(query) {
    try {
      const source = [ ...(Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []), ...(Array.isArray(window.OFFERS) ? window.OFFERS : []) ];
      if (!source.length) return "Puoi usare la barra di ricerca in alto. Dimmi il titolo e ti aiuto a verificarne la disponibilità.";
      const q = String(query).toLowerCase().replace(/(cerca|cerco|trova|gioco|prodotto|cercavo)/g, '').trim();
      const results = source
        .filter(p => (p?.name || '').toLowerCase().includes(q) || (p?.platform || '').toLowerCase().includes(q))
        .slice(0, 3);
      if (!results.length) return "Non ho trovato corrispondenze immediate. Vuoi dirmi il titolo esatto o una piattaforma (es. Steam, PS, Xbox)?";

      const frag = document.createDocumentFragment();
      const title = document.createElement('div');
      title.textContent = 'Ho trovato questi suggerimenti:';
      frag.appendChild(title);

      results.forEach(p => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr auto';
        row.style.gap = '8px';

        const name = document.createElement('div');
        name.textContent = `${p.name} ${p.platform ? '(' + p.platform + ')' : ''}`;
        const btn = document.createElement('button');
        btn.className = 'btn ghost';
        btn.textContent = 'Dettagli';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          try { window.openProductModal && window.openProductModal(p.id); } catch {}
        });
        row.appendChild(name);
        row.appendChild(btn);
        frag.appendChild(row);
      });

      return frag;
    } catch {
      return "Certo! Dimmi il titolo del gioco o la piattaforma e ti aiuto a cercarlo.";
    }
  }

  // Save/restore conversation state
  saveState() {
    try {
      const msgs = Array.from(this.chatbotMessages.querySelectorAll('.msg'))
        .map(node => ({
          sender: node.classList.contains('user') ? 'user' : 'bot',
          text: node.querySelector('.bubble')?.textContent || ''
        }));
      localStorage.setItem('iany_chat_state', JSON.stringify(msgs));
    } catch {}
  }

  restoreState() {
    try {
      const raw = localStorage.getItem('iany_chat_state');
      if (!raw) return;
      const msgs = JSON.parse(raw);
      if (!Array.isArray(msgs) || !msgs.length) return;
      this.chatbotMessages.innerHTML = '';
      msgs.forEach(m => this.addMessage(m.text, m.sender === 'user' ? 'user' : 'bot'));
    } catch {}
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if elements exist
  if (document.getElementById('chatbot')) {
    window.ianyChatbot = new IanyChatbot();
  }
});

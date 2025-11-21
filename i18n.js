// File di traduzione
const translations = {
  it: {
    // Auth Page
    welcome: "Benvenuto su Iany Gaming",
    welcomeSubtitle: "Crea un account o accedi per esperienze e vantaggi esclusivi",
    login: "Accedi",
    register: "Registrati",
    name: "Nome",
    namePlaceholder: "Il tuo nome",
    email: "Email",
    emailPlaceholder: "tu@esempio.com",
    phone: "Numero di telefono",
    phonePlaceholder: "Il tuo numero",
    password: "Password",
    passwordPlaceholder: "Min 8 caratteri",
    confirmPassword: "Conferma Password",
    confirmPasswordPlaceholder: "Ripeti la password",
    birthday: "Data di nascita",
    birthdayHint: "Devi avere almeno 16 anni per registrarti",
    minAge16: "Per registrarti devi avere almeno 16 anni",
    birthdateInvalid: "Data di nascita non valida",
    language: "Lingua",
    terms: "Accetto i Termini e Condizioni e l'Informativa sulla Privacy",
    profile_save_note: "Nome, telefono e data di nascita verranno salvati nel tuo profilo dopo la conferma email e il primo accesso.",
 
    createAccount: "Crea account",
    submit: "Invia",
    forgotPassword: "Password dimenticata?",
    backToShop: "Torna allo Shop",
    // Shop
    shopNow: "Acquista ora",
    viewDetails: "Dettagli",
    addToCart: "Aggiungi al carrello",
    price: "Prezzo",
    quantity: "Quantità",
    // Navigation
    home: "Home",
    shop: "Negozio",
    account: "Account",
    logout: "Esci",
    // Common
    loading: "Caricamento...",
    error: "Errore",
    success: "Successo",
    close: "Chiudi",
    // Validation
    requiredField: "Questo campo è obbligatorio",
    invalidEmail: "Inserisci un'email valida",
    passwordMismatch: "Le password non corrispondono",
    passwordTooShort: "La password deve essere lunga almeno 8 caratteri",
    // Saved Accounts (Account -> Sessione)
    saved_accounts_title: "Account salvati",
    saved_accounts_empty: "Nessun account salvato.",
    saved_accounts_add_summary: "Aggiungi un altro account",
    label_email: "Email",
    label_password: "Password",
    action_add: "Aggiungi",
    action_use: "Usa",
    action_remove: "Rimuovi",
    saved_accounts_note: "L'account verrà salvato per consentire uno switch rapido senza re-inserire le credenziali. I token verranno memorizzati in questo dispositivo.",
    msg_enter_email_password: "Inserisci email e password.",
    msg_auth_unavailable: "Autenticazione non disponibile offline.",
    msg_checking_credentials: "Verifica credenziali...",
    msg_account_added: "Account aggiunto. Puoi passare da un account all'altro dall'elenco.",
    msg_add_error: "Credenziali non valide o errore di rete.",
    session_status_active: "Attivo",
    session_switched_to: "Sei passato a",
    // Reviews
    review_points_note: "Per ottenere i 10 punti fedeltà, effettua l'accesso e invia la tua prima recensione per questo prodotto."
  },
  en: {
    // Auth Page
    welcome: "IanyGaming Shop",
    welcomeSubtitle: "Create an account or log in for exclusive experiences and benefits",
    login: "Log In",
    register: "Register",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@example.com",
    phone: "Phone number",
    phonePlaceholder: "Your phone number",
    password: "Password",
    passwordPlaceholder: "Min 8 characters",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Repeat your password",
    birthday: "Date of Birth",
    birthdayHint: "You must be at least 16 years old to register",
    minAge16: "You must be at least 16 years old to register",
    birthdateInvalid: "Invalid date of birth",
    language: "Language",
    terms: "I accept the Terms and Conditions and Privacy Policy",
    termsLink: "(read more)",
    profile_save_note: "Name, phone and birthdate will be saved to your profile after email confirmation and first login.",
    createAccount: "Create Account",
    submit: "Submit",
    forgotPassword: "Forgot Password?",
    backToShop: "Back to Shop",
    // Shop
    shopNow: "Shop Now",
    viewDetails: "View Details",
    addToCart: "Add to Cart",
    price: "Price",
    quantity: "Quantity",
    // Navigation
    home: "Home",
    shop: "Shop",
    account: "Account",
    logout: "Logout",
    // Common
    loading: "Loading...",
    error: "Error",
    success: "Success",
    close: "Close",
    // Validation
    requiredField: "This field is required",
    invalidEmail: "Please enter a valid email address",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 8 characters long",
    // Saved Accounts (Account -> Session)
    saved_accounts_title: "Saved accounts",
    saved_accounts_empty: "No saved accounts.",
    saved_accounts_add_summary: "Add another account",
    label_email: "Email",
    label_password: "Password",
    action_add: "Add",
    action_use: "Use",
    action_remove: "Remove",
    saved_accounts_note: "The account will be saved to allow quick switching without re-entering credentials. Tokens will be stored on this device.",
    msg_enter_email_password: "Enter email and password.",
    msg_auth_unavailable: "Authentication not available offline.",
    msg_checking_credentials: "Checking credentials...",
    msg_account_added: "Account added. You can switch between accounts from the list.",
    msg_add_error: "Invalid credentials or network error.",
    session_status_active: "Active",
    session_switched_to: "Switched to",
    // Reviews
    review_points_note: "To earn 10 loyalty points, please log in and submit your first review for this product."
  }
};

let currentLanguage = 'it'; // Default language

// Function to set the language
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    document.documentElement.lang = lang;
    updateUI();
    // Save preference to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('preferredLanguage', lang);
    }
    return true;
  }
  return false;
}

// Function to get translation
function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

// Function to update UI elements with translations
function updateUI() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    
    const translatedText = t(key);
    
    if (element.placeholder !== undefined) {
      element.placeholder = translatedText;
    } else if (element.value && !element.getAttribute('data-keep-value')) {
      // Only update value if it's not a form element with user input
      // or if it doesn't have data-keep-value attribute
      element.value = translatedText;
    } else if (element.tagName === 'INPUT' && element.type === 'submit') {
      element.value = translatedText;
    } else {
      // For other elements, update text content
      element.textContent = translatedText;
    }
    
    // Update title attribute if present
    if (element.title) {
      element.title = translatedText;
    }
    
    // Update aria-label if present
    if (element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', translatedText);
    }
  });
  
  // Update all elements with data-i18n-placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key) {
      element.placeholder = t(key);
    }
  });
  
  // Update page title and other special cases
  const pageTitle = document.querySelector('title');
  if (pageTitle) {
    pageTitle.textContent = t('welcome');
  }
  
  // Update HTML lang attribute
  document.documentElement.lang = currentLanguage;
  
  // Trigger a custom event when language changes
  const event = new CustomEvent('languageChanged', { detail: { language: currentLanguage } });
  document.dispatchEvent(event);
}

// Initialize i18n when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Try to get language from localStorage or browser settings
  const savedLanguage = localStorage?.getItem('preferredLanguage');
  const browserLanguage = navigator.language.split('-')[0];
  
  // Set language with fallback chain: saved > browser > default (it)
  setLanguage(savedLanguage || (translations[browserLanguage] ? browserLanguage : 'it'));
  
  // Update UI with translations
  updateUI();
});

// Function to get current language
function getCurrentLanguage() {
  return currentLanguage;
}

// Function to get available languages
function getAvailableLanguages() {
  return Object.keys(translations);
}

// Make functions available globally
window.i18n = {
  t,
  setLanguage,
  getCurrentLanguage,
  getAvailableLanguages,
  currentLanguage: () => currentLanguage // For backward compatibility
};

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    t,
    setLanguage,
    getCurrentLanguage,
    getAvailableLanguages,
    currentLanguage: getCurrentLanguage
  };
}

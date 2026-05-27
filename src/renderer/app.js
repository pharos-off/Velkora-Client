const { ipcRenderer } = require('electron');
const LauncherFeatures = require('./features.js');
const ModsManager = require('./ModsManager.js');
const UIFeedback = require('./ui-feedback.js');
const LauncherVersion = require('../main/launcher-version.js');
const KeyboardShortcuts = require('../main/keyboard-shortcuts.js');
const { icons: lucideIcons } = require('./lucide-icons');
const ThemeManager = require('./theme-manager.js');
//const MusicPlayer = require('./radio-player.js');

// ✅ STUB GLOBAL POUR ÉVITER LES ERREURS DE TIMING
window.themeManager = null; // Sera initialisé après DOM ready
window.app = {
  render: () => console.warn('⚠️ app.render called before initialization'),
  currentView: 'login',
  showNewsDetail: (id) => console.warn('⚠️ showNewsDetail called before initialization', id),
  launchGame: (ip) => console.warn('⚠️ launchGame called before initialization', ip),
  themeManager: null
};

// Icônes SVG inline
const icons = {
  radio: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 12 2-2-2-2"/><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M15 7V4"/><path d="M9 12h6"/><circle cx="7.5" cy="12" r="0.5"/><circle cx="10.5" cy="12" r="0.5"/></svg>',
  play: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  user: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  handshake: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 18a2 2 0 1 0 3 0 2 2 0 0 0-3 0Z"/><path d="M8 18a2 2 0 1 0 3 0 2 2 0 0 0-3 0Z"/><path d="m9 13-1 8"/><path d="m15 13 1 8"/><path d="m9 13-.753-6.374A2 2 0 0 1 10.185 5h3.63a2 2 0 0 1 1.938 1.626l-.753 6.374"/><path d="M11 11h2"/><path d="M6 11h2"/><path d="M4 7c0-1 1-2 2-2h.5a3 3 0 0 1 2 .88M18 7c0-1-1-2-2-2h-.5a3 3 0 0 0-2 .88"/></svg>',
  newspaper: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  shoppingCart: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  rocket: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c-1.1 0-2 .9-2 2 0 1.6 1.9 4 2 4s2.4-2.4 2.4-4c0-1.1-.9-2-2.4-2z"/><path d="M6 19c0-3.1 2.5-5.6 5.6-5.6S17.2 15.9 17.2 19c0 .6-.8 1.6-2.4 1.6-1.1 0-2-.9-2-2s-.9-2-2-2c-1.6 0-2.4 1-2.4 1.6z"/><path d="M12 6.5C8.5 6.5 5.8 9.2 5.8 12.7c0 1.7.7 3.4 1.7 4.6l1.7-1.7c.6-.6 1.6-.6 2.2 0l1.7 1.7c1-1.3 1.7-2.9 1.7-4.6C18.2 9.2 15.5 6.5 12 6.5z"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  chevronLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  image: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><circle cx="8" cy="10" r="2"/><path d="M21 15l-5-5-4 4-3-3-5 5"/></svg>',
  archive: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16v4H4z"/><path d="M4 11v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M10 15h4"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  logOut: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  messageSquare: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  harddrive: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5"/><rect x="2" y="3" width="20" height="8" rx="1" ry="1"/></svg>',
  crown: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2h1M6 4h12M5 7h14M8 10h8M7 14h10M9 18h6"/></svg>`,
  star: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 10.26 24 10.5 18 16.6 20.29 25.5 12 20.92 3.71 25.5 6 16.6 0 10.5 8.91 10.26 12 2"/></polygon></svg>`,
  volume: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a7 7 0 0 1 0 9.9M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  leaf: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 22c7.333 0 11-3.667 11-11S18.333 0 11 0 0 3.667 0 11s3.667 11 11 11z"/></svg>`,
  heart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  clipboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  barChart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  mods: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  help: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  tool: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 0-8.94-8.94l-2.83 2.83a1 1 0 0 0 0 1.4l1.6 1.6"/><path d="M9.3 17.7a1 1 0 0 0 0-1.4L7.7 14.7a1 1 0 0 0-1.4 0l-3.77 3.77a6 6 0 0 0 8.94 8.94l2.83-2.83a1 1 0 0 0 0-1.4l-1.6-1.6"/></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  palette: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`,
  pin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"/></svg>`,
};


class CraftLauncherApp {
  constructor() {
    // ✅ Initialiser le gestionnaire de thème en premier
    window.themeManager = new ThemeManager();
    
    this.currentView = 'login';
    this.authData = null;
    this.profiles = [];
    this.selectedProfile = null;
    this.settings = {};
    this.maxRam = 16;
    this.friends = [];
    this.news = [];
    this.showAddFriend = false;
    this.listeners = new Map();
    this.playerHead = null;
    this.isLaunching = false; // ✅ Flag pour éviter les doubles lancements
    this.selectedLaunchLoader = 'vanilla';
    this.viewChangeListener = null; // ✅ Référence du listener pour cleanup
    this.globalMusicPlayer = null; // ✅ Instance globale du lecteur de musique
    this.ui = new UIFeedback({ namespace: 'main-app-ui' });
    this.ui.installStyles();
    this.installUIFeedbackBridge();
    this.applyInterfaceOptions();
    this.modsManager = new ModsManager(this);
    this.loadingScreenHidden = false;
    this.deferredDataPromise = null;
    this.shortcuts = new KeyboardShortcuts(this);
    this.newsCategoryFilter = 'all';
    
    // ✅ Utiliser le gestionnaire de thème au lieu de dupliquer les données
    this.themePresets = window.themeManager.themePresets;
    this.accentColors = window.themeManager.accentColors;
    
    // ✅ Écouter les changements de thème du gestionnaire global
    window.themeManager.onThemeChange((theme, accent) => {
      this.applyThemeSelection(theme, true);
      this.applyAccentColor(accent, true);
    });

    this.fallbackAvatar = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="20" ry="20" fill="#1e293b"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="48" fill="#94a3b8">👤</text></svg>');

    this.popularServers = [
      { name: 'Hypixel', ip: 'mc.hypixel.net', description: 'Le plus grand serveur Minecraft', players: '—', icon: 'https://hypixel.net/favicon.ico' },
      { name: 'CubeCraft', ip: 'play.cubecraft.net', description: 'Mini-jeux et modes de jeu', players: '—', icon: 'https://www.google.com/s2/favicons?domain=cubecraft.net&sz=256' },
      { name: 'BlocksMC', ip: 'play.blocksmc.com', description: 'BedWars, SkyWars', players: '—', icon: 'https://www.google.com/s2/favicons?domain=blocksmc.com&sz=256' },
      { name: 'Minehut', ip: 'play.minehut.com', description: 'Réseau de serveurs', players: '—', icon: 'https://minehut.com/favicon.ico' },
    ];
    this.init();
  }

  installUIFeedbackBridge() {
    window.alert = (message) => {
      const normalizedMessage = this.ui.normalizeMessage(message);
      const type = this.ui.inferType(message);
      const defaultTitle = {
        success: 'Operation terminee',
        error: 'Action impossible',
        info: 'Information'
      };

      this.ui.showDialog({
        title: defaultTitle[type] || defaultTitle.info,
        message: normalizedMessage,
        type
      });
    };
  }

  /**
   * ✅ Applique le thème sélectionné
   */
  applyThemeSelection(theme, skipManagerUpdate = false) {
    const currentTheme = window.themeManager?.currentTheme;
    if (!skipManagerUpdate && window.themeManager && currentTheme !== theme) {
      window.themeManager.setTheme(theme);
    }
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // 🎨 Appliquer automatiquement l'accent recommandé pour chaque thème
    const themeAccentMap = {
      dark: 'indigo',
      light: 'blue',
      neon: 'cyan',
      metro: 'purple'
    };
    const recommendedAccent = themeAccentMap[theme] || 'indigo';
    this.applyAccentColor(recommendedAccent);
    
    this.applyThemePalette(theme);
    console.log(`[Theme] Applied: ${theme}`, window.themeManager?.getConsoleStyles());
  }

  applyThemePalette(theme) {
    const preset = window.themeManager?.themePresets?.[theme] || window.themeManager?.themePresets?.dark;
    if (!preset) return;

    const styleId = 'theme-current-style';
    let styleEl = document.getElementById(styleId);
    if (styleEl) {
      styleEl.remove();
    }

    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      body { background: ${preset.background} !important; color: ${preset.text} !important; }
      .titlebar, .main-layout, .sidebar, .sidebar-menu, .settings-layout, .settings-sidebar, .settings-card, .settings-section, .view-container { background: ${preset.panel} !important; color: ${preset.text} !important; border-color: ${preset.border} !important; }
      .titlebar, .menu-item, .menu-item.active, .menu-item:hover, .settings-search, .settings-footer, .setting-item { color: ${preset.text} !important; }
      .menu-item.active, .menu-item:hover { color: ${preset.accent} !important; }
      .theme-option.active { border-color: ${preset.accent} !important; }
      .accent-option.active { box-shadow: 0 0 0 3px rgba(255,255,255,0.3) !important; }
      .btn-primary { background: ${preset.accent} !important; border-color: ${preset.accent} !important; }
      .btn-secondary { background: ${preset.surface} !important; color: ${preset.text} !important; }
      a { color: ${preset.accent} !important; }
    `;
    document.head.appendChild(styleEl);
  }

  /**
   * ✅ Applique la couleur d'accent
   */
  applyAccentColor(accent, skipManagerUpdate = false) {
    const currentAccent = window.themeManager?.currentAccent;
    if (!skipManagerUpdate && window.themeManager && currentAccent !== accent) {
      window.themeManager.setAccent(accent);
    }
    localStorage.setItem('accent', accent);
    document.documentElement.setAttribute('data-accent', accent);
    console.log(`[Accent] Applied: ${accent}`);
  }

  /**
   * ✅ Charge le thème au démarrage
   */
  loadTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    const accent = localStorage.getItem('accent') || 'indigo';
    
    if (window.themeManager) {
      window.themeManager.setTheme(theme);
      window.themeManager.setAccent(accent);
    }
    
    this.applyThemeSelection(theme, true);
    this.applyAccentColor(accent, true);
  }

  /**
   * ✅ Applique les options d'interface (blur, animations, transparence)
   */
  applyInterfaceOptions() {
    const blur = localStorage.getItem('blur-background') === 'true';
    const animations = localStorage.getItem('animations') !== 'false'; // true par défaut
    const transparency = localStorage.getItem('transparency') === 'true';

    document.documentElement.setAttribute('data-blur', blur);
    document.documentElement.setAttribute('data-animations', animations);
    document.documentElement.setAttribute('data-transparency', transparency);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatLoaderLabel(loader) {
    const labels = {
      vanilla: 'Sans loader',
      fabric: 'Fabric',
      forge: 'Forge',
      neoforge: 'NeoForge',
      quilt: 'Quilt'
    };

    return labels[String(loader || '').toLowerCase()] || 'Loader';
  }

  getAvailableLoadersForVersion(version = this.selectedProfile?.version) {
    const targetVersion = String(version || '').trim();
    if (!targetVersion) {
      return [];
    }

    const uniqueLoaders = new Map();
    for (const profile of Array.isArray(this.profiles) ? this.profiles : []) {
      const profileVersion = String(profile?.version || '').trim();
      const loader = String(profile?.loader || 'vanilla').toLowerCase();
      if (profileVersion !== targetVersion || loader === 'vanilla') {
        continue;
      }

      if (!uniqueLoaders.has(loader)) {
        uniqueLoaders.set(loader, {
          loader,
          label: this.formatLoaderLabel(loader)
        });
      }
    }

    return Array.from(uniqueLoaders.values());
  }

  getActiveLaunchLoader(version = this.selectedProfile?.version) {
    const availableLoaders = this.getAvailableLoadersForVersion(version);
    if (!availableLoaders.some(item => item.loader === this.selectedLaunchLoader)) {
      this.selectedLaunchLoader = 'vanilla';
    }

    return this.selectedLaunchLoader;
  }

  hideLoadingScreen() {
    if (this.loadingScreenHidden) {
      return;
    }

    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) {
      return;
    }

    setTimeout(() => {
      this.loadingScreenHidden = true;
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        if (loadingScreen && loadingScreen.parentElement) {
          loadingScreen.style.display = 'none';
        }
      }, 6000);
    }, 6000);
  }

  async loadPlayerHead() {
    if (!this.authData?.username) {
      this.playerHead = null;
      return null;
    }

    try {
      this.playerHead = await ipcRenderer.invoke('get-player-head', this.authData.username);
      return this.playerHead;
    } catch (error) {
      console.warn('Impossible de charger la tete du joueur:', error);
      this.playerHead = null;
      return null;
    }
  }

  async loadDeferredData() {
    if (this.deferredDataPromise) {
      return this.deferredDataPromise;
    }

    this.deferredDataPromise = Promise.all([
      this.loadPlayerHead(),
      // this.loadNews() - Actualités désactivées
    ]).finally(() => {
      this.deferredDataPromise = null;
      if (this.currentView === 'main' || this.currentView === 'news') {
        this.renderContentAsync();
      }
    });

    return this.deferredDataPromise;
  }


  /**
   * ✅ NETTOYER LES ANCIENS LISTENERS ET RESSOURCES
   */
  cleanupListeners() {
    // Nettoyer les listeners IPC
    if (this.listeners.size > 0) {
      this.listeners.forEach((listener, event) => {
        try {
          ipcRenderer.removeListener(event, listener);
        } catch (err) {
          console.error(`[Cleanup] Error removing listener for ${event}:`, err);
        }
      });
      this.listeners.clear();
    }
    
    // Nettoyer le listener de changement de vue
    if (this.viewChangeListener && document) {
      try {
        document.removeEventListener('click', this.viewChangeListener);
      } catch (err) {
        console.error('[Cleanup] Error removing view listener:', err);
      }
      this.viewChangeListener = null;
    }
    
    // Nettoyer les raccourcis clavier
    if (this.shortcuts && typeof this.shortcuts.cleanup === 'function') {
      try {
        this.shortcuts.cleanup();
      } catch (err) {
        console.error('[Cleanup] Error cleaning up shortcuts:', err);
      }
    }
  }

  /**
   * ✅ AJOUTER UN LISTENER TRACKABLE
   */
  addTrackedListener(event, callback) {
    // Supprimer l'ancien listener s'il existe
    if (this.listeners.has(event)) {
      try {
        ipcRenderer.removeListener(event, this.listeners.get(event));
      } catch (err) {
        console.warn(`[Listener] Failed to remove old listener for ${event}`);
      }
    }
    
    ipcRenderer.on(event, callback);
    this.listeners.set(event, callback);
  }

  async init() {
    try {
      console.log('📱 [RENDERER] init() called');
      // ✅ CHARGER LE THÈME EN PREMIER (avant le rendu)
      this.loadTheme();
      
      console.log('📱 [RENDERER] Loading data...');
      this.features = new LauncherFeatures(this);
      await this.loadData();
      
      console.log('📱 [RENDERER] Data loaded, authData:', this.authData ? `${this.authData.username} (${this.authData.uuid})` : 'NULL');
      this.render();
      console.log('📱 [RENDERER] render() completed');
      //this.setupRadioWidget();
      this.setupEventListeners();
      await this.features.setupProfileEvents();
      
      // ✅ APPLIQUER LE FULLSCREEN SI ACTIVÉ
      if (this.settings && this.settings.fullscreen) {
        setTimeout(() => {
          ipcRenderer.send('toggle-fullscreen', true);
        }, 500);
      }
      
      // ✅ VÉRIFIER LES MISES À JOUR APRÈS LE CHARGEMENT (EN SILENCIEUX)
      setTimeout(async () => {
        try {
          const result = await ipcRenderer.invoke('check-updates');
          if (result.hasUpdate) {
            this.ui.showToast({
              title: 'Mise a jour disponible',
              message: `La version v${result.latestVersion} est prete. Ouvre les parametres pour l installer.`,
              type: 'success',
              duration: 8000
            });
          }
        } catch (error) {
          console.log('⚠️ Error checking updates:', error);
        }
      }, 2000);
      
      // ✅ ÉMETTRE UN ÉVÉNEMENT D'INITIALISATION
      window.dispatchEvent(new CustomEvent('app-ready', { 
        detail: { app: this, theme: this.themePresets } 
      }));
      console.log('✅ [Init] App successfully initialized');
    } catch (error) {
      console.error('❌ [Init] Initialization error:', error);
      this.ui.showToast({
        title: 'Erreur d\'initialisation',
        message: error?.message || 'Une erreur est survenue au démarrage',
        type: 'error'
      });
    }
    this.hideLoadingScreen();
    
    setInterval(() => this.updateFriendsStatus(), 30000);
  }

  async loadData() {
    console.log('📱 [RENDERER] loadData() started');
    const [
      authData,
      profiles,
      settings,
      maxRam,
      friends
    ] = await Promise.all([
      ipcRenderer.invoke('get-auth-data'),
      ipcRenderer.invoke('get-profiles'),
      ipcRenderer.invoke('get-settings'),
      ipcRenderer.invoke('get-system-ram'),
      ipcRenderer.invoke('get-friends')
    ]);

    console.log('📱 [RENDERER] Received authData:', authData ? `${authData.username} (${authData.uuid})` : 'NULL');
    console.log('📱 [RENDERER] Received profiles:', profiles ? profiles.length + ' profiles' : 'NULL');
    console.log('📱 [RENDERER] Received settings:', settings ? 'OK' : 'NULL');
    console.log('📱 [RENDERER] Received maxRam:', maxRam);
    console.log('📱 [RENDERER] Received friends:', friends ? friends.length + ' friends' : 'NULL');

    this.authData = authData;
    if (this.authData) {
        this.authData = authData || {};
    }

    this.profiles = profiles;
    this.selectedProfile = this.profiles[0];
    this.selectedLaunchLoader = 'vanilla';

    this.settings = settings;
    this.maxRam = maxRam;
    this.friends = friends;
    this.loadTheme();
    void this.loadDeferredData();
  }

  async updateFriendsStatus() {
    if (this.currentView === 'friends') {
      this.friends = await ipcRenderer.invoke('check-friends-status');
      this.render();
    }
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      // ✅ Boutons titlebar - utiliser .closest() pour gérer les clics sur les SVG enfants
      const minimizeBtn = e.target.closest('#minimize-btn');
      const maximizeBtn = e.target.closest('#maximize-btn');
      const closeBtn = e.target.closest('#close-btn');
      const radioBtn = e.target.closest('#radio-player-btn');
      const newsCardItem = e.target.closest('.news-card-item');
      const viewAllNewsBtn = e.target.closest('#view-all-news-btn');
      const newsletterBtn = e.target.closest('#newsletter-btn');
      
      if (minimizeBtn) ipcRenderer.send('minimize-window');
      else if (maximizeBtn) ipcRenderer.send('maximize-window');
      else if (closeBtn) ipcRenderer.send('close-window');
      else if (radioBtn) this.openRadioPlayer();
      // ✅ LISTENER POUR LES ACTUALITÉS
      else if (newsCardItem) {
        e.preventDefault();
        const newsId = newsCardItem.getAttribute('data-news-id');
        if (newsId) {
          this.showNewsDetail(parseInt(newsId));
        }
      }
      // ✅ LISTENER POUR LE BOUTON "VOIR TOUTES LES ACTUALITÉS"
      else if (viewAllNewsBtn) {
        e.preventDefault();
        this.currentView = 'news';
        this.render();
      }
      // ✅ LISTENER POUR LA NEWSLETTER
      else if (newsletterBtn) {
        this.subscribeToNewsletter();
      }
      else if (e.target.classList.contains('help-tab-btn')) {
        // Récupérer l'ID de l'onglet et afficher le contenu correspondant
        const tabName = e.target.id.replace('-btn', '');
        document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
        const tabContent = document.getElementById(tabName + '-content');
        if (tabContent) tabContent.style.display = 'block';
        
        // Mettre à jour le style des boutons
        document.querySelectorAll('.help-tab-btn').forEach(btn => {
          btn.style.background = 'transparent';
          btn.style.color = '#94a3b8';
        });
        e.target.style.background = 'rgba(99, 102, 241, 0.2)';
        e.target.style.color = '#e2e8f0';
      }
      else if (e.target.classList.contains('bug-report-btn')) {
        // Ouvrir le lien GitHub pour créer un rapport
        ipcRenderer.send('open-external', 'https://github.com/pharos-off/Velkora/issues/new');
      }
      else if (e.target.classList.contains('pr-request-btn')) {
        // Ouvrir le lien GitHub pour les pull requests
        ipcRenderer.send('open-external', 'https://github.com/pharos-off/Velkora/pulls');
      }
    });

    // ✅ LISTENER POUR LES MISES À JOUR DE SETTINGS
    this.addTrackedListener('settings-updated', (event, settings) => {
      this.settings = settings;
      
      // Mettre à jour le badge RAM
      const ramBadge = document.getElementById('ram-badge-display');
      if (ramBadge) {
        ramBadge.textContent = `${settings.ramAllocation || 4} GB RAM`;
      }
    });
  }

  // ✅ FONCTION POUR S'ABONNER À LA NEWSLETTER (SANS DOUBLONS)
  async subscribeToNewsletter() {
    const email = document.getElementById('newsletter-email')?.value.trim();
    
    if (!email) {
      alert('Veuillez entrer une adresse email');
      return;
    }
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Veuillez entrer une adresse email valide');
      return;
    }
    
    const btn = document.getElementById('newsletter-btn');
    if (btn.disabled) return; // Éviter les doublons
    
    const originalText = btn.textContent;
    btn.disabled = true;
      btn.textContent = 'Enregistrement...';
    try {
      // Sauvegarder l'email dans le localStorage
      const subscribers = JSON.parse(localStorage.getItem('newsletter-subscribers') || '[]');
      if (!subscribers.includes(email)) {
        subscribers.push(email);
        localStorage.setItem('newsletter-subscribers', JSON.stringify(subscribers));
      }
      
      // Envoyer l'email au serveur
      await ipcRenderer.invoke('subscribe-newsletter', { email });
      
      alert('Merci ! Vous êtes abonné à la newsletter');
      document.getElementById('newsletter-email').value = '';
      btn.textContent = 'Abonné';
      
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'S\'abonner';
      }, 3000);
    } catch (error) {
      console.error('Erreur newsletter:', error);
      alert('Une erreur est survenue');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  render() {
    console.log('📱 [RENDERER] render() called - authData:', this.authData ? `${this.authData.username}` : 'NULL');
    const appContainer = document.getElementById('app');
    if (!this.authData) {
      console.log('📱 [RENDERER] authData is NULL, switching to login view');
      this.currentView = 'login';
    } else {
      console.log('📱 [RENDERER] authData found, keeping current view:', this.currentView);
      if (!this.currentView || this.currentView === 'login') {
        this.currentView = 'main';
      }
    }
    if (this.currentView === 'login') {
      console.log('📱 [RENDERER] Rendering LOGIN view');
      appContainer.innerHTML = this.renderLogin();
      this.setupLoginEvents();
    } else {
      // Afficher le layout principal d'abord
      const mainHtml = this.renderMainLayout();
      appContainer.innerHTML = mainHtml;
      
      // ✅ CHARGER LE LOGO DYNAMIQUEMENT (FONCTIONNE EN PRODUCTION ET DÉVELOPPEMENT)
      setTimeout(async () => {
        const logoImg = document.getElementById('titlebar-logo');
        if (logoImg) {
          try {
            const logoUrl = await ipcRenderer.invoke('get-logo-path');
            logoImg.src = logoUrl;
          } catch (e) {
            console.warn('Impossible de charger le logo:', e.message);
          }
        }
      }, 0);
      
      // ✅ APPLIQUER LE THÈME LIGHT/DARK INITIAL (PARTOUT)
      const theme = localStorage.getItem('theme') || 'dark';
      const accent = localStorage.getItem('accent') || 'indigo';
      
      this.applyThemeSelection(theme);
      this.applyAccentColor(accent);
      
      // Puis charger le contenu asynchrone
      this.renderContentAsync();
    }
  }

  // ✅ CLEANUP: Nettoyer les ressources avant de changer de vue
  cleanupView() {
    const contentDiv = document.getElementById('main-content-view');
    if (!contentDiv) return;

    try {
      // ✅ Supprimer les event listeners des anciens éléments
      const oldElements = contentDiv.querySelectorAll('[data-listener]');
      oldElements.forEach(el => {
        try {
          el.replaceWith(el.cloneNode(true)); // Remplacer l'élément pour supprimer les listeners
        } catch (err) {
          console.warn('[Cleanup] Error removing element:', err);
        }
      });

      // ✅ Supprimer les événements audio
      const audioElements = contentDiv.querySelectorAll('audio, video');
      audioElements.forEach(el => {
        try {
          el.pause();
          el.src = '';
          el.remove();
        } catch (err) {
          console.warn('[Cleanup] Error removing audio/video:', err);
        }
      });

      // ✅ Nettoyer les styles injectés
      const styleElements = contentDiv.querySelectorAll('style');
      styleElements.forEach(el => {
        try {
          el.remove();
        } catch (err) {
          console.warn('[Cleanup] Error removing style:', err);
        }
      });

      // ✅ Nettoyer le contenu
      contentDiv.innerHTML = '';
      
      // ✅ Forcer le garbage collector si disponible
      if (typeof global !== 'undefined' && global.gc) {
        try {
          global.gc();
        } catch (err) {
          console.warn('[Cleanup] GC error:', err);
        }
      }
    } catch (error) {
      console.error('[Cleanup] Error during view cleanup:', error);
    }
  }

  async renderContentAsync() {
    const contentDiv = document.getElementById('main-content-view');
    if (!contentDiv) {
      console.error('main-content-view not found');
      return;
    }

    try {
      // ✅ CLEANUP: Nettoyer l'ancienne vue
      this.cleanupView();
      
      const html = await this.renderCurrentView();
      contentDiv.innerHTML = html;
      const scripts = Array.from(contentDiv.querySelectorAll('script'));
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        document.head.appendChild(newScript);
        script.remove();
      });
      
      // ✅ RÉAPPLIQUER LE THÈME APRÈS LE RENDU (sans render() pour éviter boucle)
      const theme = localStorage.getItem('theme') || 'dark';
      const accent = localStorage.getItem('accent') || 'indigo';
      
      this.applyThemeSelection(theme);
      this.applyAccentColor(accent);
      
      this.setupMainEvents();
    } catch (error) {
      console.error('Erreur rendu contenu:', error);
      contentDiv.innerHTML = `<div style="padding: 20px; color: #ef4444;">Erreur: ${error.message}</div>`;
    }
  }
renderMainLayout() {
    return `
      <div class="titlebar">
        <div class="titlebar-title" style="display: flex; align-items: center; gap: 8px;">
          <img id="titlebar-logo" alt="Velkora" style="width: 16px; height: 16px; border-radius: 4px; object-fit: contain;">
          <span>${LauncherVersion.getName()}</span>
        </div>
        <div class="titlebar-buttons">
          <button class="titlebar-button" id="radio-player-btn" title="Radio">${icons.radio}</button>
          <button class="titlebar-button minimize" id="minimize-btn" title="Réduire">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="titlebar-button maximize" id="maximize-btn" title="Agrandir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="titlebar-button close" id="close-btn" title="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="main-layout">
        <div class="sidebar">
          <!-- ✅ HEADER SANS PHOTO - Juste le nom -->
          <div class="sidebar-header" style="padding: 24px 20px; border-bottom: 1px solid rgba(99, 102, 241, 0.1);">
            <div class="brand-name" style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${LauncherVersion.getName()}</div>
          </div>

          <div class="sidebar-menu">
            <div>
              <button class="menu-item ${this.currentView === 'main' ? 'active' : ''}" data-view="main">
                <span class="menu-icon"><i class="bi bi-house-door"></i></span> Accueil
              </button>
              <button class="menu-item ${this.currentView === 'friends' ? 'active' : ''}" data-view="friends" disabled style="opacity: 0.5; cursor: not-allowed;">
                <span class="menu-icon"><i class="bi bi-people"></i></span> Amis
              </button>
              <button class="menu-item ${this.currentView === 'servers' ? 'active' : ''}" data-view="servers">
                <span class="menu-icon"><i class="bi bi-globe"></i></span> Serveurs
              </button>
              <button class="menu-item ${this.currentView === 'partners' ? 'active' : ''}" data-view="partners">
                <span class="menu-icon"><i class="bi bi-star"></i></span> Partenaires
              </button>
              <button class="menu-item ${this.currentView === 'screenshots' ? 'active' : ''}" data-view="screenshots">
                <span class="menu-icon"><i class="bi bi-images"></i></span> Screenshots & Sauvegardes
              </button>
            </div>

            <div style="border-top: 1px solid rgba(99, 102, 241, 0.1); margin: 12px 0; padding-top: 12px;">
              <button class="menu-item ${this.currentView === 'stats' ? 'active' : ''}" data-view="stats" disabled style="opacity: 0.5; cursor: not-allowed;">
                <span class="menu-icon"><i class="bi bi-bar-chart"></i></span> Statistiques
              </button>
              <button class="menu-item ${this.currentView === 'versions' ? 'active' : ''}" data-view="versions">
                <span class="menu-icon"><i class="bi bi-search"></i></span> Versions
              </button>
              <button class="menu-item ${this.currentView === 'mods' ? 'active' : ''}" data-view="mods">
                <span class="menu-icon"><i class="bi bi-puzzle"></i></span> Mods
              </button>
              <button class="menu-item ${this.currentView === 'theme' ? 'active' : ''}" data-view="theme">
                <span class="menu-icon"><i class="bi bi-palette"></i></span> Thème
              </button>
            </div>

            <div style="border-top: 1px solid rgba(99, 102, 241, 0.1); margin: 12px 0; padding-top: 12px;">
              <button class="menu-item ${this.currentView === 'help' ? 'active' : ''}" data-view="help">
                <span class="menu-icon"><i class="bi bi-question-circle"></i></span> Aide & Support
              </button>
            </div>

            <div style="border-top: 1px solid rgba(99, 102, 241, 0.1); margin: 12px 0; padding-top: 12px;">
              <button class="menu-item" data-view="settings">
                <span class="menu-icon"><i class="bi bi-gear"></i></span> Paramètres
              </button>
            </div>
          </div>
        </div>

        <div class="main-content" id="main-content-view">
          <div style="text-align: center; padding: 40px; color: #94a3b8;">Chargement...</div>
        </div>
      </div>
    `;
  }

  renderLogin() {
    return `
      <div class="titlebar">
        <div class="titlebar-title" style="display: flex; align-items: center; gap: 8px;">
          <img id="titlebar-logo" alt="Velkora" style="width: 16px; height: 16px; border-radius: 4px; object-fit: contain;">
          <span>${LauncherVersion.getName()}</span>
        </div>
        <div class="titlebar-buttons">
          <button class="titlebar-button" id="radio-player-btn" title="Radio">${icons.radio}</button>
          <button class="titlebar-button minimize" id="minimize-btn" title="Réduire">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="titlebar-button maximize" id="maximize-btn" title="Agrandir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="titlebar-button close" id="close-btn" title="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <style>
        @keyframes float-animation {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-10px) translateX(5px); }
          50% { transform: translateY(-20px) translateX(0px); }
          75% { transform: translateY(-10px) translateX(-5px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.5), 0 0 40px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.8), 0 0 60px rgba(139, 92, 246, 0.5); }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
          50% { border-color: rgba(99, 102, 241, 0.8); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #0f172a 0%, #1a1f3a 25%, #16213e 50%, #1e293b 75%, #0f172a 100%);
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .login-bg-elements {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.3;
        }
        .blob1 {
          width: 300px;
          height: 300px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          top: -10%;
          right: 10%;
          animation: float-animation 8s ease-in-out infinite;
        }
        .blob2 {
          width: 200px;
          height: 200px;
          background: linear-gradient(135deg, #ec4899 0%, #6366f1 100%);
          bottom: 10%;
          left: 5%;
          animation: float-animation 10s ease-in-out infinite reverse;
        }
        .blob3 {
          width: 250px;
          height: 250px;
          background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%);
          bottom: 20%;
          right: 15%;
          animation: float-animation 12s ease-in-out infinite;
        }
        .login-card {
          position: relative;
          z-index: 10;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 24px;
          padding: 60px 50px;
          width: 100%;
          max-width: 480px;
          animation: slide-in 0.8s ease-out, glow 3s ease-in-out infinite;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(99, 102, 241, 0.1);
        }
        .login-logo {
          text-align: center;
          margin-bottom: 40px;
          animation: float-animation 4s ease-in-out infinite;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .login-logo-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border-radius: 16px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.5);
        }
        .login-title {
          font-size: 36px;
          font-weight: 700;
          color: white;
          margin: 0 0 10px 0;
          width: 100%;
        }
        .login-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 40px 0;
          width: 100%;
        }
        .login-button {
          width: 100%;
          padding: 14px 24px;
          border: 1px solid transparent;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 14px;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: white;
        }
        .login-button-primary {
          background: linear-gradient(135deg, #0066ff 0%, #0052cc 100%);
          box-shadow: 0 10px 20px rgba(0, 102, 255, 0.3);
        }
        .login-button-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(0, 102, 255, 0.5);
        }
        .login-button-primary:active {
          transform: translateY(0px);
        }
        .login-footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(99, 102, 241, 0.1);
        }
        .login-version {
          font-size: 12px;
          color: #64748b;
        }
        .login-status {
          font-size: 11px;
          color: #475569;
          margin-top: 8px;
        }
      </style>

      <div class="login-container">
        <div class="login-bg-elements">
          <div class="blob blob1"></div>
          <div class="blob blob2"></div>
          <div class="blob blob3"></div>
        </div>

        <div class="login-card">
          <h1 class="login-title">${LauncherVersion.getName()}</h1>
          <p class="login-subtitle">L'expérience Minecraft ultime</p>

          <button id="ms-login-btn" class="login-button login-button-primary">
            <span>Microsoft</span>
            <span>Se connecter avec Microsoft</span>
          </button>

          <div class="login-footer">
            <p class="login-version">${LauncherVersion.getName()} v${LauncherVersion.version}</p>
            <p class="login-status">Prêt à jouer</p>
          </div>
        </div>
      </div>
    `;
  }

  // ✅ PAGES D'AIDE
  renderHelp() {
    return `
      <div class="view-container" style="padding: 40px;">
        <!-- 📋 HEADER PRINCIPAL -->
        <div class="view-header" style="margin-bottom: 40px;">
          <h1 class="view-title" style="display: flex; align-items: center; gap: 12px; font-size: 32px; margin: 0 0 8px 0;"><span style="display: flex;">${icons.help}</span> Centre d'aide Velkora</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 16px;">Support technique, documentation et communauté</p>
        </div>

        <!-- 🎯 CARTES D'ACTION RAPIDE -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 40px;">
          <div class="help-quick-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 14px; padding: 24px; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -50%; width: 200px; height: 200px; background: rgba(99, 102, 241, 0.1); border-radius: 50%; pointer-events: none;"></div>
            <div style="position: relative; z-index: 1;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.newspaper}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Documentation</h3>
              <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Guides complets et tutoriels</p>
            </div>
          </div>

          <div class="help-quick-card" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 14px; padding: 24px; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -50%; width: 200px; height: 200px; background: rgba(139, 92, 246, 0.1); border-radius: 50%; pointer-events: none;"></div>
            <div style="position: relative; z-index: 1;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.search}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Signaler un Bug</h3>
              <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Aide-nous à améliorer</p>
            </div>
          </div>

          <div class="help-quick-card" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 14px; padding: 24px; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -50%; width: 200px; height: 200px; background: rgba(168, 85, 247, 0.1); border-radius: 50%; pointer-events: none;"></div>
            <div style="position: relative; z-index: 1;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.messageSquare}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Communauté Discord</h3>
              <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Rejoins nos discussions</p>
            </div>
          </div>

          <div class="help-quick-card" style="background: linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(34, 197, 94, 0.1) 100%); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 14px; padding: 24px; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -50%; width: 200px; height: 200px; background: rgba(236, 72, 153, 0.1); border-radius: 50%; pointer-events: none;"></div>
            <div style="position: relative; z-index: 1;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.handshake}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Contribuer</h3>
              <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Améliore le projet</p>
            </div>
          </div>
        </div>

        <!-- 📑 ONGLETS -->
        <div style="display: flex; gap: 8px; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 2px solid rgba(99, 102, 241, 0.15); overflow-x: auto;">
          <button id="help-docs-btn" class="help-tab-btn" style="background: rgba(99, 102, 241, 0.25); color: #e2e8f0; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">${icons.newspaper} Documentation</button>
          <button id="help-faq-btn" class="help-tab-btn" style="background: transparent; color: #94a3b8; border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">${icons.help} FAQ</button>
          <button id="help-bug-btn" class="help-tab-btn" style="background: transparent; color: #94a3b8; border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">${icons.search} Signaler un bug</button>
          <button id="help-discord-btn" class="help-tab-btn" style="background: transparent; color: #94a3b8; border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">${icons.messageSquare} Discord</button>
          <button id="help-pr-btn" class="help-tab-btn" style="background: transparent; color: #94a3b8; border: 1px solid rgba(99, 102, 241, 0.2); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">${icons.handshake} Contribuer</button>
        </div>

        <!-- 📖 DOCUMENTATION -->
        <div id="help-docs-content" class="help-tab-content" style="display: block;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s; hover:transform translateY(-2px);">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.zap}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Démarrage Rapide</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Installation, configuration initiale et lancement du jeu.</p>
            </div>
            
            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.harddrive}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Versions & Loaders</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Gère Vanilla, Fabric, Forge et Quilt facilement.</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.settings}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Configuration</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Optimise RAM, FPS et paramètres de jeu.</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.tool}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Modding</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Ajoute et gère tes mods facilement.</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.lock}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Sécurité</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Protège ton compte Microsoft et tes données.</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; cursor: pointer; transition: all 0.3s;">
              <div style="font-size: 20px; margin-bottom: 12px; display: flex;">${icons.palette}</div>
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Personnalisation</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">Personnalise l'apparence du lanceur.</p>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 24px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 20px; display: flex;">${icons.clipboard}</div>
              <div>
                <h3 style="color: #e2e8f0; margin: 0 0 4px 0; font-size: 15px; font-weight: 700;">Wiki Complet</h3>
                <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Tous nos tutoriels et guides sont disponibles sur GitHub</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ❓ FAQ -->
        <div id="help-faq-content" class="help-tab-content" style="display: none;">
          <div style="max-width: 900px;">
            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #6366f1; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Comment installer ${LauncherVersion.getName()} ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Télécharge l'installateur depuis GitHub, exécute-le et suis les étapes. Aucune configuration supplémentaire nécessaire !</p>
            </div>

            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #a855f7; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Que signifie Fabric, Forge, etc. ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Ce sont des <strong>modloaders</strong> qui permettent d'installer des mods. Vanilla = sans mods. Fabric/Forge = avec mods. Choisis selon tes besoins !</p>
            </div>

            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Comment optimiser mes FPS ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Va dans Paramètres → Configuration pour ajuster la RAM allouée, la distance de rendu et les graphismes. Regarde aussi tes drivers GPU !</p>
            </div>

            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #06b6d4; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Mes mods ne chargent pas, pourquoi ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Vérifie que tu as installé le bon modloader et la bonne version. Les mods Fabric ne marchent pas sur Forge. Consulte la doc du mod pour plus d'infos.</p>
            </div>

            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Est-ce gratuit ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Oui ! ${LauncherVersion.getName()} est 100% gratuit et open-source. Aucun frais caché !</p>
            </div>

            <div class="faq-item" style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-weight: 700;">Comment jouer en multijoueur ?</h4>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px;">Utilise l'onglet Serveurs pour rejoindre des serveurs publics, ou ajoute une adresse IP personnalisée.</p>
            </div>
          </div>
        </div>

        <!-- 🐛 SIGNALER UN BUG -->
        <div id="help-bug-content" class="help-tab-content" style="display: none;">
          <div style="max-width: 900px;">
            <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
              <h3 style="color: #e2e8f0; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;"><span style="display: flex;">${icons.search}</span> Signaler un Bug</h3>
              <p style="color: #cbd5e1; line-height: 1.7; margin: 0; font-size: 14px;">Merci de nous aider à améliorer ${LauncherVersion.getName()} ! Voici comment bien signaler un problème :</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
              <h4 style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;"><span style="display: inline-flex; margin-right: 8px;">${icons.clipboard}</span> Étapes à suivre</h4>
              <ol style="color: #cbd5e1; line-height: 2; margin: 0; padding-left: 20px;">
                <li><strong style="color: #6366f1;">Vérifiez</strong> que le bug n'a pas déjà été signalé sur GitHub</li>
                <li><strong style="color: #6366f1;">Décrivez</strong> précisément ce qui s'est passé</li>
                <li><strong style="color: #6366f1;">Listez</strong> les étapes pour reproduire le bug</li>
                <li><strong style="color: #6366f1;">Joignez</strong> des captures d'écran ou vidéos si possible</li>
                <li><strong style="color: #6366f1;">Incluez</strong> vos informations système</li>
              </ol>
            </div>

            <div style="background: rgba(15, 23, 42, 0.8); border-left: 3px solid #6366f1; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h4 style="color: #cbd5e1; margin: 0 0 12px 0; font-weight: 700; font-family: monospace; font-size: 13px;"><span style="display: inline-flex; margin-right: 8px;">${icons.clipboard}</span> Exemple de rapport</h4>
              <div style="color: #a78bfa; font-family: monospace; font-size: 12px; line-height: 1.6;">
                <div><strong style="color: #cbd5e1;">Titre:</strong> Crash au lancement avec Fabric 1.20.1</div>
                <div style="margin-top: 8px;"><strong style="color: #cbd5e1;">Description:</strong></div>
                <div style="margin-top: 4px; color: #94a3b8;">Le jeu crash lors du lancement avec Fabric 1.20.1. Avant il fonctionnait.</div>
                <div style="margin-top: 8px;"><strong style="color: #cbd5e1;">Reproduction:</strong></div>
                <div style="margin-top: 4px; color: #94a3b8;">1. Sélectionne une version 1.20.1<br/>2. Choisis Fabric<br/>3. Clique sur Lancer</div>
                <div style="margin-top: 8px;"><strong style="color: #cbd5e1;">Système:</strong></div>
                <div style="margin-top: 4px; color: #94a3b8;">OS: Windows 11 | RAM: 16 GB | Launcher: v${LauncherVersion.version}</div>
              </div>
            </div>

            <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Ouvrir une Issue sur GitHub</h3>
              <p style="color: #cbd5e1; margin: 0 0 16px 0; font-size: 14px;">Signale le bug directement sur notre dépôt</p>
              <div id="help-bug-report-btn" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 12px 24px; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s; border: none;">
                ${icons.download} Aller à GitHub Issues
              </div>
            </div>
          </div>
        </div>

        <!-- 💬 DISCORD -->
        <div id="help-discord-content" class="help-tab-content" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 24px;">
            <div style="background: linear-gradient(135deg, rgba(88, 101, 242, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(88, 101, 242, 0.3); border-radius: 12px; padding: 28px; text-align: center;">
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Rejoins notre communauté</h3>
              <p style="color: #cbd5e1; margin: 0 0 16px 0; font-size: 14px;">Plus de 1000+ joueurs te répondront sur Discord !</p>
              <div id="help-discord-join-btn" style="background: #5865F2; padding: 12px 24px; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s;">
                ${icons.messageSquare} Rejoindre Discord
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
              <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(88, 101, 242, 0.2); border-radius: 12px; padding: 20px;">
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">#général</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Discussions générales et annonces</p>
              </div>
              <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(88, 101, 242, 0.2); border-radius: 12px; padding: 20px;">
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">#support</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Aide pour les problèmes</p>
              </div>
              <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(88, 101, 242, 0.2); border-radius: 12px; padding: 20px;">
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">#mods</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Conseils sur les mods</p>
              </div>
              <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(88, 101, 242, 0.2); border-radius: 12px; padding: 20px;">
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">#serveurs</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 13px;">Partage de serveurs</p>
              </div>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 24px;">
              <h4 style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 15px; font-weight: 700;"><span style="display: inline-flex; margin-right: 8px;">${icons.pin}</span> Règles de la communauté</h4>
              <ul style="color: #cbd5e1; line-height: 1.8; margin: 0; font-size: 14px;">
                <li>Sois respectueux envers les autres membres</li>
                <li>Pas de spam, flood ou contenu malveillant</li>
                <li>Garde les discussions dans les bons canaux</li>
                <li>Aide les nouveaux et réponds avec gentillesse</li>
                <li>Pas de publicité ou promotion sans permission</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 🤝 CONTRIBUER -->
        <div id="help-pr-content" class="help-tab-content" style="display: none;">
          <div style="max-width: 900px;">
            <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;"><span style="display: flex;">${icons.handshake}</span> Contribuer au Projet</h3>
              <p style="color: #cbd5e1; line-height: 1.7; margin: 0; font-size: 14px;">Tout le monde peut aider ! ${LauncherVersion.getName()} est open-source et vos contributions sont bienvenues !</p>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
              <h4 style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;"><span style="display: inline-flex; margin-right: 8px;">${icons.tool}</span> Comment contribuer</h4>
              <ol style="color: #cbd5e1; line-height: 2.2; margin: 0; padding-left: 20px;">
                <li><strong style="color: #6366f1;">Forkez</strong> le dépôt GitHub</li>
                <li><strong style="color: #6366f1;">Clonez</strong> votre fork sur votre machine</li>
                <li><strong style="color: #6366f1;">Créez</strong> une branche pour votre feature (<code style="color: #10b981; background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 3px;">git checkout -b feature/awesome-feature</code>)</li>
                <li><strong style="color: #6366f1;">Commitez</strong> vos changements avec des messages clairs</li>
                <li><strong style="color: #6366f1;">Pushez</strong> vers votre fork</li>
                <li><strong style="color: #6366f1;">Ouvrez</strong> une Pull Request avec une description détaillée</li>
              </ol>
            </div>

            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
              <h4 style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;"><span style="display: inline-flex; margin-right: 8px;">${icons.check}</span> Directives pour une Pull Request</h4>
              <ul style="color: #cbd5e1; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Décrivez <strong>clairement</strong> ce que votre PR apporte</li>
                <li>Liez les issues pertinentes (#123)</li>
                <li>Assurez-vous que le code <strong>compile</strong> sans erreurs</li>
                <li>Testez votre code <strong>en développement et en production</strong></li>
                <li>Gardez votre branche à jour avec <code style="color: #10b981; background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 3px;">main</code></li>
                <li>Soyez <strong>patient</strong> pour la revue et <strong>ouvert</strong> aux suggestions</li>
              </ul>
            </div>

            <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.15) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
              <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">Voir le projet sur GitHub</h3>
              <p style="color: #cbd5e1; margin: 0 0 16px 0; font-size: 14px;">Retrouvez le code complet et la documentation</p>
              <div id="help-github-project-btn" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 12px 24px; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s;">
                ${icons.download} Aller à GitHub
              </div>
            </div>

            <div style="margin-top: 24px; padding: 20px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px;">
              <p style="color: #cbd5e1; margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px;"><span style="display: flex;">${icons.heart}</span> <strong style="color: #22c55e;">Merci !</strong> Votre contribution rend ${LauncherVersion.getName()} meilleur pour tous !</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async renderCurrentView() {
    switch (this.currentView) {
      case 'main': return this.renderHomeView();
      case 'friends': return this.renderFriendsView();
      case 'versions': return this.renderVersionsView();
      case 'partners': return this.renderPartnersView();
      case 'screenshots': return this.renderScreenshotsView();
      case 'stats': return await this.renderStatsView();
      case 'news': return this.renderNewsView();
      case 'servers': return this.renderServersView();
      case 'mods':
        const modsContent = await this.modsManager.render();
        setTimeout(() => this.modsManager.setupEvents(), 100);
        return modsContent;  // ← RETOURNER LE CONTENU
      case 'resourcepacks':
      case 'ressourcespacks':
        // ✅ Rediriger vers la vue mods avec le sous-onglet texture packs
        this.currentView = 'mods';
        this.modsManager.setCurrentCategory('texturepacks');
        const packContent = await this.modsManager.render();
        setTimeout(() => this.modsManager.setupEvents(), 100);
        return packContent;
      case 'theme': return this.renderThemeSettings();
      case 'help': return this.renderHelp();
      default: return '';
    }
  }

  normalizeViewName(view) {
    if (view === 'ressourcespacks') return 'resourcepacks';
    return view;
  }

  getGreetingMessage() {
  const hour = new Date().getHours();
  const username = this.authData?.username || 'Joueur';

  // Messages selon l'heure
  if (hour >= 5 && hour < 8) {
    const messages = [
      `Déjà debout, ${username} ?`,
      `Lève-tôt aujourd'hui, ${username} !`,
      `Bon réveil, ${username} !`,
      `Prêt pour une matinée gaming, ${username} ?`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else if (hour >= 8 && hour < 12) {
    const messages = [
      `Bonne matinée, ${username} !`,
      `Salut ${username}, bien dormi ?`,
      `Hello ${username} ! Prêt à jouer ?`,
      `Bonjour ${username} ! Belle journée pour jouer !`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else if (hour >= 12 && hour < 14) {
    const messages = [
      `Bon appétit, ${username} !`,
      `Pause déjeuner, ${username} ?`,
      `Midi pile, ${username} ! Tu as faim ?`,
      `C'est l'heure de manger, ${username} !`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else if (hour >= 14 && hour < 18) {
    const messages = [
      `Bon après-midi, ${username} !`,
      `Salut ${username}, comment va ta journée ?`,
      `L'après-midi parfait pour jouer, ${username} !`,
      `Re-bonjour ${username} ! Prêt à construire ?`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else if (hour >= 18 && hour < 22) {
    const messages = [
      `Bonne soirée, ${username} !`,
      `Salut ${username}, bien rentré ?`,
      `La soirée commence, ${username} !`,
      `Bonsoir ${username} ! Session nocturne ?`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else if (hour >= 22 || hour < 2) {
    const messages = [
      `Il se fait tard, ${username}...`,
      `Encore debout, ${username} ?`,
      `Session nocturne, ${username} ?`,
      `La nuit est à toi, ${username} !`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  else {
    const messages = [
      `Insomnie, ${username} ?`,
      `Tu devrais dormir, ${username}...`,
      `Nuit blanche, ${username} ?`,
      `Repose-toi un peu, ${username} !`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  }

  renderHomeView() {
    const uuid = this.authData?.uuid || null;
    const username = this.authData?.username || '';
    const srcs = [];
    if (this.authData?.type === 'microsoft' && uuid) {
      srcs.push(`https://minotar.net/avatar/${uuid}/128`);
    }
    if (username) {
      const u = encodeURIComponent(username);
      srcs.push(`https://minotar.net/avatar/${u}/128`);
    }
    const firstSrc = srcs[0] || (this.playerHead?.success ? this.playerHead.url : this.fallbackAvatar);
    const headUrl = this.playerHead?.success ? this.playerHead.url : firstSrc;
    
    const greetingMessage = this.getGreetingMessage();
    const selectedVersion = this.selectedProfile?.version || '26.1.2';
    const availableLoaders = this.getAvailableLoadersForVersion(selectedVersion);
    const activeLaunchLoader = this.getActiveLaunchLoader(selectedVersion);
    const loaderHint = activeLaunchLoader === 'vanilla'
      ? 'Minecraft se lancera sans loader.'
      : `Minecraft se lancera avec ${this.formatLoaderLabel(activeLaunchLoader)}.`;
    
    // Icône Microsoft SVG
    const microsoftIcon = `<svg width="20" height="20" viewBox="0 0 23 23" fill="none">
      <path d="M0 0h11v11H0V0z" fill="#f25022"/>
      <path d="M12 0h11v11H12V0z" fill="#00a4ef"/>
      <path d="M0 12h11v11H0V12z" fill="#7fba00"/>
      <path d="M12 12h11v11H12V12z" fill="#ffb900"/>
    </svg>`;
    
    return `
      <style>
        .dev-status-banner {
          margin: 20px 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 16px;
          position: relative;
        }
        .banner-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .banner-icon {
          color: #3b82f6;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .banner-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: #e2e8f0;
        }
        .banner-text strong {
          color: #60a5fa;
        }
        .banner-close {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .banner-close:hover {
          background: rgba(148, 163, 184, 0.1);
          color: #cbd5e1;
        }
        @media (max-width: 768px) {
          .banner-content {
            flex-direction: column;
            gap: 8px;
          }
          .banner-text {
            font-size: 13px;
          }
        }
      </style>
      <div class="home-view-modern">
        <!-- Hero Section avec Avatar -->
        <div class="hero-section">
          <div class="hero-background"></div>
          <div class="hero-content">
            <div class="player-avatar-large">
              <img 
                id="player-head-img"
                data-sources="${srcs.join('|')}"
                data-index="0"
                src="${headUrl}" 
                alt="Player Head"
                referrerpolicy="no-referrer"
                crossorigin="anonymous"
                onerror="this.onerror=null; this.src='${this.fallbackAvatar}'"
              >
              <div class="avatar-glow"></div>
            </div>
            <div class="hero-text">
              <h1 class="hero-title">${greetingMessage}</h1>
              <p class="hero-subtitle">
                <span style="display: inline-flex; align-items: center; gap: 6px;">${microsoftIcon} Compte Microsoft</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Bannière d'information sur le développement -->
        <div class="dev-status-banner">
          <div class="banner-content">
            <div class="banner-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div class="banner-text">
              <strong>Fin du développement majeur</strong> - Le launcher Velkora a atteint la fin de ses grandes fonctionnalités. Seules des corrections de bugs sont désormais planifiées. Les grosses mises à jour ne sont pas envisagées (pour le moment). GitHub reste disponible pour proposer des fonctionnalités et signaler des bugs.
            </div>
            <button class="banner-close" onclick="this.parentElement.parentElement.style.display='none'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Carte de Lancement Principale -->
        <div class="main-launch-card">
          <div class="launch-card-header">
            <div class="version-info">
              <span class="version-badge" id="version-badge-display">Minecraft ${selectedVersion}</span>
              <span class="ram-badge" id="ram-badge-display">${this.settings.ramAllocation || 4} GB RAM</span>
            </div>
            
            <select id="version-select" class="version-selector">
              <option value="26.1.2" ${this.selectedProfile?.version === '26.1.2' ? 'selected' : ''}>26.1.2</option>
              <option value="26.1.1" ${this.selectedProfile?.version === '26.1.1' ? 'selected' : ''}>26.1.1</option>
              <option value="1.21.11" ${this.selectedProfile?.version === '1.21.11' ? 'selected' : ''}>1.21.11</option>
              <option value="1.21.10" ${this.selectedProfile?.version === '1.21.10' ? 'selected' : ''}>1.21.10</option>
              <option value="1.21.9" ${this.selectedProfile?.version === '1.21.9' ? 'selected' : ''}>1.21.9</option>
              <option value="1.21.8" ${this.selectedProfile?.version === '1.21.8' ? 'selected' : ''}>1.21.8</option>
              <option value="1.21.7" ${this.selectedProfile?.version === '1.21.7' ? 'selected' : ''}>1.21.7</option>
              <option value="1.21.6" ${this.selectedProfile?.version === '1.21.6' ? 'selected' : ''}>1.21.6</option>
              <option value="1.21.5" ${this.selectedProfile?.version === '1.21.5' ? 'selected' : ''}>1.21.5</option>
              <option value="1.21.4" ${this.selectedProfile?.version === '1.21.4' ? 'selected' : ''}>1.21.4</option>
              <option value="1.21.3" ${this.selectedProfile?.version === '1.21.3' ? 'selected' : ''}>1.21.3</option>
              <option value="1.21.2" ${this.selectedProfile?.version === '1.21.2' ? 'selected' : ''}>1.21.2</option>
              <option value="1.21.1" ${this.selectedProfile?.version === '1.21.1' ? 'selected' : ''}>1.21.1</option>
              <option value="1.21" ${this.selectedProfile?.version === '1.21' ? 'selected' : ''}>1.21</option>
              <option value="1.20.6" ${this.selectedProfile?.version === '1.20.6' ? 'selected' : ''}>1.20.6</option>
              <option value="1.20.4" ${this.selectedProfile?.version === '1.20.4' ? 'selected' : ''}>1.20.4</option>
              <option value="1.20.2" ${this.selectedProfile?.version === '1.20.2' ? 'selected' : ''}>1.20.2</option>
              <option value="1.20.1" ${this.selectedProfile?.version === '1.20.1' ? 'selected' : ''}>1.20.1</option>
              <option value="1.20" ${this.selectedProfile?.version === '1.20' ? 'selected' : ''}>1.20</option>
              <option value="1.19.4" ${this.selectedProfile?.version === '1.19.4' ? 'selected' : ''}>1.19.4</option>
              <option value="1.19.2" ${this.selectedProfile?.version === '1.19.2' ? 'selected' : ''}>1.19.2</option>
              <option value="1.19" ${this.selectedProfile?.version === '1.19' ? 'selected' : ''}>1.19</option>
              <option value="1.18.2" ${this.selectedProfile?.version === '1.18.2' ? 'selected' : ''}>1.18.2</option>
              <option value="1.16.5" ${this.selectedProfile?.version === '1.16.5' ? 'selected' : ''}>1.16.5</option>
              <option value="1.12.2" ${this.selectedProfile?.version === '1.12.2' ? 'selected' : ''}>1.12.2</option>
              <option value="1.8.9" ${this.selectedProfile?.version === '1.8.9' ? 'selected' : ''}>1.8.9</option>
            </select>
          </div>

          ${availableLoaders.length > 0 ? `
            <div class="loader-submenu" style="opacity: 0.5; pointer-events: none; cursor: not-allowed;">
              <div class="loader-submenu-label">Mode de lancement</div>
              <p style="font-size: 12px; color: #94a3b8;">Modifiez le loader dans la section Mods</p>
            </div>
          ` : ''}

          <div id="launch-progress-container" class="launch-progress" style="display: none;">
            <div class="progress-text" id="launch-progress-text">Préparation...</div>
            <div class="progress-bar-container">
              <div id="launch-progress-bar" class="progress-bar"></div>
            </div>
          </div>

          <button class="launch-button-mega" id="launch-btn">
            <span class="launch-icon">${icons.zap}</span>
            <span class="launch-text">Lancer Minecraft</span>
            <span class="launch-hint">Appuyez sur Ctrl+L</span>
          </button>
        </div>

        <!-- Grille d'Informations -->
        <div class="info-grid">
          <!-- Statistiques de Session -->
          <div class="info-card stats-card">
            <div class="card-header">
              <span class="card-icon">${icons.barChart}</span>
              <h3>Session</h3>
            </div>
            <div class="stat-row">
              <span class="stat-label">Dernière connexion</span>
              <span class="stat-value">${this.selectedProfile?.lastPlayed || 'Jamais'}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Temps de jeu total</span>
              <span class="stat-value">N/A</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Parties jouées</span>
              <span class="stat-value">N/A</span>
            </div>
          </div>

          <!-- Accès Rapide -->
          <div class="info-card quick-actions-card">
            <div class="card-header">
              <span class="card-icon">${icons.zap}</span>
              <h3>Accès rapide</h3>
            </div>
            <div class="quick-actions">
              <button class="quick-action-btn" id="home-settings-btn">
                <span style="font-size: 14px;">${icons.settings}</span>
                <span>Paramètres</span>
              </button>
              <button class="quick-action-btn" id="home-mods-btn">
                <span style="font-size: 14px;">${icons.mods}</span>
                <span>Mods</span>
              </button>
              <button class="quick-action-btn" id="home-storage-btn">
                <span style="font-size: 14px;">${icons.folder}</span>
                <span>Dossier</span>
              </button>
            </div>
          </div>

          <!-- Serveurs Suggérés -->
          <div class="info-card servers-card">
            <div class="card-header">
              <span class="card-icon">${icons.globe}</span>
              <h3>Serveurs populaires</h3>
            </div>
            <div class="server-list" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
              <div class="server-item" data-server="mc.hypixel.net">
                <div class="server-dot online"></div>
                <div class="server-info">
                  <div class="server-name">Hypixel</div>
                  <div class="server-players">Vérification...</div>
                </div>
                <button class="server-join-btn" data-join-quick="mc.hypixel.net">Rejoindre</button>
              </div>
              <div class="server-item" data-server="play.cubecraft.net">
                <div class="server-dot online"></div>
                <div class="server-info">
                  <div class="server-name">CubeCraft</div>
                  <div class="server-players">Vérification...</div>
                </div>
                <button class="server-join-btn" data-join-quick="play.cubecraft.net">Rejoindre</button>
              </div>
              </div>
              <div class="server-item" data-server="play.blocksmc.com">
                <div class="server-dot online"></div>
                <div class="server-info">
                  <div class="server-name">BlocksMC</div>
                  <div class="server-players">Vérification...</div>
                </div>
                <button class="server-join-btn" data-join-quick="play.blocksmc.com">Rejoindre</button>
              </div>
              <div class="server-item" data-server="play.minehut.com">
                <div class="server-dot online"></div>
                <div class="server-info">
                  <div class="server-name">Minehut</div>
                  <div class="server-players">Vérification...</div>
                </div>
                <button class="server-join-btn" data-join-quick="play.minehut.com">Rejoindre</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .home-view-modern {
          padding: 0;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Hero Section */
        .hero-section {
          position: relative;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
          border-radius: 24px;
          padding: 48px;
          margin-bottom: 32px;
          overflow: hidden;
        }

        .hero-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 50%);
          animation: hero-pulse 8s ease-in-out infinite;
        }

        @keyframes hero-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .hero-content {
          position: relative;
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .player-avatar-large {
          position: relative;
          width: 120px;
          height: 120px;
        }

        .player-avatar-large img {
          width: 100%;
          height: 100%;
          border-radius: 20px;
          object-fit: cover;
          border: 4px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .avatar-glow {
          position: absolute;
          inset: -8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 24px;
          opacity: 0.3;
          filter: blur(20px);
          z-index: -1;
          animation: glow-pulse 3s ease-in-out infinite;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        .hero-text {
          flex: 1;
        }

        .hero-title {
          font-size: 36px;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0 0 8px 0;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 16px;
          color: #94a3b8;
          margin: 0;
        }

        /* Main Launch Card */
        .main-launch-card {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 20px;
          padding: 32px;
          margin-bottom: 32px;
        }

        .launch-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .version-info {
          display: flex;
          gap: 12px;
        }

        .version-badge, .ram-badge {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .version-badge {
          background: rgba(99, 102, 241, 0.2);
          color: #6366f1;
        }

        .ram-badge {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .version-selector {
          padding: 10px 16px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .version-selector:hover {
          border-color: #6366f1;
          background: rgba(15, 23, 42, 0.95);
        }

        .version-selector:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .loader-submenu {
          margin: 18px 0 20px;
          padding: 14px 16px;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
        }

        .loader-submenu-label {
          display: block;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .loader-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .loader-option-btn {
          padding: 10px 14px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .loader-option-btn:hover {
          border-color: #818cf8;
          color: #ffffff;
        }

        .loader-option-btn.active {
          background: rgba(99, 102, 241, 0.22);
          border-color: #6366f1;
          color: #ffffff;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }

        .loader-submenu-hint {
          margin: 10px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .launch-progress {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .progress-text {
          color: #94a3b8;
          font-size: 14px;
          margin-bottom: 12px;
          font-weight: 500;
        }

        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          transition: width 0.3s ease;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
        }

        .launch-button-mega {
          width: 100%;
          padding: 24px;
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          border: none;
          border-radius: 16px;
          color: white;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        }

        .launch-button-mega::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .launch-button-mega:hover::before {
          left: 100%;
        }

        .launch-button-mega:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
        }

        .launch-button-mega:active {
          transform: translateY(0);
        }

        .launch-icon {
          font-size: 24px;
        }

        .launch-text {
          font-size: 20px;
        }

        .launch-hint {
          position: absolute;
          right: 24px;
          font-size: 12px;
          opacity: 0.6;
          font-weight: 400;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .info-card {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.3s;
        }

        .info-card:hover {
          transform: translateY(-4px);
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }

        .card-icon {
          font-size: 24px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(99, 102, 241, 0.05);
        }

        .stat-row:last-child {
          border-bottom: none;
        }

        .stat-label {
          font-size: 14px;
          color: #94a3b8;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .quick-actions {
          display: grid;
          gap: 8px;
        }

        .quick-action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .quick-action-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
          transform: translateX(4px);
        }

        .server-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .server-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: rgba(99, 102, 241, 0.05);
          border-radius: 6px;
          transition: all 0.3s;
        }

        .server-item:hover {
          background: rgba(99, 102, 241, 0.1);
        }

        .servers-card.disabled {
          opacity: 0.5;
          filter: grayscale(0.7);
          pointer-events: none;
        }

        .server-join-btn[disabled] {
          background: rgba(75, 85, 99, 0.4) !important;
          color: #9ca3af !important;
          cursor: not-allowed;
        }

        .server-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .server-dot.online {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .server-info {
          flex: 1;
        }

        .server-name {
          font-size: 12px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 0px;
        }

        .server-players {
          font-size: 10px;
          color: #64748b;
        }

        .server-join-btn {
          padding: 4px 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 4px;
          color: white;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .server-join-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .news-item {
          padding: 12px 0;
          border-bottom: 1px solid rgba(99, 102, 241, 0.05);
        }

        .news-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .news-date {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .news-title {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 4px;
        }

        .news-excerpt {
          font-size: 12px;
          color: #94a3b8;
        }

        .news-card-item {
          white-space: normal;
          word-break: break-word;
          padding: 10px !important;
          margin: 6px 0 !important;
        }

        .news-card-item:hover {
          background: rgba(99, 102, 241, 0.15) !important;
          border-left-color: #8b5cf6 !important;
          transform: translateX(2px);
        }

        @media (max-width: 768px) {
          .hero-content {
            flex-direction: column;
            text-align: center;
          }

          .hero-title {
            font-size: 28px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .launch-hint {
            display: none;
          }
        }
      </style>
    `;
  }

  renderFriendsView() {
    return `
      <div class="view-container">
        <div class="view-header">
          <h1 class="view-title">${icons.users} Mes amis</h1>
          <button class="btn-add-modern" id="add-friend-btn">${icons.users} Ajouter un ami</button>
        </div>

        ${this.showAddFriend ? `
          <div class="create-card">
            <h3>Ajouter un ami</h3>
            <div class="input-group">
              <label class="input-label">Pseudo du joueur</label>
              <input type="text" class="input-field" id="friend-username" placeholder="Pseudo Minecraft">
            </div>
            <div class="button-group">
              <button class="btn-primary" id="save-friend-btn">${icons.check} Ajouter</button>
              <button class="btn-secondary" id="cancel-friend-btn">${icons.x} Annuler</button>
            </div>
          </div>
        ` : ''}

        ${this.friends.length === 0 ? `
          <div class="empty-state">
            <div style="font-size: 64px; margin-bottom: 20px;">👥</div>
            <h3>Aucun ami ajouté</h3>
            <p>Cliquez sur "Ajouter un ami" pour commencer à inviter vos amis !</p>
            <button class="btn-primary" id="add-friend-btn-empty" style="margin-top: 20px;">➕ Ajouter votre premier ami</button>
          </div>
        ` : `
          <div class="friends-grid">
            ${this.friends.map(f => `
              <div class="friend-card">
                <div class="friend-avatar" style="background: linear-gradient(135deg, ${f.online ? '#22c55e' : '#ef4444'}, ${f.online ? '#16a34a' : '#dc2626'});">${f.username[0].toUpperCase()}</div>
                <div class="friend-info">
                  <h3>${f.username}</h3>
                  <div class="friend-status ${f.online ? 'online' : 'offline'}">
                    ${f.online ? '<span style="color: #10b981;">En ligne</span>' : '<span style="color: #6b7280;">Hors ligne</span>'}
                  </div>
                </div>
                <button class="btn-icon" data-remove-friend="${f.id}" style="color: #ef4444;">${lucideIcons.trash3}</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // Utilitaire pour formater la taille des fichiers
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  renderServersView() {
    return `
      <div class="view-container" style="position: relative;">
        <h1 class="view-title">Serveurs populaires</h1>
        <p style="color: #64748b; margin-bottom: 30px;">Cliquez pour rejoindre directement un serveur</p>

        <div class="servers-grid" style="position: relative; pointer-events: auto;">
          ${this.popularServers.map(s => `
            <div class="server-card" data-server-ip="${s.ip}">
              <div class="server-icon" style="background-image: url('${s.icon}'); background-size: cover; background-position: center; background-repeat: no-repeat; width: 60px; height: 60px; border-radius: 12px; flex-shrink: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); image-rendering: crisp-edges;"></div>
              <div class="server-info">
                <h3>${s.name}</h3>
                <p class="server-ip">${s.ip}</p>
                <p class="server-desc">${s.description}</p>
                <div class="server-players">${icons.users} ${s.players} joueurs</div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px; margin-left: auto;">
                <button class="btn-join" data-join-server="${s.ip}" style="">${icons.zap} Rejoindre</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 40px; pointer-events: auto; display: flex; gap: 15px; flex-wrap: wrap;">
        </div>

        <div style="margin-top: 60px; pointer-events: auto;">
          <h2 style="font-size: 18px; margin-bottom: 15px; color: #e2e8f0;">Serveur personnalisé</h2>
          <div class="custom-server-input" style="display: flex; flex-direction: column; gap: 12px; max-width: 400px;">
            <input type="text" class="input-field" id="custom-server-ip" placeholder="Ex: play.hypixel.net" style="width: 100%;">
            <button class="btn-primary" id="join-custom-server" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">${icons.globe} Rejoindre</button>
          </div>
        </div>
      </div>

      <style>
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
      </style>
    `;
  }

  // ✅ PAGE VERSIONS
  renderVersionsView() {
    const html = `
      <div class="view-container">
        <div style="margin-bottom: 40px;">
          <h1 class="view-title">Versions</h1>
          <p style="color: #94a3b8; margin-top: 12px; font-size: 15px;">
            Informations sur le launcher et les mises à jour disponibles
          </p>
        </div>

        <!-- Carte version actuelle -->
        <div style="
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Version Actuelle</p>
              <h2 style="color: #e2e8f0; margin: 0 0 4px 0; font-size: 28px; font-weight: 700;">
                ${LauncherVersion.getVersionString()}
              </h2>
              <p style="color: #64748b; margin: 0; font-size: 13px;">Build ${LauncherVersion.getBuild()}</p>
            </div>
            <div id="update-status-badge" style="
              padding: 12px 20px;
              background: rgba(34, 197, 94, 0.2);
              border: 1px solid rgba(34, 197, 94, 0.4);
              border-radius: 8px;
              color: #4ade80;
              font-weight: 600;
              font-size: 13px;
            ">
              ✓ À jour
            </div>
          </div>
        </div>

        <!-- Grille d'informations -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 30px;">
          <!-- Carte 1: Mises à jour -->
          <div style="
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(99, 102, 241, 0.15);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s;
          ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 24px;">${icons.download}</span>
              <h3 style="margin: 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">Mises à jour</h3>
            </div>
            <p style="color: #94a3b8; margin: 0 0 16px 0; font-size: 14px;">Vérifier les dernières mises à jour disponibles</p>
            <button id="btn-check-updates" class="btn-primary" style="width: 100%; font-size: 13px; padding: 10px;">
              Vérifier maintenant
            </button>
          </div>

          <!-- Carte 2: Historique -->
          <div style="
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(99, 102, 241, 0.15);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s;
          ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 24px;">${icons.calendar}</span>
              <h3 style="margin: 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">Historique</h3>
            </div>
            <p style="color: #94a3b8; margin: 0 0 16px 0; font-size: 14px;">Consulter l'historique des mises à jour</p>
            <button id="btn-view-history" class="btn-primary" style="width: 100%; font-size: 13px; padding: 10px;">
              Voir l'historique
            </button>
          </div>

          <!-- Carte 3: Changelog -->
          <div style="
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(99, 102, 241, 0.15);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s;
          ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="font-size: 24px;">${icons.newspaper}</span>
              <h3 style="margin: 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">Changelog</h3>
            </div>
            <p style="color: #94a3b8; margin: 0 0 16px 0; font-size: 14px;">Lire les derniers changements et améliorations</p>
            <button id="btn-read-changelog" class="btn-primary" style="width: 100%; font-size: 13px; padding: 10px;">
              Lire le changelog
            </button>
          </div>
        </div>

        <!-- Section informations -->
        <div style="
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 24px;
        ">
          <h3 style="margin: 0 0 16px 0; color: #6366f1; display: flex; align-items: center; gap: 8px; font-size: 16px;">
            ℹ️ Informations sur le launcher
          </h3>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <p style="color: #cbd5e1; margin: 0 0 6px 0; font-weight: 600; font-size: 13px;">Nom du launcher</p>
              <p style="color: #94a3b8; margin: 0; font-size: 14px;">${LauncherVersion.getName()}</p>
            </div>
            <div>
              <p style="color: #cbd5e1; margin: 0 0 6px 0; font-weight: 600; font-size: 13px;">Numéro de build</p>
              <p style="color: #94a3b8; margin: 0; font-size: 14px;">${LauncherVersion.getBuild()}</p>
            </div>
            <div>
              <p style="color: #cbd5e1; margin: 0 0 6px 0; font-weight: 600; font-size: 13px;">Mises à jour automatiques</p>
              <p style="color: #94a3b8; margin: 0; font-size: 14px;">Activées</p>
            </div>
            <div>
              <p style="color: #cbd5e1; margin: 0 0 6px 0; font-weight: 600; font-size: 13px;">État</p>
              <p style="color: #4ade80; margin: 0; font-size: 14px;">Opérationnel</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attacher les listeners après rendu
    setTimeout(() => {
      const checkBtn = document.getElementById('btn-check-updates');
      const historyBtn = document.getElementById('btn-view-history');
      const changelogBtn = document.getElementById('btn-read-changelog');

      // Auto-check updates on render and update the status badge
      (async () => {
        try {
          const badge = document.getElementById('update-status-badge');
          if (!badge) return;
          badge.textContent = 'Vérification...';
          const result = await ipcRenderer.invoke('check-updates').catch(() => null);
          if (result && result.hasUpdate) {
            badge.style.background = 'rgba(249,115,22,0.18)';
            badge.style.borderColor = 'rgba(249,115,22,0.35)';
            badge.style.color = '#f97316';
            badge.textContent = `Mise à jour: v${result.latestVersion}`;
          } else if (result && !result.hasUpdate) {
            badge.style.background = 'rgba(34,197,94,0.2)';
            badge.style.borderColor = 'rgba(34,197,94,0.4)';
            badge.style.color = '#4ade80';
            badge.textContent = 'À jour';
          } else {
            badge.style.background = 'rgba(239,68,68,0.12)';
            badge.style.borderColor = 'rgba(239,68,68,0.25)';
            badge.style.color = '#ef4444';
            badge.textContent = 'Erreur vérif.';
          }
        } catch (e) {
          console.error('Auto check updates error:', e);
        }
      })();

      if (checkBtn) {
        checkBtn.addEventListener('click', async () => {
          if (checkBtn.disabled) return;
          const originalText = checkBtn.textContent;
          checkBtn.disabled = true;
          checkBtn.textContent = 'Vérification...';
          try {
            const result = await ipcRenderer.invoke('check-updates');
            if (result && result.hasUpdate) {
              this.ui.showToast({ title: 'Mise à jour disponible', message: `v${result.latestVersion} disponible`, type: 'success', duration: 8000 });
              const confirmed = await this.ui.showConfirm({
                title: 'Installer la mise à jour ?',
                message: `Une mise à jour v${result.latestVersion} est disponible. Voulez-vous la télécharger et l'installer ?`,
                confirmLabel: 'Installer',
                cancelLabel: 'Plus tard',
                type: 'info'
              });
              if (confirmed) {
                const installRes = await ipcRenderer.invoke('install-update');
                if (installRes && installRes.success) {
                  this.ui.showToast({ title: 'Installation', message: installRes.message || 'Installation lancée', type: 'success' });
                } else {
                  this.ui.showToast({ title: 'Erreur', message: installRes?.error || installRes?.message || 'Impossible d\'installer', type: 'error' });
                }
              }
            } else {
              const msg = result?.error ? `Aucune mise à jour (${result.error})` : 'Vous êtes à jour';
              this.ui.showToast({ title: 'Aucun update', message: msg, type: 'info' });
            }
          } catch (err) {
            console.error('Erreur check-updates:', err);
            this.ui.showToast({ title: 'Erreur', message: err?.message || String(err), type: 'error' });
          } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = originalText;
          }
        });
      }

      if (historyBtn) {
        historyBtn.addEventListener('click', () => {
          ipcRenderer.send('open-external', 'https://github.com/pharos-off/Velkora/releases');
          this.ui.showToast({ title: 'Historique', message: 'Ouverture de la page des releases', type: 'info' });
        });
      }

      if (changelogBtn) {
        changelogBtn.addEventListener('click', () => {
          ipcRenderer.send('open-external', 'https://github.com/pharos-off/Velkora/blob/main/CHANGELOG.md');
          this.ui.showToast({ title: 'Changelog', message: 'Ouverture du changelog', type: 'info' });
        });
      }
    }, 100);

    return html;
  }

  renderPartnersView() {
    const partners = [
      { 
        name: 'PharosSMP',
        logo: icons.shield,
        description: 'Un serveur SMP privé pour les membres de la communauté Pharos',
        website: 'http://176.161.97.30',
        joinUrl: '176.161.97.30'
      },
      { 
        name: 'LunaVerse',
        logo: icons.moon,
        description: 'Un serveur communautaire rassemblant plusieurs projets !',
        website: '',
        joinUrl: ''
      }
    ];

    return `
      <div class="view-container">
        <div class="view-header">
          <h1 class="view-title">${icons.handshake} Nos Partenaires</h1>
        </div>

        <p style="color: #94a3b8; margin-bottom: 30px; font-size: 15px;">
          Découvrez nos partenaires officiels et les meilleures communautés Minecraft
        </p>

        <div class="partners-grid">
          ${partners.map((partner, index) => `
            <div class="partner-card" style="animation: slideIn 0.5s ease-out ${index * 0.1}s both;">
              <div class="partner-logo" style="display:flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:18px; background: rgba(99, 102, 241, 0.12); box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.1);">${partner.logo}</div>
              
              <div class="partner-content">
                <h3>${partner.name}</h3>
                <p class="partner-description">${partner.description}</p>
                
                <div class="partner-badges">
                  <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #6366f1;">Partenaire officiel</span>
                </div>
              </div>

              <div class="partner-actions">
                <button class="btn-partner" data-visit-partner="${partner.website}" style="flex: 1;">
                  🌐 Visiter
                </button>
                <button class="btn-partner" data-join-partner="${partner.joinUrl}" style="flex: 1; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                  Rejoindre
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 50px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 16px; padding: 30px; text-align: center;">
          <h2 style="font-size: 22px; color: #e2e8f0; margin-bottom: 10px;">Devenir Partenaire 🌟</h2>
          <p style="color: #94a3b8; margin-bottom: 20px;">
            Vous avez un serveur ou une communauté Minecraft ? Contactez-nous pour devenir partenaire officiel !
          </p>
          <button class="btn-primary" id="contact-partner-btn" style="margin: 0 auto;">
            📧 Nous Contacter
          </button>
        </div>
      </div>

      <style>
        .partners-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .partner-card {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 16px;
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .partner-card:hover {
          border-color: rgba(99, 102, 241, 0.3);
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.2);
          background: rgba(30, 41, 59, 0.8);
        }

        .partner-logo {
          font-size: 48px;
          text-align: center;
        }

        .partner-content {
          flex: 1;
        }

        .partner-content h3 {
          font-size: 18px;
          color: #e2e8f0;
          margin: 0 0 8px 0;
          font-weight: 700;
        }

        .partner-description {
          color: #94a3b8;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }

        .partner-badges {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .partner-actions {
          display: flex;
          gap: 10px;
        }

        .btn-partner {
          flex: 1;
          padding: 10px 16px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        .btn-partner:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
        }

        .btn-partner:active {
          transform: translateY(0px);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }
      </style>
    `;
  }

  renderNewsView() {
    if (this.news.length === 0) {
      return `
        <div class="view-container">
          <h1 class="view-title">${icons.newspaper} Actualités</h1>
          <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
            <p>${icons.newspaper} Aucune actualité disponible pour le moment</p>
          </div>
        </div>
      `;
    }

    const categories = {};
    this.news.forEach(news => {
      const category = news.category || 'general';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(news);
    });

    const categoryOrder = ['all', 'launcher', 'minecraft', 'servers', 'mods', 'events', 'general'];
    const allCategories = Array.from(new Set([...categoryOrder, ...Object.keys(categories)]));

    const categoryLabels = {
      all: 'Toutes',
      launcher: 'Launcher',
      minecraft: 'Minecraft',
      servers: 'Serveurs',
      mods: 'Mods',
      events: 'Événements',
      general: 'Général'
    };

    const activeCategory = this.newsCategoryFilter || 'all';
    const filteredNews = activeCategory === 'all'
      ? this.news
      : this.news.filter(news => (news.category || 'general') === activeCategory);

    const filteredCategories = {};
    filteredNews.forEach(news => {
      const category = news.category || 'general';
      if (!filteredCategories[category]) {
        filteredCategories[category] = [];
      }
      filteredCategories[category].push(news);
    });

    return `
      <div class="view-container" style="max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px;">
          <div>
            <h1 class="view-title" style="margin: 0;">${icons.newspaper} Actualités</h1>
            <div style="color: #94a3b8; margin-top: 6px; font-size: 14px;">${filteredNews.length} actualité${filteredNews.length > 1 ? 's' : ''} affichée${filteredNews.length > 1 ? 's' : ''}</div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${allCategories.map(category => `
              <button type="button" data-news-filter="${category}" class="news-filter-pill${activeCategory === category ? ' active' : ''}">
                ${categoryLabels[category] || category}
                ${category !== 'all' ? `<span style="margin-left: 6px; background: rgba(255,255,255,0.12); padding: 0 8px; border-radius: 999px; font-size: 12px;">${categories[category]?.length || 0}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display: grid; gap: 24px;">
          ${Object.entries(filteredCategories).map(([category, items]) => `
            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); padding: 16px; border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
                <h2 style="margin: 0; font-size: 16px; color: #e2e8f0; display: flex; align-items: center; gap: 8px;">
                  <span>${categoryLabels[category] || category}</span>
                  <span style="background: rgba(99, 102, 241, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #a5b4fc;">${items.length}</span>
                </h2>
              </div>
              <div style="display: grid; gap: 1px; background: rgba(99, 102, 241, 0.1);">
                ${items.map(news => `
                  <div class="news-card-item" data-news-id="${news.id}" style="background: rgba(15, 23, 42, 0.6); padding: 20px; cursor: pointer; transition: all 0.3s; border-left: 4px solid transparent;">
                    <div style="display: flex; gap: 16px; align-items: flex-start;">
                      <div style="font-size: 32px; flex-shrink: 0;">${news.image || icons.newspaper}</div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                          <h3 style="margin: 0; font-size: 16px; color: #e2e8f0; font-weight: 600;">${news.title}</h3>
                          ${news.featured ? '<span style="background: rgba(255, 193, 7, 0.3); color: #fcd34d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">EN VEDETTE</span>' : ''}
                        </div>
                        <p style="margin: 0 0 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${news.excerpt}</p>
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: #64748b; font-size: 12px;">
                          <span style="display: inline-flex; align-items: center; gap: 6px;">${icons.calendar} ${new Date(news.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          ${news.category ? `<span style="background: rgba(99, 102, 241, 0.2); padding: 2px 8px; border-radius: 4px;">${categoryLabels[news.category] || news.category}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <style>
          .news-filter-pill {
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.8);
            color: #cbd5e1;
            padding: 10px 16px;
            border-radius: 999px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .news-filter-pill.active {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.9));
            color: #ffffff;
            border-color: transparent;
            transform: translateY(-1px);
          }
          .news-card-item:hover {
            background: rgba(99, 102, 241, 0.08) !important;
            border-left-color: rgba(99, 102, 241, 0.5) !important;
            transform: translateX(4px);
          }
        </style>
      </div>
    `;
  }

  renderScreenshotsView() {
    const html = `
      <div class="view-container" style="padding: 40px;">
        <!-- Modal pour visualiser les screenshots -->
        <div id="screenshot-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); z-index: 1000; align-items: center; justify-content: center; flex-direction: column;">
          <button id="modal-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: white; padding: 10px 15px; border-radius: 12px; cursor: pointer; font-size: 14px;">Fermer</button>
          <div style="display: flex; gap: 20px; align-items: center; max-width: 90vw; max-height: 80vh;">
            <button id="modal-prev-btn" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); color: #e2e8f0; width: 52px; height: 52px; border-radius: 14px; cursor: pointer; display:flex; align-items:center; justify-content:center;">${icons.chevronLeft}</button>
            <img id="modal-image" src="" style="max-width: 75vw; max-height: 75vh; border-radius: 16px; object-fit: contain; box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);">
            <button id="modal-next-btn" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); color: #e2e8f0; width: 52px; height: 52px; border-radius: 14px; cursor: pointer; display:flex; align-items:center; justify-content:center;">${icons.chevronRight}</button>
          </div>
          <div id="modal-info" style="color: #cbd5e1; margin-top: 20px; text-align: center; font-size: 14px;"></div>
        </div>

        <!-- Screenshots Section -->
        <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 16px; padding: 28px; margin-bottom: 30px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <span style="font-size: 24px;">${icons.image}</span>
            <h2 style="font-size: 20px; color: #e2e8f0; margin: 0; font-weight: 700;">Screenshots</h2>
          </div>
          <p style="color: #cbd5e1; margin-bottom: 20px; line-height: 1.5;">Visualisez et organisez tous vos screenshots Minecraft. Cliquez sur une vignette pour l'agrandir.</p>
          <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <button id="btn-open-screenshots" class="btn-primary" style="flex: 1; padding: 12px;">
              <span style="display: inline-flex; width: 18px; height: 18px; margin-right: 8px;">${icons.folder}</span> Ouvrir le dossier
            </button>
            <button id="btn-refresh-screenshots" class="btn-secondary" style="flex: 1; padding: 12px;">
              <span style="display: inline-flex; width: 16px; height: 16px; margin-right: 8px;">${icons.refresh}</span> Rafraîchir
            </button>
          </div>
          <div id="screenshots-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; min-height: 200px;">
            <div style="grid-column: 1 / -1; color: #cbd5e1; text-align: center; padding: 40px; color: #94a3b8;">Chargement des screenshots...</div>
          </div>
          <div id="screenshots-info" style="padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; color: #94a3b8; font-size: 12px;">
            Chargement...
          </div>
        </div>

          <!-- Saves Section -->
          <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 16px; padding: 28px; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <span style="font-size: 24px;">${icons.download}</span>
              <h2 style="font-size: 20px; color: #e2e8f0; margin: 0; font-weight: 700;">Sauvegardes</h2>
            </div>
            <p style="color: #cbd5e1; margin-bottom: 20px; line-height: 1.5;">Gérez toutes vos sauvegardes de mondes Minecraft. Sauvegardez, dupliquez ou supprimez vos mondes facilement avec notre gestionnaire intégré.</p>
            <button id="btn-open-saves" class="btn-primary" style="width: 100%; margin-bottom: 12px; padding: 14px;">
              <span style="display: inline-flex; width: 18px; height: 18px; margin-right: 8px;">${icons.folder}</span> Ouvrir le dossier
            </button>
            <button id="btn-refresh-saves" class="btn-secondary" style="width: 100%; padding: 12px;">
              <span style="display: inline-flex; width: 16px; height: 16px; margin-right: 8px;">${icons.refresh}</span> Rafraîchir
            </button>
            <div id="saves-info" style="margin-top: 20px; padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; color: #94a3b8; font-size: 12px;">
              Chargement...
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners after rendering
    setTimeout(() => {
      const openScreenshotsBtn = document.getElementById('btn-open-screenshots');
      const refreshScreenshotsBtn = document.getElementById('btn-refresh-screenshots');
      const openSavesBtn = document.getElementById('btn-open-saves');
      const refreshSavesBtn = document.getElementById('btn-refresh-saves');
      const screenshotsInfo = document.getElementById('screenshots-info');
      const savesInfo = document.getElementById('saves-info');
      const screenshotsGallery = document.getElementById('screenshots-gallery');
      const modal = document.getElementById('screenshot-modal');
      const modalImage = document.getElementById('modal-image');
      const modalInfo = document.getElementById('modal-info');
      const modalCloseBtn = document.getElementById('modal-close-btn');
      const modalPrevBtn = document.getElementById('modal-prev-btn');
      const modalNextBtn = document.getElementById('modal-next-btn');
      
      let screenshots = [];
      let currentModalIndex = 0;

      const loadScreenshots = async () => {
        screenshotsGallery.innerHTML = '<div style="grid-column: 1 / -1; color: #cbd5e1; text-align: center; padding: 40px; color: #94a3b8;">Chargement...</div>';
        try {
          screenshots = await ipcRenderer.invoke('get-screenshots-list');
          const result = await ipcRenderer.invoke('get-screenshots-count');
          screenshotsInfo.textContent = `${result.count} screenshot(s) trouvé(s)`;
          
          if (screenshots.length === 0) {
            screenshotsGallery.innerHTML = '<div style="grid-column: 1 / -1; color: #cbd5e1; text-align: center; padding: 40px; color: #94a3b8;">Aucun screenshot trouvé</div>';
            return;
          }
          
          screenshotsGallery.innerHTML = screenshots.map((screenshot, index) => `
            <div class="screenshot-thumbnail" style="cursor: pointer; border-radius: 8px; overflow: hidden; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); transition: all 0.2s ease;" data-index="${index}">
              <img src="${screenshot.url}" style="width: 100%; height: 150px; object-fit: cover; display: block;">
              <div style="padding: 8px; font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${screenshot.name}</div>
            </div>
          `).join('');
          
          // Add click listeners to thumbnails
          document.querySelectorAll('.screenshot-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
              const index = parseInt(thumb.getAttribute('data-index'));
              openScreenshotModal(index);
            });
            thumb.addEventListener('mouseover', () => {
              thumb.style.borderColor = 'rgba(99, 102, 241, 0.8)';
              thumb.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.3)';
            });
            thumb.addEventListener('mouseout', () => {
              thumb.style.borderColor = 'rgba(99, 102, 241, 0.3)';
              thumb.style.boxShadow = 'none';
            });
          });
        } catch (error) {
          console.error('Erreur chargement screenshots:', error);
          screenshotsGallery.innerHTML = '<div style="grid-column: 1 / -1; color: #cbd5e1; text-align: center; padding: 40px; color: #94a3b8;">Erreur lors du chargement</div>';
        }
      };

      const openScreenshotModal = (index) => {
        currentModalIndex = index;
        const screenshot = screenshots[index];
        modalImage.src = screenshot.url;
        modalInfo.textContent = `${index + 1} / ${screenshots.length} - ${screenshot.name}`;
        modal.style.display = 'flex';
      };

      const closeModal = () => {
        modal.style.display = 'none';
      };

      const showNextScreenshot = () => {
        currentModalIndex = (currentModalIndex + 1) % screenshots.length;
        const screenshot = screenshots[currentModalIndex];
        modalImage.src = screenshot.url;
        modalInfo.textContent = `${currentModalIndex + 1} / ${screenshots.length} - ${screenshot.name}`;
      };

      const showPrevScreenshot = () => {
        currentModalIndex = (currentModalIndex - 1 + screenshots.length) % screenshots.length;
        const screenshot = screenshots[currentModalIndex];
        modalImage.src = screenshot.url;
        modalInfo.textContent = `${currentModalIndex + 1} / ${screenshots.length} - ${screenshot.name}`;
      };

      openScreenshotsBtn?.addEventListener('click', async () => {
        const folder = await ipcRenderer.invoke('get-screenshots-folder').catch(() => '');
        if (folder) {
          ipcRenderer.send('open-folder', folder);
        }
      });

      refreshScreenshotsBtn?.addEventListener('click', loadScreenshots);

      modalCloseBtn?.addEventListener('click', closeModal);
      modalPrevBtn?.addEventListener('click', showPrevScreenshot);
      modalNextBtn?.addEventListener('click', showNextScreenshot);

      // Close modal on background click
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (modal.style.display === 'flex') {
          if (e.key === 'ArrowRight') showNextScreenshot();
          if (e.key === 'ArrowLeft') showPrevScreenshot();
          if (e.key === 'Escape') closeModal();
        }
      });

      openSavesBtn?.addEventListener('click', async () => {
        const folder = await ipcRenderer.invoke('get-saves-folder').catch(() => '');
        if (folder) {
          ipcRenderer.send('open-folder', folder);
        }
      });

      refreshSavesBtn?.addEventListener('click', async () => {
        savesInfo.textContent = 'Chargement...';
        const result = await ipcRenderer.invoke('get-saves-count').catch(() => ({ count: 0, folder: '' }));
        savesInfo.textContent = `${result.count} monde(s) sauvegardé(s)`;
      });

      // Initial load
      (async () => {
        await loadScreenshots();
        const savesResult = await ipcRenderer.invoke('get-saves-count').catch(() => ({ count: 0 }));
        savesInfo.textContent = `${savesResult.count} monde(s) sauvegardé(s)`;
      })();
    }, 100);

    return html;
  }

  async renderTexturePacksView() {
    const [resourcepacksFolder, installedPacks] = await Promise.all([
      ipcRenderer.invoke('get-resourcepacks-folder').catch(() => ''),
      ipcRenderer.invoke('get-installed-resourcepacks').catch(() => [])
    ]);
    const selectedProfile = this.selectedProfile || this.profiles?.[0] || null;
    const gameVersion = selectedProfile?.version || '';
    const packs = Array.isArray(installedPacks) ? installedPacks : [];

    return `
      <div class="view-container" style="padding: 40px;">
        <div class="view-header" style="margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div>
            <h1 class="view-title" style="display: flex; align-items: center; gap: 12px;"><i class="bi bi-image"></i> Texture Packs</h1>
            <p style="color: #94a3b8; margin-top: 10px;">${packs.length} pack(s) installé(s) • Téléchargez et gérez vos packs de textures.</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="btn-open-resourcepacks-folder" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Ouvrir le dossier</button>
            <button id="btn-refresh-resourcepacks" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Rafraichir</button>
          </div>
        </div>

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px;">
            <strong style="color: #6366f1;">Chemin d'installation :</strong> ${this.escapeHtml(resourcepacksFolder || 'Non disponible')}
          </div>
          <div style="color: #94a3b8; font-size: 12px;">
            Version ciblée : ${this.escapeHtml(gameVersion || 'Inconnue')} • Les packs compatibles sont recherchés sur Modrinth.
          </div>
        </div>

        ${packs.length === 0 ? this.renderEmptyResourcePacks() : this.renderInstalledResourcePacksList(packs)}
        ${this.renderResourcePackStats(packs)}
        ${this.renderResourcePackInfo()}

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #e2e8f0; font-size: 15px; font-weight: 700; margin-bottom: 12px;">Recherche Modrinth</div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <input id="resourcepack-search-input" type="text" placeholder="Rechercher un texture pack..." style="flex: 1; min-width: 260px; padding: 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0; font-size: 14px;">
            <button id="btn-search-resourcepacks" class="btn-primary" style="padding: 10px 18px; width: auto;">Rechercher</button>
          </div>
        </div>

        <div id="resourcepacks-results" style="max-width: 1000px;">
          <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 16px;">${icons.download}</div>
            <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Recherchez un texture pack</h3>
            <p style="color: #94a3b8; margin: 0;">Les téléchargements seront placés dans le dossier resourcepacks du jeu.</p>
          </div>
        </div>
      </div>
    `;
  }

  renderEmptyResourcePacks() {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px;">
        <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 16px;">${icons.download}</div>
          <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Aucun texture pack installe</h3>
          <p style="color: #94a3b8; margin: 0;">Utilisez la recherche Modrinth ci-dessous pour telecharger votre premier pack.</p>
        </div>
      </div>
    `;
  }

  renderInstalledResourcePacksList(packs) {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <h2 style="margin: 0; color: #e2e8f0; font-size: 20px;">Packs installes</h2>
          <div style="color: #94a3b8; font-size: 12px;">Cliquez sur un pack pour voir ses details.</div>
        </div>
        <div id="resourcepacks-list-container" style="display: block; width: 100%;">
          ${packs.map((pack) => this.renderResourcePackItem(pack)).join('')}
        </div>
      </div>
    `;
  }

  renderResourcePackItem(pack) {
    const details = [
      `Fichier : ${pack.fileName || 'Inconnu'}`,
      `Type : ${pack.type === 'folder' ? 'Dossier' : 'Archive'}`,
      `Taille : ${pack.size || 'N/A'}`
    ].join(' • ');

    return `
      <div class="resourcepack-item" data-pack-name="${this.escapeHtml(pack.name || '')}" data-file-name="${this.escapeHtml(pack.fileName || '')}" data-pack-path="${this.escapeHtml(pack.path || '')}" data-pack-size="${this.escapeHtml(pack.size || '')}" data-pack-type="${this.escapeHtml(pack.type || '')}" data-imported-at="${this.escapeHtml(pack.importedAt || '')}" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; transition: all 0.3s; width: 100%; min-width: 0; margin-bottom: 12px; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <div style="width: 20px; text-align: center; flex-shrink: 0;">${pack.type === 'folder' ? icons.folder : icons.image}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${this.escapeHtml(pack.name || pack.fileName || 'Texture pack')}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.escapeHtml(details)}
            </div>
          </div>
        </div>
        <button class="btn-delete-resourcepack" data-pack-path="${this.escapeHtml(pack.path || '')}" data-pack-name="${this.escapeHtml(pack.name || '')}" title="Supprimer ce texture pack" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 8px; transition: all 0.3s; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0;">
          ${lucideIcons.trash3}
        </button>
      </div>
    `;
  }

  renderResourcePackStats(packs) {
    const folderCount = packs.filter((pack) => pack.type === 'folder').length;
    const archiveCount = packs.length - folderCount;
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        ${this.renderStatCard('Packs installes', packs.length, icons.download)}
        ${this.renderStatCard('Archives', archiveCount, icons.archive, '#22c55e')}
        ${this.renderStatCard('Dossiers', folderCount, icons.folder, '#f59e0b')}
      </div>
    `;
  }

  renderStatCard(label, value, icon, color = '#e2e8f0') {
    return `
      <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
        <div style="color: ${color}; font-weight: 600; margin-bottom: 4px;">${value}</div>
        <div style="color: #94a3b8; font-size: 12px;">${label}</div>
      </div>
    `;
  }

  renderResourcePackInfo() {
    return `
      <div style="max-width: 1000px; padding: 20px; margin-bottom: 30px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px;">
        <p style="color: #cbd5e1; margin: 0; font-size: 14px;">
          <strong style="color: #6366f1;">Info :</strong> Les noms longs sont tronques dans la liste, mais vous pouvez cliquer sur un pack pour afficher ses details complets ou le supprimer.
        </p>
      </div>
    `;
  }

  // ✅ PAGE ACTUALITÉS - 100% DYNAMIQUE DEPUIS JSON
  renderNewsView() {
    if (!this.news || this.news.length === 0) {
      return `
        <div class="view-container">
          <h1 class="view-title">${icons.newspaper} Actualités</h1>
          <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
            <p>${icons.newspaper} Aucune actualité disponible pour le moment</p>
          </div>
        </div>
      `;
    }

    // Grouper les actualités par catégorie
    const categories = {};
    this.news.forEach(news => {
      if (!categories[news.category]) {
        categories[news.category] = [];
      }
      categories[news.category].push(news);
    });

    const categoryLabels = {
      launcher: 'Launcher',
      minecraft: 'Minecraft',
      servers: 'Serveurs',
      mods: 'Mods',
      events: 'Événements',
      general: 'Général'
    };

    return `
      <div class="view-container" style="max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
          <h1 class="view-title" style="margin: 0;">${icons.newspaper} Actualités</h1>
          <span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">
            ${this.news.length} actualité${this.news.length > 1 ? 's' : ''}
          </span>
        </div>

        <div style="display: grid; gap: 24px;">
          ${Object.entries(categories).map(([category, items]) => `
            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); padding: 16px; border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
                <h2 style="margin: 0; font-size: 16px; color: #e2e8f0; display: flex; align-items: center; gap: 8px;">
                  <span>${categoryLabels[category] || category}</span>
                  <span style="background: rgba(99, 102, 241, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #a5b4fc;">${items.length}</span>
                </h2>
              </div>
              <div style="display: grid; gap: 1px; background: rgba(99, 102, 241, 0.1);">
                ${items.map(news => `
                  <div class="news-card-item" data-news-id="${news.id}" style="background: rgba(15, 23, 42, 0.6); padding: 20px; cursor: pointer; transition: all 0.3s; border-left: 4px solid transparent;">
                    <div style="display: flex; gap: 16px; align-items: flex-start;">
                      <div style="font-size: 32px; flex-shrink: 0;">${news.image || icons.newspaper}</div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                          <h3 style="margin: 0; font-size: 16px; color: #e2e8f0; font-weight: 600;">${news.title}</h3>
                          ${news.featured ? '<span style="background: rgba(255, 193, 7, 0.3); color: #fcd34d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">★ EN VEDETTE</span>' : ''}
                        </div>
                        <p style="margin: 0 0 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${news.excerpt}</p>
                        <div style="display: flex; align-items: center; gap: 12px; color: #64748b; font-size: 12px;">
                          <span style="display: inline-flex; align-items: center; gap: 6px;">${icons.calendar} ${new Date(news.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          ${news.category ? `<span style="background: rgba(99, 102, 241, 0.2); padding: 2px 8px; border-radius: 4px;">${categoryLabels[news.category] || news.category}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 14px; padding: 40px; margin-top: 40px; text-align: center;">
          <h2 style="color: #e2e8f0; font-size: 24px; font-weight: 700; margin-bottom: 12px;">📧 Restez informé</h2>
          <p style="color: #cbd5e1; margin-bottom: 20px;">Abonnez-vous à notre newsletter pour recevoir les dernières actualités</p>
          <div style="display: flex; gap: 10px; max-width: 500px; margin: 0 auto;">
            <input type="email" id="newsletter-email" class="input-field" placeholder="Votre email" style="flex: 1;">
            <button id="newsletter-btn" class="btn-primary" style="white-space: nowrap;">S'abonner</button>
          </div>
        </div>

        <style>
          .news-card-item:hover {
            background: rgba(99, 102, 241, 0.08) !important;
            border-left-color: rgba(99, 102, 241, 0.5) !important;
            transform: translateX(4px);
          }
        </style>
      </div>
    `;
  }

  setupLoginEvents() {
    const microsoftBtn = document.getElementById('ms-login-btn');

    if (microsoftBtn) {
      microsoftBtn.addEventListener('click', async () => {
        microsoftBtn.disabled = true;
        microsoftBtn.textContent = 'Connexion en cours...';
        
        const result = await ipcRenderer.invoke('login-microsoft', { forcePrompt: true });
        
        if (result.success) {
          this.authData = result.data;
          this.currentView = 'main';
          await this.loadData();
          this.render();
        } else {
          alert('Erreur de connexion Microsoft');
          microsoftBtn.disabled = false;
          microsoftBtn.textContent = 'Se connecter avec Microsoft';
        }
      });
    }
  }

  async loadHomePageInfo() {
    try {
      // Stockage enlevé car cause du lag - les users peuvent voir dans les paramètres
      // const storageInfo = await ipcRenderer.invoke('get-storage-info');
    } catch (error) {
      console.error('Erreur loadHomePageInfo:', error);
    }
  }

  setupMainEvents() {
    // Fallback multi-CDN pour l'avatar du joueur
    setTimeout(() => {
      const img = document.getElementById('player-head-img');
      if (img && !img._headFallbackAttached) {
        img._headFallbackAttached = true;
        img.addEventListener('error', () => {
          try {
            const list = (img.dataset.sources || '').split('|').filter(Boolean);
            let idx = parseInt(img.dataset.index || '0', 10);
            if (Number.isNaN(idx)) idx = 0;
            if (idx + 1 < list.length) {
              img.dataset.index = String(idx + 1);
              img.src = list[idx + 1];
            } else {
              img.src = this.fallbackAvatar;
            }
          } catch (_) {
            img.src = this.fallbackAvatar;
          }
        }, { once: false });
      }
    }, 0);
    
    // ✅ CLEANUP: Supprimer l'ancien listener de changement de vue s'il existe
    if (this.viewChangeListener) {
      document.removeEventListener('click', this.viewChangeListener);
    }

    // ✨ GESTIONNAIRE DE CHANGEMENT DE VUE (TODOS LES MENUS)
    this.viewChangeListener = (e) => {
      const button = e.target.closest('[data-view]');
      if (button && !button.disabled) {
        const view = this.normalizeViewName(button.getAttribute('data-view'));
        
        // Cas spécial pour Paramètres
        if (view === 'settings') {
          this.currentView = 'main';
          this.render();
          ipcRenderer.send('open-settings');
        } else {
          this.currentView = view;
          this.render();
        }
      }

      // ✨ THÈME - MODE D'AFFICHAGE
      const themeBtn = e.target.closest('.theme-option');
      if (themeBtn) {
        const theme = themeBtn.dataset.theme;
        console.log('[Theme] Switching to:', theme);
        localStorage.setItem('theme', theme);
        this.applyThemeSelection(theme);
        this.render();
      }

      // ✨ THÈME - COULEUR D'ACCENT
      const accentBtn = e.target.closest('.accent-option');
      if (accentBtn) {
        const accent = accentBtn.dataset.accent;
        console.log('[Accent] Switching to:', accent);
        localStorage.setItem('accent', accent);
        this.applyAccentColor(accent);
      }

      // 🗂️ Filtrer les actualités par catégorie
      const filterBtn = e.target.closest('[data-news-filter]');
      if (filterBtn) {
        this.newsCategoryFilter = filterBtn.dataset.newsFilter;
        this.render();
      }
    };
    document.addEventListener('click', this.viewChangeListener);

    document.addEventListener('change', (e) => {
      const target = e.target;

      if (target.matches('#blur-background')) {
        const enabled = target.checked;
        localStorage.setItem('blur-background', enabled);
        document.documentElement.setAttribute('data-blur', enabled);
        this.applyInterfaceOptions();
      }

      if (target.matches('#animations')) {
        const enabled = target.checked;
        localStorage.setItem('animations', enabled);
        document.documentElement.setAttribute('data-animations', enabled);
        this.applyInterfaceOptions();
      }

      if (target.matches('#transparency')) {
        const enabled = target.checked;
        localStorage.setItem('transparency', enabled);
        document.documentElement.setAttribute('data-transparency', enabled);
        this.applyInterfaceOptions();
      }
    });

    setTimeout(() => {
      document.querySelectorAll('.theme-option').forEach(btn => {
        if (btn._themeListenerAdded) return;
        btn._themeListenerAdded = true;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const theme = btn.dataset.theme;
          if (!theme) return;
          console.log('[Theme] Direct click handler:', theme);
          localStorage.setItem('theme', theme);
          this.applyThemeSelection(theme);
          this.render();
        });
      });

      document.querySelectorAll('.accent-option').forEach(btn => {
        if (btn._accentListenerAdded) return;
        btn._accentListenerAdded = true;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const accent = btn.dataset.accent;
          if (!accent) return;
          console.log('[Accent] Direct click handler:', accent);
          localStorage.setItem('accent', accent);
          this.applyAccentColor(accent);
        });
      });
    }, 100);

    // ✨ BOUTON PARAMÈTRES DU MENU
    const openSettingsBtn = document.getElementById('open-settings-btn');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', () => {
        this.currentView = 'main';
        this.render();
        ipcRenderer.send('open-settings');
      });
    }

    // ✨ OPTIONS DE THÈME (checkboxes)
    setTimeout(() => {
      const blurToggle = document.getElementById('blur-background');
      const animToggle = document.getElementById('animations');
      const transToggle = document.getElementById('transparency');

      if (blurToggle && !blurToggle._themeListenerAdded) {
        blurToggle._themeListenerAdded = true;
        blurToggle.addEventListener('change', (e) => {
          console.log('[Blur] Changed to:', e.target.checked);
          localStorage.setItem('blur-background', e.target.checked);
          document.documentElement.setAttribute('data-blur', e.target.checked);
        });
      }

      if (animToggle && !animToggle._themeListenerAdded) {
        animToggle._themeListenerAdded = true;
        animToggle.addEventListener('change', (e) => {
          console.log('[Anim] Changed to:', e.target.checked);
          localStorage.setItem('animations', e.target.checked);
          document.documentElement.setAttribute('data-animations', e.target.checked);
        });
      }

      if (transToggle && !transToggle._themeListenerAdded) {
        transToggle._themeListenerAdded = true;
        transToggle.addEventListener('change', (e) => {
          console.log('[Trans] Changed to:', e.target.checked);
          localStorage.setItem('transparency', e.target.checked);
          document.documentElement.setAttribute('data-transparency', e.target.checked);
        });
      }
    }, 100);

    // ✨ RACCOURCIS CLAVIER GLOBAUX
    this.addTrackedListener('keyboard-launch', () => {
      const launchBtn = document.getElementById('launch-btn');
      if (launchBtn) launchBtn.click();
    });

    this.addTrackedListener('keyboard-settings', () => {
      ipcRenderer.send('open-settings');
    });

    this.addTrackedListener('keyboard-home', () => {
      this.currentView = 'main';
      this.render();
    });

    // 🎮 SIGNAL QUAND LE JEU FERME
    ipcRenderer.on('game-closed', (event, { code }) => {
      console.log(`Le jeu a fermé avec le code: ${code}`);
      const launchBtn = document.getElementById('launch-btn');
      if (launchBtn) {
        launchBtn.disabled = false;
        launchBtn.style.opacity = '1';
        launchBtn.style.cursor = 'pointer';
        // Restaurer le contenu du bouton
        const icons = {
          zap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
        };
        launchBtn.innerHTML = `<span class="launch-icon">${icons.zap}</span><span class="launch-text">Lancer Minecraft</span><span class="launch-hint">Appuyez sur Ctrl+L</span>`;
      }
      this.isLaunching = false;
    });

/*
    // ✅ BOUTON RADIO - DÉLÉGATION D'ÉVÉNEMENTS (fonctionne sur toutes les pages)
    const existingRadioListener = this.listeners.get('radio-click');
    if (existingRadioListener) {
      document.removeEventListener('click', existingRadioListener);
    }
    
    const radioClickListener = (e) => {
      if (e.target.closest('[data-action="open-radio"]')) {
        this.openRadioPlayer();
      }
    };
    
    document.addEventListener('click', radioClickListener);
    this.listeners.set('radio-click', radioClickListener);
*/
        // ✅ PARTENAIRES - VISITER
    document.querySelectorAll('[data-visit-partner]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.visitPartner;
        require('electron').shell.openExternal(url);
      });
    });

    // ✅ VERSIONS - TÉLÉCHARGER JAR
    document.querySelectorAll('[data-download-version]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const version = btn.dataset.downloadVersion;
        // Ouvrir PaperMC pour cette version spécifique
        const paperMcUrl = `https://fill-ui.papermc.io/projects/paper/version/${version}`;
        require('electron').shell.openExternal(paperMcUrl);
      });
    });

    // ✅ PARTENAIRES - REJOINDRE SERVEUR
    document.querySelectorAll('[data-join-partner]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const serverIP = btn.dataset.joinPartner;
        
        if (serverIP !== 'realms') {
          this.launchGame(serverIP);
        } else {
          require('electron').shell.openExternal('https://www.minecraft.net/realms');
        }
      });
    });

    // ✅ CONTACT PARTENAIRES
    document.getElementById('contact-partner-btn')?.addEventListener('click', () => {
      require('electron').shell.openExternal('mailto:contact.vellkoramc@gmail.com?subject=Devenir Partenaire');
    });

    // ✅ NETTOYER LES ANCIENS LISTENERS AVANT D'EN AJOUTER DE NOUVEAUX
    this.cleanupListeners();

    // ✅ ÉCOUTER LE SIGNAL DE DÉCONNEXION DEPUIS LES PARAMÈTRES
    this.addTrackedListener('logout-from-settings', async () => {
      console.log('📡 Disconnect signal received');
      
      this.currentView = 'login';
      this.authData = null;
      this.friends = [];
      this.news = [];
      this.profiles = [];
      this.selectedProfile = null;
      
      this.render();
      
      console.log('✅ Return to login page');
    });

    // ✅ ÉCOUTER LES MISES À JOUR DE PROGRESSION
    this.addTrackedListener('launch-progress', (event, progress) => {
      const progressContainer = document.getElementById('launch-progress-container');
      const progressBar = document.getElementById('launch-progress-bar');
      const progressText = document.getElementById('launch-progress-text');
      
      if (progressContainer && progressBar && progressText) {
        progressContainer.style.display = 'block';
        progressBar.style.width = `${progress.percent || 0}%`;
        progressText.textContent = `${progress.type || 'Téléchargement'}: ${progress.percent || 0}%`;
      }
    });

    // ✅ ÉCOUTER LES ERREURS DE LANCEMENT
    this.addTrackedListener('launch-error', (event, error) => {
      console.error('Erreur lancement:', error);
      alert(error);
    });

    // ✅ ÉCOUTER LES CHANGEMENTS DE PARAMÈTRES
    this.addTrackedListener('settings-updated', (event, newSettings) => {
      console.log('⚡ Settings updated in real-time:', newSettings);
      this.settings = newSettings;
      
      // ✅ Mettre à jour le badge RAM IMMÉDIATEMENT
      const ramBadge = document.getElementById('ram-badge-display');
      if (ramBadge) {
        ramBadge.textContent = `${newSettings.ramAllocation || 4} GB RAM`;
        console.log('✅ RAM badge updated to:', newSettings.ramAllocation);
      }
      
      // Mettre à jour aussi dans le header si nécessaire
      const headerRam = document.getElementById('header-ram');
      if (headerRam) {
        headerRam.textContent = newSettings.ramAllocation || 4;
      }
      
      // Si on est sur l'accueil, on pourrait aussi re-render pour être sûr
      if (this.currentView === 'main') {
        // Optionnel: forcer la mise à jour visuelle
        this.renderContentAsync();
      }
    });

    // ✅ BOUTON LAUNCH
    const launchBtn = document.getElementById('launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', async () => {
        await this.launchGame();
      });
    }

    // ✅ HOME - BOUTON OUVRIR STOCKAGE
    const homeStorageBtn = document.getElementById('home-storage-btn');
    if (homeStorageBtn) {
      homeStorageBtn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('open-minecraft-folder');
        if (result.success) {
          console.log('✅ Dossier Minecraft ouvert');
        }
      });
    }

    // ✅ BOUTON PARAMÈTRES
    const homeSettingsBtn = document.getElementById('home-settings-btn');
    if (homeSettingsBtn) {
      homeSettingsBtn.addEventListener('click', () => {
        ipcRenderer.send('open-settings', { tab: 'account' });
      });
    }

    // ✅ BOUTON DISCORD
    const homeDiscordBtn = document.getElementById('home-discord-btn');
    if (homeDiscordBtn) {
      homeDiscordBtn.addEventListener('click', () => {
        ipcRenderer.send('open-settings', { tab: 'discord' });
      });
    }

    // Bouton Mods depuis accueil
    document.getElementById('home-mods-btn')?.addEventListener('click', () => {
      this.currentView = 'mods';
      this.render();
    });

    // Boutons rejoindre serveur rapide
    document.querySelectorAll('[data-join-quick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const serverIP = btn.dataset.joinQuick;
        if (this.settings && this.settings.useProtocolConnect) {
          this.launchGame(serverIP);
        } else {
          this.launchGame(serverIP);
        }
      });
    });
    
    // Serveurs populaires cliquables (ligne entière)
    document.querySelectorAll('.server-item[data-server]').forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', async (e) => {
        // éviter double déclenchement si clic sur le bouton
        if (e.target.closest('.server-join-btn')) return;
        const serverIP = item.getAttribute('data-server');
        if (this.settings && this.settings.useProtocolConnect) {
          this.launchGame(serverIP);
          return;
        }
        try {
          const result = await ipcRenderer.invoke('ping-server', serverIP);
          // Toujours tenter le lancement, même si ping échoue ou indique hors-ligne
          this.launchGame(serverIP);
        } catch (err) {
          console.error('Erreur ping serveur:', err);
          this.launchGame(serverIP);
        }
      });
    });
    
    // Mettre à jour les compteurs joueurs via ping
    const items = document.querySelectorAll('.server-item[data-server]');
    items.forEach(async (it) => {
      const ip = it.getAttribute('data-server');
      const playersEl = it.querySelector('.server-players');
      if (playersEl) playersEl.textContent = 'Vérification...';
      try {
        const res = await ipcRenderer.invoke('ping-server', ip);
        if (res && res.online) {
          const online = res.players?.online ?? 'N/A';
          const max = res.players?.max ?? '';
          if (playersEl) {
            playersEl.textContent = max ? `${online}/${max} joueurs` : `${online} joueurs`;
          }
        } else {
          // Retirer les serveurs hors ligne de l'accueil
          it.remove();
        }
      } catch (_) {
        // En cas d'erreur de ping, ne pas afficher l'entrée
        it.remove();
      }
    });
    
    // Filtrer les serveurs offline dans la vue Serveurs (grid)
    const cards = document.querySelectorAll('.server-card[data-server-ip]');
    cards.forEach(async (card) => {
      const ip = card.getAttribute('data-server-ip');
      const playersEl = card.querySelector('.server-players');
      if (playersEl) playersEl.textContent = 'Vérification...';
      try {
        const res = await ipcRenderer.invoke('ping-server', ip);
        if (res && res.online) {
          const online = res.players?.online ?? 'N/A';
          const max = res.players?.max ?? '';
          if (playersEl) {
            playersEl.textContent = max ? `${online}/${max} joueurs` : `${online} joueurs`;
          }
        } else {
          card.remove();
        }
      } catch (_) {
        card.remove();
      }
    });

    // ✅ MENU NAVIGATION
    document.querySelectorAll('.menu-item').forEach(btn => {
      // ✅ CLEANUP: Supprimer les anciens listeners avant d'en ajouter de nouveaux
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', async () => {
        if (newBtn.disabled) {
          return;
        }
        if (newBtn.dataset.view === 'settings') {
          ipcRenderer.send('open-settings');
          return;
        }
        
        if (newBtn.dataset.view === 'main') {
          await this.loadData();
          this.loadHomePageInfo();
        }
        
        this.currentView = this.normalizeViewName(newBtn.dataset.view);
        this.render();
      });
    });
    
    // ✅ CHANGEMENT DE VERSION
    document.getElementById('version-select')?.addEventListener('change', async (e) => {
      const version = e.target.value;
      
      try {
        const result = await ipcRenderer.invoke('update-profile-version', version);
        
        if (result.success) {
          this.profiles = await ipcRenderer.invoke('get-profiles');
          this.selectedProfile = this.profiles.find(profile => profile.id === result.profile?.id) || result.profile;
          this.selectedLaunchLoader = 'vanilla';
          await this.renderContentAsync();
          console.log('✅ Version changed:', version);
        }
      } catch (error) {
        console.error('Erreur changement version:', error);
        e.target.value = this.selectedProfile?.version || '1.21.4';
      }
    });

    document.querySelectorAll('[data-loader-option]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedLaunchLoader = button.getAttribute('data-loader-option') || 'vanilla';

        document.querySelectorAll('[data-loader-option]').forEach((item) => {
          item.classList.toggle(
            'active',
            item.getAttribute('data-loader-option') === this.selectedLaunchLoader
          );
        });

        const loaderHint = document.getElementById('loader-selection-hint');
        if (loaderHint) {
          loaderHint.textContent = this.selectedLaunchLoader === 'vanilla'
            ? 'Minecraft se lancera sans loader.'
            : `Minecraft se lancera avec ${this.formatLoaderLabel(this.selectedLaunchLoader)}.`;
        }
      });
    });

    // ✅ HOME PAGE - CHARGER LES INFOS
    if (this.currentView === 'main') {
      this.loadHomePageInfo();
    }

    if (this.currentView === 'resourcepacks') {
      this.setupTexturePacksEvents();
    }

    // ✅ AMIS
    document.getElementById('add-friend-btn')?.addEventListener('click', () => {
      this.showAddFriend = true;
      this.render();
      this.setupMainEvents();
    });

    document.getElementById('add-friend-btn-empty')?.addEventListener('click', () => {
      this.showAddFriend = true;
      this.render();
      this.setupMainEvents();
    });

    document.getElementById('save-friend-btn')?.addEventListener('click', async () => {
      const username = document.getElementById('friend-username').value.trim();
      if (!username) {
        alert('Entrez un pseudo valide');
        return;
      }
      
      try {
        const result = await ipcRenderer.invoke('add-friend', { username, online: false });
        if (result.success) {
          this.showAddFriend = false;
          await this.loadData();
          this.render();
          this.setupMainEvents();
        } else {
          alert('Erreur: ' + (result.error || 'Impossible d\'ajouter l\'ami'));
        }
      } catch (error) {
        alert('Erreur: ' + error.message);
      }
    });

    document.getElementById('cancel-friend-btn')?.addEventListener('click', () => {
      this.showAddFriend = false;
      this.render();
      this.setupMainEvents();
    });

    document.querySelectorAll('[data-remove-friend]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await this.ui.showConfirm({
          title: 'Supprimer cet ami ?',
          message: 'Cette action retirera cet ami de ta liste.',
          confirmLabel: 'Supprimer',
          cancelLabel: 'Annuler',
          type: 'error'
        });

        if (confirmed) {
          try {
            const result = await ipcRenderer.invoke('remove-friend', parseInt(btn.dataset.removeFriend));
            if (result.success) {
              await this.loadData();
              this.render();
              this.setupMainEvents();
              this.ui.showToast({
                title: 'Ami supprime',
                message: 'La liste d amis a ete mise a jour.',
                type: 'success'
              });
            }
          } catch (error) {
            alert('Erreur: ' + error.message);
          }
        }
      });
    });

    // ✅ SERVEURS - REJOINDRE UN SERVEUR
    document.querySelectorAll('[data-join-server]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const serverIP = btn.dataset.joinServer;
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = `${icons.zap} Connexion...`;
        
        try {
          const result = await ipcRenderer.invoke('ping-server', serverIP);
          
          if (result.online) {
            btn.innerHTML = `${icons.check} En ligne !`;
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            
            setTimeout(() => {
              this.launchGame(serverIP);
            }, 500);
          } else {
            btn.innerHTML = `${icons.x} Serveur hors ligne`;
            btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          }

          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.background = '';
          }, 2000);
        } catch (error) {
          console.error('Erreur ping serveur:', error);
          btn.innerHTML = `${icons.x} Erreur`;
          btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.background = '';
          }, 2000);
        }
      });
    });

    // ✅ SERVEUR PERSONNALISÉ
    document.getElementById('join-custom-server')?.addEventListener('click', async () => {
      const ip = document.getElementById('custom-server-ip').value.trim();
      if (!ip) {
        alert('Veuillez entrer une adresse IP de serveur');
        return;
      }
      
      const btn = document.getElementById('join-custom-server');
      const originalText = btn.innerHTML;
      
      btn.disabled = true;
      btn.innerHTML = `${icons.zap} Vérification...`;
      
      try {
        const result = await ipcRenderer.invoke('ping-server', ip);
        
        if (result.online) {
          btn.innerHTML = `${icons.check} Serveur actif !`;
          
          setTimeout(() => {
            this.launchGame(ip);
            btn.disabled = false;
            btn.innerHTML = originalText;
          }, 500);
        } else {
          alert('Le serveur est actuellement hors ligne');
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      } catch (error) {
        alert('Impossible de vérifier le serveur: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    // ✅ NEWS
    document.querySelectorAll('[data-view="news"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.currentView = 'news';
        this.render();
        this.setupMainEvents();
        
        const newsContainer = document.getElementById('news-container');
        if (newsContainer && this.news.length > 0) {
          newsContainer.innerHTML = this.news.map(item => `
            <div class="news-card">
              <h3>${item.title}</h3>
              <p class="news-date">${new Date(item.date).toLocaleDateString('fr-FR')}</p>
              <p>${item.text}</p>
              <a href="${item.url}" class="btn-secondary" style="display: inline-block; margin-top: 10px;">Lire plus</a>
            </div>
          `).join('');
        }
      });
    });

    // ✅ SYSTÈME DE THÈME - SÉLECTIONNER UN THÈME
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        this.theme = theme;
        this.saveTheme();
        this.applyTheme();
        this.render();
        this.setupMainEvents();
      });
    });
    

    // ✅ SYSTÈME DE THÈME - PERSONNALISER
    const saveCustomThemeBtn = document.getElementById('save-custom-theme');
    if (saveCustomThemeBtn) {
      saveCustomThemeBtn.addEventListener('click', () => {
        this.customTheme.primaryColor = document.getElementById('custom-primary')?.value || this.customTheme.primaryColor;
        this.customTheme.secondaryColor = document.getElementById('custom-secondary')?.value || this.customTheme.secondaryColor;
        this.customTheme.accentColor = document.getElementById('custom-accent')?.value || this.customTheme.accentColor;
        this.customTheme.textColor = document.getElementById('custom-text')?.value || this.customTheme.textColor;
        
        this.theme = 'custom';
        this.saveTheme();
        this.applyTheme();
        this.render();
        this.setupMainEvents();
      });
    }

    // ✅ SYSTÈME DE THÈME - SYNC INPUTS
    document.querySelectorAll('input[type="color"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const nextInput = e.target.nextElementSibling;
        if (nextInput && nextInput.type === 'text') {
          nextInput.value = e.target.value;
        }
      });
    });

    // ==========================================
    // ✅ PAGE AIDE & SUPPORT - ONGLETS
    // ==========================================
    document.getElementById('help-docs-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
      document.getElementById('help-docs-content').style.display = 'block';
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
      });
      e.target.style.background = 'rgba(99, 102, 241, 0.25)';
      e.target.style.color = '#e2e8f0';
    });

    document.getElementById('help-faq-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
      document.getElementById('help-faq-content').style.display = 'block';
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
      });
      e.target.style.background = 'rgba(99, 102, 241, 0.25)';
      e.target.style.color = '#e2e8f0';
    });

    document.getElementById('help-bug-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
      document.getElementById('help-bug-content').style.display = 'block';
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
      });
      e.target.style.background = 'rgba(99, 102, 241, 0.25)';
      e.target.style.color = '#e2e8f0';
    });

    document.getElementById('help-discord-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
      document.getElementById('help-discord-content').style.display = 'block';
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
      });
      e.target.style.background = 'rgba(99, 102, 241, 0.25)';
      e.target.style.color = '#e2e8f0';
    });

    document.getElementById('help-pr-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.help-tab-content').forEach(el => el.style.display = 'none');
      document.getElementById('help-pr-content').style.display = 'block';
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
      });
      e.target.style.background = 'rgba(99, 102, 241, 0.25)';
      e.target.style.color = '#e2e8f0';
    });

    // ✅ CARTES D'ACTION RAPIDE - Documentation
    document.querySelectorAll('.help-quick-card').forEach(card => {
      card.addEventListener('click', () => {
        document.getElementById('help-docs-btn')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // ✅ CARTES DE DOCUMENTATION - Cliquables
    const docsContent = document.getElementById('help-docs-content');
    if (docsContent) {
      const cards = docsContent.querySelectorAll('div[style*="background: rgba(30, 41, 59"]');
      cards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          const title = card.querySelector('h3')?.textContent;
          this.ui.showToast({
            title: 'Plus d\'infos',
            message: `Consultez la section ${title} sur GitHub pour plus de détails.`,
            type: 'info',
            duration: 3000
          });
        });
      });
    }

    // ✅ BOUTONS D'ACTION - DISCORD
    document.getElementById('help-discord-join-btn')?.addEventListener('click', () => {
      require('electron').shell.openExternal('https://discord.gg/rCFBHZencT');
    });

    // ✅ BOUTONS D'ACTION - GITHUB ISSUES
    document.getElementById('help-bug-report-btn')?.addEventListener('click', () => {
      require('electron').shell.openExternal('https://github.com/velkora/launcher/issues/new');
    });

    // ✅ BOUTONS D'ACTION - GITHUB PROJECT
    document.getElementById('help-github-project-btn')?.addEventListener('click', () => {
      require('electron').shell.openExternal('https://github.com/velkora/launcher');
    });
  }

  getRadioStations() {

    return [
      { name: 'Skyrock', url: 'https://icecast.skyrock.net/s/natio_mp3_128k' },
      { name: 'Fun Radio', url: 'https://icecast.funradio.fr/fun-1-44-128' },
      { name: 'RTL2', url: 'https://icecast.rtl2.fr/rtl2-1-44-128' },
      { name: 'Virgin Radio (Europe 2)', url: 'https://europe2.lmn.fm/europe2.mp3' },
      { name: 'France Inter', url: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3' },
      { name: 'FIP', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3' },
      { name: 'Europe 1', url: 'https://europe1.lmn.fm/europe1.mp3' },
      { name: 'Radio Nova', url: 'https://novazz.ice.infomaniak.ch/novazz-128.mp3' }
    ];
  }

  openRadioPlayer() {
    // ✅ Utiliser une instance globale plutôt que de recréer
    let modal = document.getElementById('radio-modal');
    
    if (!modal) {
      // Créer le style CSS s'il n'existe pas
      if (!document.getElementById('radio-style')) {
        const css = `
          #radio-modal{position:fixed;inset:0;background:rgba(10,15,25,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999}
          .radio-window{width:760px;max-width:95vw;background:linear-gradient(135deg,rgba(15,23,42,.97),rgba(17,24,39,.97));border:1px solid rgba(99,102,241,.35);border-radius:16px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.6)}
          .radio-header{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(99,102,241,.25)}
          .radio-title{display:flex;align-items:center;gap:10px;color:#e2e8f0;font-weight:800;letter-spacing:.3px}
          .radio-actions{display:flex;align-items:center;gap:10px}
          .radio-search{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);color:#e2e8f0;padding:10px 12px;border-radius:10px;outline:none;width:260px}
          .btn-ghost{background:transparent;border:1px solid rgba(99,102,241,.35);color:#cbd5e1;border-radius:10px;padding:8px 12px;cursor:pointer}
          .btn-ghost.active{background:rgba(99,102,241,.2);color:#e2e8f0}
          .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:6px}
          .radio-body{padding:16px;max-height:62vh;overflow:auto}
          .radio-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
          .radio-card{display:flex;align-items:center;gap:12px;background:rgba(99,102,241,.10);border:1px solid rgba(99,102,241,.25);border-radius:12px;padding:12px 14px;cursor:pointer;transition:transform .2s,box-shadow .2s}
          .radio-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(99,102,241,.25)}
          .radio-avatar{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
          .radio-name{color:#e2e8f0;font-weight:700}
          .radio-sub{color:#94a3b8;font-size:12px;margin-top:2px}
          .radio-star{margin-left:auto;background:transparent;border:none;color:#94a3b8;cursor:pointer}
          .radio-star.active{color:#f59e0b}
          .radio-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-top:1px solid rgba(99,102,241,.25);gap:12px}
          .nowplaying{display:flex;align-items:center;gap:12px;color:#cbd5e1}
          .live-dot{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse-dot 1.6s infinite}
          .eq{display:inline-flex;gap:3px;margin-left:6px}
          .eq span{width:3px;background:#10b981;border-radius:2px;animation:eq 1s infinite ease-in-out}
          .eq span:nth-child(1){height:8px;animation-delay:.1s}
          .eq span:nth-child(2){height:14px;animation-delay:.2s}
          .eq span:nth-child(3){height:10px;animation-delay:.3s}
          .eq span:nth-child(4){height:16px;animation-delay:.4s}
          .eq.paused span{animation-play-state:paused;opacity:.5}
          .volume{display:flex;align-items:center;gap:10px;min-width:280px}
          #radio-volume{flex:1}
          @keyframes eq{0%{transform:scaleY(.6)}50%{transform:scaleY(1)}100%{transform:scaleY(.6)}}
          @keyframes pulse-dot{0%,100%{opacity:.6}50%{opacity:1}}
        `;
        const style = document.createElement('style');
        style.id = 'radio-style';
        style.textContent = css;
        document.head.appendChild(style);
      }
      
      // Récupérer les données sauvegardées
      const vol = parseFloat(localStorage.getItem('radioVolume') || '0.6');
      const stations = this.getRadioStations();
      const favs = new Set(JSON.parse(localStorage.getItem('radioFavorites') || '[]'));
      const onlyFav = localStorage.getItem('radioOnlyFav') === '1';
      
      // Construire le HTML
      const html = `
        <div id="radio-modal">
          <div class="radio-window">
            <div class="radio-header">
              <div class="radio-title">${icons.radio}<span>Radio</span></div>
              <div class="radio-actions">
                <input id="radio-search" class="radio-search" placeholder="Rechercher une station...">
                <button id="radio-fav-filter" class="btn-ghost ${onlyFav?'active':''}">Favoris</button>
                <button id="radio-playpause" class="btn-primary">${icons.play}<span>Lire</span></button>
                <button id="radio-close" class="btn-ghost">${icons.x}</button>
              </div>
            </div>
            <div class="radio-body">
              <div id="radio-stations" class="radio-grid"></div>
            </div>
            <div class="radio-footer">
              <div class="nowplaying">
                <span class="live-dot"></span>
                <span id="radio-current"></span>
                <div id="radio-eq" class="eq paused"><span></span><span></span><span></span><span></span></div>
              </div>
              <div class="volume">
                <span style="color:#94a3b8">Volume</span>
                <input id="radio-volume" type="range" min="0" max="1" step="0.01" value="${vol}">
                <span id="radio-volume-val" style="color:#cbd5e1"></span>
              </div>
            </div>
            <audio id="radio-audio" preload="none" crossorigin="anonymous"></audio>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', html);
      modal = document.getElementById('radio-modal');
      
      // ✅ Initialiser les éléments une seule fois
      this._setupRadioControls(stations, favs, vol, onlyFav);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    } else {
      // Si le modal existe déjà, juste le montrer
      modal.style.display = 'flex';
    }
  }

  /**
   * ✅ Configurer les contrôles de la radio (logique centralisée)
   */
  _setupRadioControls(stations, favs, vol, onlyFav) {
    const audio = document.getElementById('radio-audio');
    const volEl = document.getElementById('radio-volume');
    const volVal = document.getElementById('radio-volume-val');
    const currentEl = document.getElementById('radio-current');
    const eq = document.getElementById('radio-eq');
    const playBtn = document.getElementById('radio-playpause');
    const searchEl = document.getElementById('radio-search');
    const favFilterBtn = document.getElementById('radio-fav-filter');
    const grid = document.getElementById('radio-stations');
    const closeBtn = document.getElementById('radio-close');
    
    if (!audio || this._radioInitialized) return; // Éviter la double initialisation
    this._radioInitialized = true;

    audio.volume = vol;
    volVal.textContent = Math.round(vol * 100) + '%';

    // ✅ Fonction de rendu
    const render = () => {
      const q = (searchEl?.value || '').toLowerCase().trim();
      const onlyFavNow = favFilterBtn?.classList.contains('active');
      const htmlCards = stations
        .filter(s => (!onlyFavNow || favs.has(s.url)) && s.name.toLowerCase().includes(q))
        .map(s => {
          const initials = s.name.slice(0, 2).toUpperCase();
          const favClass = favs.has(s.url) ? 'active' : '';
          return `<div class="radio-card" data-url="${s.url}" data-name="${s.name}"><div class="radio-avatar">${initials}</div><div style="flex:1"><div class="radio-name">${s.name}</div><div class="radio-sub">Live</div></div><button class="radio-star ${favClass}" data-star="${s.url}" title="Favori">${icons.star}</button></div>`;
        })
        .join('');
      if (grid) grid.innerHTML = htmlCards || `<div style="color:#94a3b8;padding:12px;">Aucune station</div>`;
    };

    // ✅ Fonction pour changer de station
    const setSrc = (name, url) => {
      audio.src = url;
      if (currentEl) currentEl.textContent = name;
      localStorage.setItem('radioStation', JSON.stringify({ name, url }));
      audio.play().catch(() => {
        console.warn('[Radio] Autoplay failed - user interaction required');
      });
      if (playBtn) playBtn.innerHTML = icons.pause + '<span>Pause</span>';
      if (eq) eq.classList.remove('paused');
    };

    // Événements
    if (grid) {
      grid.addEventListener('click', (e) => {
        const star = e.target.closest('.radio-star');
        if (star) {
          const url = star.getAttribute('data-star');
          if (favs.has(url)) {
            favs.delete(url);
          } else {
            favs.add(url);
          }
          localStorage.setItem('radioFavorites', JSON.stringify(Array.from(favs)));
          star.classList.toggle('active');
          if (favFilterBtn?.classList.contains('active')) render();
          return;
        }
        const card = e.target.closest('.radio-card');
        if (card) {
          setSrc(card.dataset.name, card.dataset.url);
        }
      });
    }

    if (searchEl) searchEl.addEventListener('input', render);
    
    if (favFilterBtn) {
      favFilterBtn.addEventListener('click', () => {
        favFilterBtn.classList.toggle('active');
        localStorage.setItem('radioOnlyFav', favFilterBtn.classList.contains('active') ? '1' : '0');
        render();
      });
    }

    if (volEl) {
      volEl.addEventListener('input', () => {
        audio.volume = parseFloat(volEl.value);
        localStorage.setItem('radioVolume', String(audio.volume));
        if (volVal) volVal.textContent = Math.round(audio.volume * 100) + '%';
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          audio.play().catch(() => {
            console.warn('[Radio] Play failed');
          });
          playBtn.innerHTML = icons.pause + '<span>Pause</span>';
          if (eq) eq.classList.remove('paused');
        } else {
          audio.pause();
          playBtn.innerHTML = icons.play + '<span>Lire</span>';
          if (eq) eq.classList.add('paused');
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('radio-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Charger la dernière station écoutée
    const saved = localStorage.getItem('radioStation');
    if (saved) {
      try {
        const o = JSON.parse(saved);
        if (o && o.url) setSrc(o.name || 'Radio', o.url);
      } catch (_) {}
    } else if (stations[0]) {
      setSrc(stations[0].name, stations[0].url);
    }

    render();
  }

  async launchGame(serverIP = null) {
    // ✅ PROTECTION: Éviter les doubles lancements
    if (this.isLaunching) {
      console.warn('⚠️ Launch already in progress, ignored');
      this.ui.showToast({
        title: 'Lancement deja en cours',
        message: 'Patiente une seconde, Minecraft est deja en train de demarrer.',
        type: 'info'
      });
      return;
    }

    const launchBtn = document.getElementById('launch-btn');
    if (!this.selectedProfile) {
      this.ui.showToast({
        title: 'Aucun profil selectionne',
        message: 'Choisis un profil avant de lancer Minecraft.',
        type: 'error'
      });
      return;
    }

    this.isLaunching = true;
    const originalText = launchBtn?.innerHTML || `${icons.zap} Lancer Minecraft`;
    if (launchBtn) {
      launchBtn.disabled = true;
      launchBtn.textContent = 'Lancement en cours...';
    }
    
    try {
      let targetServer = serverIP;
      if (!targetServer && this.settings && this.settings.defaultServer) {
        const s = String(this.settings.defaultServer).trim();
        if (s) targetServer = s;
      }
      
      // 🎮 Utiliser le loader du profil sélectionné (qui a été mis à jour dans les mods)
      const profileLoader = String(this.selectedProfile?.loader || 'vanilla').toLowerCase();
      const launchProfile = {
        ...this.selectedProfile,
        loader: profileLoader,
        forceVanillaLaunch: profileLoader === 'vanilla'
      };
      const result = await ipcRenderer.invoke('launch-minecraft', launchProfile, targetServer);
      
      if (!result.success) {
        if (launchBtn) {
          launchBtn.disabled = false;
          launchBtn.innerHTML = originalText;
        }
        this.isLaunching = false;
        this.ui.showToast({
          title: 'Erreur de lancement',
          message: result.error || 'Impossible de lancer Minecraft',
          type: 'error'
        });
        return;
      }

      if (launchBtn) {
        launchBtn.disabled = true;
        launchBtn.textContent = 'Minecraft lancé !';
        launchBtn.style.opacity = '0.6';
        launchBtn.style.cursor = 'not-allowed';
      }
      
      this.ui.showToast({
        title: 'Minecraft lancé',
        message: targetServer ? `Connexion à ${targetServer} en cours.` : 'Le jeu a bien été démarré.',
        type: 'success'
      });

      // ✅ Le bouton restera grisé jusqu'à ce que le jeu ferme
      // Le listener 'game-closed' restaurera le bouton quand le jeu ferme

    } catch (error) {
      if (launchBtn) {
        launchBtn.disabled = false;
        launchBtn.innerHTML = originalText;
        launchBtn.style.opacity = '1';
        launchBtn.style.cursor = 'pointer';
      }
      this.isLaunching = false;
      this.ui.showToast({
        title: 'Erreur',
        message: error?.message || 'Erreur lors du lancement',
        type: 'error'
      });
    }
  }


  async renderStatsView() {
    const html = await this.features.renderGameStats();
    return `
      <div class="view-container" style="padding: 20px;">
        ${html}
      </div>
    `;
  }

  renderComingSoonView() {
    return `
      <div class="view-container" style="display: flex; align-items: center; justify-content: center; min-height: 600px; position: relative; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); border-radius: 16px;">
        <div style="text-align: center; color: #e2e8f0;">
          <div style="font-size: 64px; margin-bottom: 20px; animation: float 3s ease-in-out infinite;">${icons.rocket}</div>
          <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 10px;">Fonctionnalité à venir !</h2>
          <p style="color: #94a3b8; font-size: 16px; max-width: 400px; margin: 0 auto;">
            Cette fonctionnalité arrivera très bientôt. Restez connecté pour les dernières actualités !
          </p>
          <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: center;">
            <div style="background: rgba(99, 102, 241, 0.2); padding: 12px 20px; border-radius: 10px; color: #6366f1; font-weight: 600;">
              Très bientôt
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupTexturePacksEvents() {
    const searchInput = document.getElementById('resourcepack-search-input');
    const searchButton = document.getElementById('btn-search-resourcepacks');
    const openFolderButton = document.getElementById('btn-open-resourcepacks-folder');
    const refreshButton = document.getElementById('btn-refresh-resourcepacks');

    searchButton?.addEventListener('click', () => this.searchTexturePacks());
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.searchTexturePacks();
      }
    });
    openFolderButton?.addEventListener('click', async () => {
      const folder = await ipcRenderer.invoke('get-resourcepacks-folder').catch(() => '');
      if (folder) {
        ipcRenderer.send('open-folder', folder);
      }
    });
    refreshButton?.addEventListener('click', () => this.render());

    document.querySelectorAll('.btn-delete-resourcepack').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.deleteTexturePack(button.dataset.packPath, button.dataset.packName);
      });
    });

    document.querySelectorAll('.resourcepack-item').forEach((item) => {
      item.addEventListener('click', async () => {
        await this.showTexturePackDetails(item);
      });
    });
  }

  async showTexturePackDetails(packItem) {
    const details = [
      `Nom : ${packItem.dataset.packName || 'Inconnu'}`,
      `Fichier : ${packItem.dataset.fileName || 'Inconnu'}`,
      `Type : ${packItem.dataset.packType === 'folder' ? 'Dossier' : 'Archive'}`,
      `Taille : ${packItem.dataset.packSize || 'N/A'}`,
      `Ajoute le : ${packItem.dataset.importedAt ? new Date(packItem.dataset.importedAt).toLocaleString('fr-FR') : 'Inconnu'}`,
      `Chemin : ${packItem.dataset.packPath || 'Inconnu'}`
    ];

    await this.ui.showDialog({
      title: packItem.dataset.packName || 'Details du texture pack',
      message: 'Informations disponibles pour ce texture pack.',
      details,
      type: 'info'
    });
  }

  async deleteTexturePack(packPath, packName = 'ce texture pack') {
    const confirmed = await this.ui.showConfirm({
      title: 'Supprimer ce texture pack ?',
      message: `${packName} sera retire du dossier resourcepacks.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      type: 'error'
    });

    if (!confirmed) {
      return;
    }

    const result = await ipcRenderer.invoke('delete-resourcepack', packPath);
    if (result?.success) {
      this.ui.showToast({
        title: 'Texture pack supprime',
        message: `${packName} a ete supprime avec succes.`,
        type: 'success'
      });
      await this.render();
      return;
    }

    this.ui.showToast({
      title: 'Suppression impossible',
      message: result?.message || 'Impossible de supprimer ce texture pack.',
      type: 'error'
    });
  }

  async searchTexturePacks() {
    const input = document.getElementById('resourcepack-search-input');
    const resultsContainer = document.getElementById('resourcepacks-results');
    if (!input || !resultsContainer) return;

    const query = input.value.trim();
    if (!query) {
      this.ui.showToast({
        title: 'Recherche vide',
        message: 'Entrez un nom de texture pack.',
        type: 'info'
      });
      return;
    }

    resultsContainer.innerHTML = '<p style="color: #94a3b8; text-align: center;">Recherche en cours...</p>';

    try {
      const gameVersion = this.selectedProfile?.version || '';
      const facets = encodeURIComponent(JSON.stringify([['project_type:resourcepack']]));
      const versionParam = gameVersion ? `&versions=${encodeURIComponent(JSON.stringify([gameVersion]))}` : '';
      const response = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=12&facets=${facets}${versionParam}`);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        resultsContainer.innerHTML = '<p style="color: #94a3b8; text-align: center;">Aucun texture pack trouve</p>';
        return;
      }

      resultsContainer.innerHTML = data.hits.map((pack) => `
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div style="flex: 1; min-width: 0;">
            <div style="color: #e2e8f0; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(pack.title)}</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 6px;">${this.escapeHtml(pack.description || 'Aucune description')}</div>
            <div style="color: #6366f1; font-size: 12px;">Téléchargements : ${(pack.downloads || 0).toLocaleString()}</div>
          </div>
          <button class="btn-download-resourcepack" data-pack-id="${this.escapeHtml(pack.project_id || pack.slug)}" data-pack-name="${this.escapeHtml(pack.title)}" style="background: linear-gradient(135deg, #1bd96a 0%, #0fb857 100%); border: none; padding: 10px 14px; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; white-space: nowrap;">Télécharger</button>
        </div>
      `).join('');

      document.querySelectorAll('.btn-download-resourcepack').forEach((button) => {
        button.addEventListener('click', async () => {
          await this.downloadTexturePack(button.dataset.packId, button.dataset.packName);
        });
      });
    } catch (error) {
      console.error('Erreur recherche texture packs:', error);
      resultsContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Erreur pendant la recherche.</p>';
    }
  }

  async downloadTexturePack(projectId, packName) {
    try {
      const result = await ipcRenderer.invoke('download-modrinth-resourcepack', projectId, packName, {
        gameVersion: this.selectedProfile?.version
      });

      if (result?.success) {
        await this.render();
        await this.ui.showDialog({
          title: 'Texture pack telecharge',
          message: result.message || `${packName} a ete telecharge avec succes.`,
          type: 'success',
          details: result.filePath ? [`Fichier: ${result.filePath}`] : []
        });
      } else {
        this.ui.showToast({
          title: 'Telechargement impossible',
          message: result?.message || 'Erreur inconnue',
          type: 'error'
        });
      }
    } catch (error) {
      this.ui.showToast({
        title: 'Erreur de telechargement',
        message: error.message,
        type: 'error'
      });
    }
  }

  // ✅ SYSTÈME DE THÈME PERSONNALISÉ
  loadTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    const accent = localStorage.getItem('accent') || 'indigo';
    this.applyThemeSelection(theme);
    this.applyAccentColor(accent);
  }

  reapplyTheme() {
    this.loadTheme();
  }

  applyTheme() {
    this.loadTheme();
  }

  saveTheme() {
    const theme = this.theme || localStorage.getItem('theme') || 'dark';
    localStorage.setItem('theme', theme);
    if (this.theme === 'custom' && this.customTheme) {
      localStorage.setItem('VellkoraMC-custom-theme', JSON.stringify(this.customTheme));
    }
  }

  // ✅ CHARGER LES ACTUALITÉS DYNAMIQUES
  async loadNews() {
    try {
      const result = await ipcRenderer.invoke('get-featured-news');
      if (result.success) {
        this.news = result.news;
        console.log(`Actualités chargées: ${this.news.length}`);
      } else {
        console.warn('⚠️ Impossible de charger les actualités');
        this.news = [];
      }
    } catch (error) {
      console.error('Erreur chargement actualités:', error);
      this.news = [];
    }
  }

  // ✅ AFFICHER LES DÉTAILS D'UNE ACTUALITÉ
  async showNewsDetail(newsId) {
    try {
      const result = await ipcRenderer.invoke('get-news-by-id', newsId);
      if (result.success) {
        const news = result.news;
        const modalHTML = `
          <div id="news-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.3s;">
            <div style="background: #0f172a; border-radius: 16px; max-width: 800px; max-height: 90vh; overflow-y: auto; border: 1px solid rgba(99, 102, 241, 0.2); position: relative; animation: slideUp 0.3s;" onclick="event.stopPropagation()">
              <div style="position: sticky; top: 0; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); padding: 20px; border-bottom: 1px solid rgba(99, 102, 241, 0.2); display: flex; align-items: center; justify-content: space-between;">
                <h2 style="margin: 0; color: #e2e8f0; display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 28px;">${news.image || icons.newspaper}</span>
                  ${news.title}
                </h2>
                <button style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.3); color: #cbd5e1; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 20px; transition: all 0.3s;" onclick="document.getElementById('news-modal').remove()">×</button>
              </div>
              
              <div style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(99, 102, 241, 0.1);">
                  <div>
                    <div style="color: #cbd5e1; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">
                      ${icons.calendar} ${new Date(news.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                      ${news.category}
                    </span>
                    ${news.featured ? '<span style="background: rgba(255, 193, 7, 0.2); color: #fcd34d; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">★ EN VEDETTE</span>' : ''}
                  </div>
                </div>

                <div style="color: #cbd5e1; line-height: 1.8; white-space: pre-line; margin-bottom: 24px;">
                  ${news.content}
                </div>

                <div style="background: rgba(99, 102, 241, 0.05); padding: 16px; border-radius: 8px; border-left: 4px solid rgba(99, 102, 241, 0.3);">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    Pour plus d'informations, consultez nos réseaux sociaux ou notre site officiel.
                  </p>
                </div>
              </div>
            </div>

            <style>
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              #news-modal::-webkit-scrollbar {
                width: 8px;
              }
              #news-modal::-webkit-scrollbar-track {
                background: transparent;
              }
              #news-modal::-webkit-scrollbar-thumb {
                background: rgba(99, 102, 241, 0.3);
                border-radius: 4px;
              }
              #news-modal::-webkit-scrollbar-thumb:hover {
                background: rgba(99, 102, 241, 0.5);
              }
            </style>
          </div>
        `;
        

        const modal = document.createElement('div');
        modal.innerHTML = modalHTML;
        document.body.appendChild(modal.firstElementChild);
        
        // Fermer la modal en cliquant en dehors
        document.getElementById('news-modal').addEventListener('click', (e) => {
          if (e.target.id === 'news-modal') {
            document.getElementById('news-modal').remove();
          }
        });
        
        console.log(`📰 Actualité ouverte: ${news.title}`);
      }
    } catch (error) {
      console.error('Erreur affichage détail actualité:', error);
    }
  }

  applyThemeSelection(theme) {
    const root = document.documentElement;
    const selectedTheme = String(theme || 'dark');
    const preset = this.themePresets[selectedTheme] || this.themePresets.dark;

    console.log('[Theme] Applying theme:', selectedTheme);
    localStorage.setItem('theme', selectedTheme);

    root.style.setProperty('--theme-background', preset.background);
    root.style.setProperty('--theme-surface', preset.surface);
    root.style.setProperty('--theme-panel', preset.panel);
    root.style.setProperty('--theme-text', preset.text);
    root.style.setProperty('--theme-muted', preset.muted);
    root.style.setProperty('--theme-border', preset.border);
    root.style.setProperty('--theme-hero', preset.hero);
    root.style.setProperty('--theme-accent', preset.accent);

    document.body.style.background = preset.background;
    document.body.style.color = preset.text;

    let styleId = 'theme-dynamic-styles';
    let existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      body { background: ${preset.background}; color: ${preset.text}; }
      .main-layout { background: ${preset.background}; color: ${preset.text}; }
      .sidebar { background: ${preset.panel}; color: ${preset.text}; }
      .main-content { background: ${preset.background}; color: ${preset.text}; }
      .view-title, .menu-item, h1, h2, h3, h4, h5, h6, p, span, label { color: ${preset.text} !important; }
      .menu-item:hover { color: ${preset.accent} !important; }
      .panel-card, .news-card-item, .theme-card, .settings-card { background: ${preset.panel}; border-color: ${preset.border}; }
      .news-filter-pill { background: rgba(255,255,255,0.06); color: ${preset.text}; }
      .news-filter-pill.active { background: ${preset.accent}; color: #ffffff; }
      .theme-option.active, .accent-option.active { box-shadow: 0 0 0 3px rgba(255,255,255,0.18); }
      .accent-option { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      .accent-option:hover { transform: translateY(-1px); }
    `;
    document.head.appendChild(styleEl);
    this.applyInterfaceOptions();
  }

  applyAccentColor(accent) {
    const root = document.documentElement;
    const accentColor = this.accentColors[accent] || this.accentColors.indigo;

    console.log('[Accent] Applying accent:', accent, accentColor);
    localStorage.setItem('accent', accent);

    root.style.setProperty('--theme-accent', accentColor);

    document.querySelectorAll('.btn-primary').forEach(el => {
      el.style.background = accentColor;
    });

    document.querySelectorAll('.accent-option').forEach(el => {
      if (el.dataset.accent === accent) {
        el.classList.add('active');
        el.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)';
      } else {
        el.classList.remove('active');
        el.style.boxShadow = 'none';
      }
    });

    document.querySelectorAll('.theme-option').forEach(el => {
      if (el.dataset.theme === localStorage.getItem('theme')) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.menu-item.active').forEach(el => {
      el.style.color = accentColor;
    });

    document.querySelectorAll('a').forEach(el => {
      el.style.color = accentColor;
    });

    let styleId = 'accent-dynamic-styles';
    let existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .btn-primary { background: ${accentColor} !important; }
      .btn-secondary:hover { border-color: ${accentColor} !important; color: ${accentColor} !important; }
      .accent-option.active, .accent-option[data-accent="${accent}"] { box-shadow: 0 0 0 3px rgba(255,255,255,0.3) !important; }
      .theme-option.active { border-color: ${accentColor} !important; }
      .menu-item.active { color: ${accentColor} !important; }
      a { color: ${accentColor} !important; }
      .view-title { color: ${accentColor} !important; }
      .news-filter-pill.active { background: ${accentColor} !important; }
    `;
    document.head.appendChild(styleEl);
    this.applyInterfaceOptions();
  }

  renderThemeSettings() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const currentAccent = localStorage.getItem('accent') || 'indigo';
    const themeOptions = [
      { id: 'dark', icon: icons.moon, title: 'Sombre', subtitle: 'Foncé et élégant' },
      { id: 'neon', icon: icons.zap, title: 'Neon', subtitle: 'Vif et électrique' },
      { id: 'metro', icon: icons.settings, title: 'Metro', subtitle: 'Futuriste et net' }
    ];

    const accentLabel = {
      indigo: 'Indigo',
      purple: 'Violet',
      blue: 'Bleu',
      cyan: 'Cyan',
      emerald: 'Émeraude'
    };
    const accentOptions = Object.entries(this.accentColors).map(([name, color]) => ({ name, color, label: accentLabel[name] || name }));

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>Thème et apparence</h1>
          <p style="margin-top: 10px; color: #94a3b8; max-width: 800px;">Choisis un look pro, des accents puissants et un système de thème plus riche pour améliorer l'apparence de l'ensemble du launcher.</p>
        </div>

        <div style="max-width: 920px; margin: 0 auto; display: grid; gap: 22px;">
          <div style="background: rgba(30, 41, 59, 0.88); border: 1px solid rgba(99, 102, 241, 0.18); border-radius: 18px; padding: 26px; box-shadow: 0 18px 40px rgba(0,0,0,0.18);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
              <div>
                <h2 style="margin: 0 0 8px 0; color: #e2e8f0; font-size: 22px;">Mode de thème</h2>
                <p style="margin: 0; color: #cbd5e1; line-height: 1.6;">Sélectionne un style de base et optimise ton launcher avec un rendu plus soigné, des surbrillances et un contraste net.</p>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <span style="color: #94a3b8; font-size: 13px; white-space: nowrap;">Thème actuel:</span>
                <span style="background: rgba(99, 102, 241, 0.18); color: #e0e7ff; padding: 8px 14px; border-radius: 999px; font-weight: 600;">${themeOptions.find(theme => theme.id === currentTheme)?.title || 'Sombre'}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-top: 20px;">
              ${themeOptions.map(theme => `
                <button class="theme-option${currentTheme === theme.id ? ' active' : ''}" data-theme="${theme.id}" type="button" style="background: rgba(15, 23, 42, 0.88); border: 2px solid ${currentTheme === theme.id ? '#6366f1' : 'rgba(99, 102, 241, 0.2)'}; border-radius: 16px; padding: 18px; cursor: pointer; text-align: left; color: #e2e8f0; transition: all 0.25s ease;">
                  <div style="font-size: 28px; margin-bottom: 12px;">${theme.icon}</div>
                  <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">${theme.title}</div>
                  <div style="font-size: 13px; color: #94a3b8; line-height: 1.5;">${theme.subtitle}</div>
                </button>
              `).join('')}
            </div>
          </div>

          <div style="background: rgba(30, 41, 59, 0.88); border: 1px solid rgba(99, 102, 241, 0.18); border-radius: 18px; padding: 26px;">
            <h2 style="margin: 0 0 14px 0; color: #e2e8f0; font-size: 20px;">Couleurs d'accent</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 14px;">
              ${accentOptions.map(option => `
                <button class="accent-option${currentAccent === option.name ? ' active' : ''}" data-accent="${option.name}" type="button" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: ${option.color}; border: 2px solid ${option.color}; border-radius: 16px; padding: 18px; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
                  <span style="width: 14px; height: 14px; border-radius: 999px; display: inline-block; background: rgba(255,255,255,0.3);"></span>
                  ${option.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="background: rgba(30, 41, 59, 0.88); border: 1px solid rgba(99, 102, 241, 0.18); border-radius: 18px; padding: 26px;">
            <h2 style="margin: 0 0 14px 0; color: #e2e8f0; font-size: 20px;">Options d'interface</h2>
            <p style="color: #94a3b8; margin-bottom: 18px;">Active les effets visuels, la transparence, et donne plus de caractère à ton launcher sans perdre en lisibilité.</p>
            <div style="display: grid; gap: 14px;">
              <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #e2e8f0; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 14px; padding: 16px;">
                <span>Activer le flou d'arrière-plan</span>
                <input type="checkbox" id="blur-background" ${localStorage.getItem('blur-background') !== 'false' ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #e2e8f0; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 14px; padding: 16px;">
                <span>Activer les animations</span>
                <input type="checkbox" id="animations" ${localStorage.getItem('animations') !== 'false' ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #e2e8f0; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 14px; padding: 16px;">
                <span>Activer la transparence</span>
                <input type="checkbox" id="transparency" ${localStorage.getItem('transparency') !== 'false' ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
              </label>
            </div>
          </div>

          <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 18px; padding: 28px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);">
            <h2 style="margin: 0 0 16px 0; color: #e2e8f0; font-size: 20px;">Aperçu du thème</h2>
            <div style="display: grid; gap: 14px;">
              <div style="background: rgba(30, 41, 59, 0.92); border: 1px solid rgba(99, 102, 241, 0.18); border-radius: 16px; padding: 20px;">
                <div style="font-size: 16px; font-weight: 700; color: #e2e8f0; margin-bottom: 10px;">Aperçu du launcher</div>
                <div style="color: #94a3b8; font-size: 14px; line-height: 1.6;">Ton thème se mettra à jour immédiatement pour toutes les pages. Les accents et les sections sont stylés avec une apparence plus moderne et des reflets dynamiques.</div>
                <button class="btn-primary" style="margin-top: 18px; width: fit-content;">Tester l'accent</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  applyInterfaceOptions() {
    const root = document.documentElement;
    const blurEnabled = localStorage.getItem('blur-background') !== 'false';
    const animationsEnabled = localStorage.getItem('animations') !== 'false';
    const transparencyEnabled = localStorage.getItem('transparency') !== 'false';

    root.setAttribute('data-blur', blurEnabled);
    root.setAttribute('data-animations', animationsEnabled);
    root.setAttribute('data-transparency', transparencyEnabled);

    let styleId = 'interface-option-styles';
    let existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      :root[data-blur="true"] .panel-card,
      :root[data-blur="true"] .settings-card,
      :root[data-blur="true"] .news-card-item,
      :root[data-blur="true"] .theme-card,
      :root[data-blur="true"] .main-layout,
      :root[data-blur="true"] .sidebar,
      :root[data-blur="true"] .main-content {
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }

      :root[data-transparency="true"] .panel-card,
      :root[data-transparency="true"] .settings-card,
      :root[data-transparency="true"] .news-card-item,
      :root[data-transparency="true"] .theme-card,
      :root[data-transparency="true"] .main-layout,
      :root[data-transparency="true"] .sidebar,
      :root[data-transparency="true"] .main-content {
        background: rgba(15, 23, 42, 0.72) !important;
        border-color: rgba(99, 102, 241, 0.12) !important;
      }

      :root[data-animations="false"] *,
      :root[data-animations="false"] *::before,
      :root[data-animations="false"] *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-play-state: paused !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

let notificationAudioContext = null;
function playNotificationSound(volume = 0.5) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!notificationAudioContext) {
      notificationAudioContext = new AudioContext();
    }

    const oscillator = notificationAudioContext.createOscillator();
    const gainNode = notificationAudioContext.createGain();
    gainNode.gain.value = Math.max(0, Math.min(volume, 1)) * 0.25;
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    oscillator.connect(gainNode);
    gainNode.connect(notificationAudioContext.destination);
    oscillator.start();
    oscillator.stop(notificationAudioContext.currentTime + 0.12);
    oscillator.onended = () => {
      try { oscillator.disconnect(); gainNode.disconnect(); } catch (_) {}
    };
  } catch (error) {
    console.warn('Unable to play notification sound:', error);
  }
}

ipcRenderer.on('theme-updated', (event, themeData = {}) => {
  const { theme, accent, blur, animations, transparency } = themeData;
  if (theme) {
    localStorage.setItem('theme', theme);
    if (window.app && typeof window.app.applyThemeSelection === 'function') {
      window.app.applyThemeSelection(theme);
    }
  }
  if (accent) {
    localStorage.setItem('accent', accent);
    if (window.app && typeof window.app.applyAccentColor === 'function') {
      window.app.applyAccentColor(accent);
    }
  }
  if (typeof blur !== 'undefined') {
    localStorage.setItem('blur-background', blur);
    document.documentElement.setAttribute('data-blur', blur);
  }
  if (typeof animations !== 'undefined') {
    localStorage.setItem('animations', animations);
    document.documentElement.setAttribute('data-animations', animations);
  }
  if (typeof transparency !== 'undefined') {
    localStorage.setItem('transparency', transparency);
    document.documentElement.setAttribute('data-transparency', transparency);
  }
});

ipcRenderer.on('play-notification-sound', (event, { volume = 0.5 } = {}) => {
  playNotificationSound(volume);
});

document.addEventListener('DOMContentLoaded', () => {
  window.app = new CraftLauncherApp();
});

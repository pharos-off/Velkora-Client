/**
 * 🎨 Theme Manager - Gestionnaire global des thèmes
 * Centralise tous les thèmes et leur application dans toute l'application
 * Fonctionne dans app.js, settings-app.js, et console de logs
 */

class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'dark';
    this.currentAccent = localStorage.getItem('accent') || 'indigo';
    this.listeners = new Set();
    
    this.themePresets = {
      dark: {
        label: 'Sombre',
        accent: '#6366f1',
        background: '#0f172a',
        surface: '#111827',
        panel: 'rgba(15, 23, 42, 0.88)',
        text: '#e2e8f0',
        muted: '#94a3b8',
        border: 'rgba(99, 102, 241, 0.16)',
        hero: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(79, 70, 229, 0.14))'
      },
      light: {
        label: 'Clair',
        accent: '#2563eb',
        background: '#f8fafc',
        surface: '#ffffff',
        panel: '#eef2ff',
        text: '#0f172a',
        muted: '#64748b',
        border: 'rgba(148, 163, 184, 0.24)',
        hero: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(191, 219, 254, 0.7))'
      },
      neon: {
        label: 'Neon',
        accent: '#38bdf8',
        background: '#020617',
        surface: '#0b1231',
        panel: 'rgba(2, 7, 23, 0.95)',
        text: '#e2e8f0',
        muted: '#94a3b8',
        border: 'rgba(56, 189, 248, 0.18)',
        hero: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(236, 72, 153, 0.16))'
      },
      metro: {
        label: 'Metro',
        accent: '#8b5cf6',
        background: '#07122b',
        surface: '#111c38',
        panel: 'rgba(15, 23, 42, 0.9)',
        text: '#f8fafc',
        muted: '#c7d2fe',
        border: 'rgba(139, 92, 246, 0.16)',
        hero: 'linear-gradient(135deg, rgba(139, 92, 246, 0.16), rgba(79, 70, 229, 0.12))'
      }
    };

    this.accentColors = {
      indigo: '#6366f1',
      purple: '#a855f7',
      blue: '#3b82f6',
      cyan: '#06b6d4',
      emerald: '#10b981',
      pink: '#ec4899',
      orange: '#f97316'
    };

    this.setupGlobalListener();
    this.applyTheme();
  }

  /**
   * Écoute les changements de thème dans le localStorage
   */
  setupGlobalListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'theme' || event.key === 'accent') {
        this.currentTheme = localStorage.getItem('theme') || this.currentTheme;
        this.currentAccent = localStorage.getItem('accent') || this.currentAccent;
        this.applyTheme();
        this.notifyListeners();
      }
    });
  }

  /**
   * Ajoute un listener pour les changements de thème
   */
  onThemeChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifie tous les listeners des changements
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentTheme, this.currentAccent);
      } catch (err) {
        console.error('[ThemeManager] Listener error:', err);
      }
    });
  }

  /**
   * Change le thème actuel
   */
  setTheme(themeName) {
    if (!this.themePresets[themeName]) {
      console.warn(`[ThemeManager] Theme not found: ${themeName}`);
      return false;
    }
    
    if (this.currentTheme === themeName) {
      return true;
    }

    this.currentTheme = themeName;
    localStorage.setItem('theme', themeName);
    this.applyTheme();
    this.notifyListeners();
    return true;
  }

  /**
   * Change la couleur d'accent
   */
  setAccent(accentName) {
    if (!this.accentColors[accentName]) {
      console.warn(`[ThemeManager] Accent not found: ${accentName}`);
      return false;
    }

    if (this.currentAccent === accentName) {
      return true;
    }
    
    this.currentAccent = accentName;
    localStorage.setItem('accent', accentName);
    this.applyTheme();
    this.notifyListeners();
    return true;
  }

  /**
   * Obtient les variables CSS du thème actuel
   */
  getThemeVars() {
    const theme = this.themePresets[this.currentTheme] || this.themePresets.dark;
    const accent = this.accentColors[this.currentAccent] || this.accentColors.indigo;

    return {
      '--color-primary': accent,
      '--color-bg': theme.background,
      '--color-surface': theme.surface,
      '--color-panel': theme.panel,
      '--color-text': theme.text,
      '--color-muted': theme.muted,
      '--color-border': theme.border,
      '--color-hero': theme.hero,
      // Accent shades
      '--accent-light': this.adjustBrightness(accent, 0.2),
      '--accent-dark': this.adjustBrightness(accent, -0.2),
      '--accent-alpha-10': this.hexToRgba(accent, 0.1),
      '--accent-alpha-20': this.hexToRgba(accent, 0.2),
      '--accent-alpha-30': this.hexToRgba(accent, 0.3)
    };
  }

  /**
   * Applique le thème actuel au DOM
   */
  applyTheme() {
    const vars = this.getThemeVars();
    const root = document.documentElement;

    // Appliquer les variables CSS
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Ajouter une classe pour les préférences de thème
    root.setAttribute('data-theme', this.currentTheme);
    root.setAttribute('data-accent', this.currentAccent);

    // Appliquer au body aussi
    if (document.body) {
      document.body.setAttribute('data-theme', this.currentTheme);
      document.body.setAttribute('data-accent', this.currentAccent);
    }

    // Vérifier les préférences système si "auto"
    if (this.currentTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-system-theme', prefersDark ? 'dark' : 'light');
    }
  }

  /**
   * Formate les variables de thème pour la console
   */
  getConsoleStyles() {
    const theme = this.themePresets[this.currentTheme] || this.themePresets.dark;
    const accent = this.accentColors[this.currentAccent] || this.accentColors.indigo;

    return {
      background: theme.background,
      text: theme.text,
      accent: accent,
      muted: theme.muted,
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: accent
    };
  }

  /**
   * Crée un style CSS pour les logs console avec thème
   */
  createConsoleStyle(type = 'info') {
    const styles = this.getConsoleStyles();
    const typeStyles = {
      success: `color: ${styles.success}; font-weight: bold;`,
      error: `color: ${styles.error}; font-weight: bold;`,
      warning: `color: ${styles.warning}; font-weight: bold;`,
      info: `color: ${styles.accent}; font-weight: bold;`,
      muted: `color: ${styles.muted};`
    };
    return typeStyles[type] || typeStyles.info;
  }

  /**
   * Utilitaires pour les couleurs
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  /**
   * Crée un style personnalisé pour les éléments
   */
  createElementStyle(element, styleProps = {}) {
    const theme = this.themePresets[this.currentTheme] || this.themePresets.dark;
    const accent = this.accentColors[this.currentAccent] || this.accentColors.indigo;

    const defaults = {
      backgroundColor: theme.panel,
      color: theme.text,
      borderColor: theme.border,
      borderRadius: '8px',
      borderWidth: '1px',
      borderStyle: 'solid',
      ...styleProps
    };

    Object.entries(defaults).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      element?.style.setProperty(cssKey, value);
    });
  }

  /**
   * Obtient les informations complètes du thème
   */
  getThemeInfo() {
    return {
      current: this.currentTheme,
      accent: this.currentAccent,
      presets: Object.keys(this.themePresets),
      accents: Object.keys(this.accentColors),
      vars: this.getThemeVars(),
      styles: this.getConsoleStyles()
    };
  }

  /**
   * Réinitialise au thème par défaut
   */
  reset() {
    this.currentTheme = 'dark';
    this.currentAccent = 'indigo';
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('accent', 'indigo');
    this.applyTheme();
    this.notifyListeners();
  }
}

// Créer et exporter une instance globale unique
const themeManager = new ThemeManager();

// Exporter pour Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}

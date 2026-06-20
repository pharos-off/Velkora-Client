/**
 * ================================
 * electron-security.js
 * Configuration de sécurité Electron avec CSP et meilleures pratiques
 * ================================
 */

const { session, ipcMain, shell } = require('electron');

class ElectronSecurity {
  constructor() {
    this.cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://discord.com https://*.discord.com"
    ].join('; ');
  }

  /**
   * Vérifie si l'URL appartient à l'app locale
   */
  isLocalAppURL(url) {
    return (
      url.startsWith('file://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost')
    );
  }

  /**
   * Configurer la session sécurisée
   */
  setupSecureSession(sessionObj = session.defaultSession) {
    sessionObj.webRequest.onHeadersReceived((details, callback) => {
      const url = details.url;
      const responseHeaders = {
        ...details.responseHeaders
      };

      // N'appliquer nos headers de sécurité qu'aux pages locales de l'app
      if (this.isLocalAppURL(url)) {
        responseHeaders['X-Content-Type-Options'] = ['nosniff'];
        responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
        responseHeaders['Content-Security-Policy'] = [this.cspHeader];

        // Évite DENY ici, sinon ça peut gêner l'intégration de contenus embarqués
        responseHeaders['X-Frame-Options'] = ['SAMEORIGIN'];
      }

      callback({ responseHeaders });
    });

    sessionObj.webRequest.onBeforeSendHeaders((details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    });

  }

  /**
   * Configurer les préférences de fenêtre sécurisées
   */
  getSecureWebPreferences() {
    return {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: undefined // À définir si nécessaire
    };
  }

  /**
   * Configurer les préférences pour une fenêtre d'authentification
   */
  getAuthWindowPreferences() {
    return {
      ...this.getSecureWebPreferences(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    };
  }

  /**
   * Implémenter une communication IPC sécurisée
   */
  setupSecureIPC() {
    ipcMain.on('validate-request', (event, data) => {
      if (!this.validateIPCMessage(data)) {
        console.error('❌ Message IPC invalide rejeté');
        event.reply('validate-response', {
          success: false,
          error: 'Message invalide'
        });
        return;
      }

      event.reply('validate-response', { success: true });
    });

    ipcMain.on('sensitive-data', (event, data) => {
      try {
        event.reply('sensitive-data-response', { success: true });
      } catch (error) {
        event.reply('sensitive-data-response', {
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Valider un message IPC
   */
  validateIPCMessage(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!data.type || typeof data.type !== 'string') {
      return false;
    }

    if (JSON.stringify(data).length > 10 * 1024 * 1024) {
      return false;
    }

    return true;
  }

  /**
   * Configurer les permissions de l'application
   */
  setupPermissions(sessionObj = session.defaultSession) {
    sessionObj.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['microphone', 'camera'];
      const isAllowed = allowedPermissions.includes(permission);

      callback(isAllowed);
    });
  }

  /**
   * Gérer les URLs non sûres
   */
  setupURLFilter(windowWebContents) {
    windowWebContents.session.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url;

      const blacklistedDomains = ['malicious.com', 'phishing.net'];
      const isDomainBlacklisted = blacklistedDomains.some(domain => url.includes(domain));

      if (isDomainBlacklisted) {
        console.error(`🚫 URL bloquée: ${url}`);
        callback({ cancel: true });
        return;
      }

      if (url.startsWith('http://') && !url.startsWith('http://localhost')) {
        console.warn(`⚠️ Redirection HTTP vers HTTPS: ${url}`);
        callback({ redirectURL: url.replace('http://', 'https://') });
        return;
      }

      callback({});
    });
  }

  /**
   * Initialiser la sécurité complète pour Electron
   */
  initialize(mainWindow = null) {
    this.setupSecureSession();
    this.setupPermissions();
    this.setupSecureIPC();

    if (mainWindow && mainWindow.webContents) {
      this.setupURLFilter(mainWindow.webContents);
    }

    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
          shell.openExternal(url);
          return { action: 'deny' };
        }
        return { action: 'allow' };
      });
    }
  }
}

module.exports = ElectronSecurity;
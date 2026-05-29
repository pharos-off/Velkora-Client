let ipcRenderer;
try {
  if (window && window.electron && window.electron.ipcRenderer) {
    ipcRenderer = window.electron.ipcRenderer;
  } else if (typeof require === 'function') {
    try {
      const _electron = require('electron');
      ipcRenderer = _electron && _electron.ipcRenderer ? _electron.ipcRenderer : _electron;
    } catch (_) {
      ipcRenderer = null;
    }
  } else {
    ipcRenderer = null;
  }
} catch (e) {
  ipcRenderer = null;
}
const LauncherVersion = require('../main/launcher-version.js');
const UIFeedback = require('./ui-feedback.js');
const { icons: lucideIcons } = require('./lucide-icons.js');

let originalSettings = {};
let currentSettings = {};
const ui = new UIFeedback({ namespace: 'settings-ui' });
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

ipcRenderer.on('play-notification-sound', (event, { volume = 0.5 } = {}) => {
  playNotificationSound(volume);
});

function installAlertBridge() {
  window.alert = (message) => {
    const normalizedMessage = ui.normalizeMessage(message);
    const type = ui.inferType(message);
    const defaultTitle = {
      success: 'Operation terminee',
      error: 'Action impossible',
      info: 'Information'
    };

    ui.showDialog({
      title: defaultTitle[type] || defaultTitle.info,
      message: normalizedMessage,
      type
    });
  };
}

// ✅ ÉCOUTER LES SIGNAUX DE NAVIGATION
ipcRenderer.on('navigate-to-tab', (event, tabName) => {
  setTimeout(() => {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabButton) {
      tabButton.click();
      console.log(`✅ Navigation vers l'onglet: ${tabName}`);
      if (tabName === 'discord') {
        setTimeout(() => {
          try {
            if (!discordTestManager) initDiscordTest();
            const btn = document.getElementById('test-discord-btn');
            if (btn) btn.click();
          } catch (_) {}
        }, 300);
      }
    }
  }, 300);
});

async function loadSettings() {
  try {
    const settings = await ipcRenderer.invoke('get-settings');
    originalSettings = JSON.parse(JSON.stringify(settings));
    currentSettings = JSON.parse(JSON.stringify(settings));
    
    const gameDirInput = document.getElementById('game-dir-input');
    const discordToggle = document.getElementById('discord-rpc-toggle');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const ramSlider = document.getElementById('ram-slider');
    const ramValue = document.getElementById('ram-value');
    const ramHelpText = document.getElementById('ram-help-text');
    const startupToggle = document.getElementById('startup-toggle');
    
    // Get actual system RAM
    const systemRam = await ipcRenderer.invoke('get-system-ram');
    const startupEnabled = await ipcRenderer.invoke('get-startup-enabled');
    
    if (gameDirInput) {
      gameDirInput.value = settings.gameDirectory || '';
      gameDirInput.placeholder = 'Par défaut: AppData/Roaming/.minecraft';
    }
    if (discordToggle) discordToggle.checked = settings.discordRPC || false;
    if (fullscreenToggle) fullscreenToggle.checked = settings.fullscreen || false;
    const showLogsToggle = document.getElementById('show-logs-toggle');
    if (showLogsToggle) showLogsToggle.checked = settings.showLogsWindow !== undefined ? settings.showLogsWindow : true;
    const closeOnLaunchToggle = document.getElementById('close-launcher-toggle');
    if (closeOnLaunchToggle) closeOnLaunchToggle.checked = settings.closeLauncherOnLaunch !== undefined ? settings.closeLauncherOnLaunch : false;
    const javaPathInput = document.getElementById('java-path-input');
    if (javaPathInput) javaPathInput.value = settings.javaPath || '';
    const versionSelect = document.getElementById('settings-version-select');
    if (versionSelect) {
      versionSelect.value = settings.version || versionSelect.value;
      versionSelect.dispatchEvent(new Event('change'));
    }
    if (startupToggle) startupToggle.checked = settings.startupOnBoot !== undefined ? settings.startupOnBoot : !!startupEnabled;
    if (ramSlider) {
      ramSlider.max = systemRam;
      ramSlider.value = Math.min(settings.ramAllocation || 4, systemRam);
      if (ramValue) ramValue.textContent = `${ramSlider.value} GB`;
      if (ramHelpText) ramHelpText.textContent = `Allocate between 1 and ${systemRam} GB for Minecraft`;
    }

    // ✅ Charger les paramètres de mise à jour
    const checkUpdateStartupToggle = document.getElementById('check-update-startup-toggle');
    const autoUpdateToggle = document.getElementById('auto-update-toggle');
    if (checkUpdateStartupToggle) checkUpdateStartupToggle.checked = settings.checkUpdateOnStartup !== false;
    if (autoUpdateToggle) autoUpdateToggle.checked = settings.autoUpdate !== false;
  } catch (error) {
    console.error('Erreur chargement parametres:', error);
  }
}

async function loadAccountInfo() {
  try {
    const accountInfo = await ipcRenderer.invoke('get-account-info');
    const accountNameEl = document.getElementById('account-username');
    const accountEmailEl = document.getElementById('account-email');
    const accountStatusEl = document.getElementById('account-status');
    
    if (accountInfo && accountInfo.username) {
      if (accountNameEl) accountNameEl.textContent = accountInfo.username;
      if (accountEmailEl) accountEmailEl.textContent = accountInfo.id || accountInfo.uuid || 'N/A';
      if (accountStatusEl) accountStatusEl.innerHTML = '<span style="color: #10b981;">En ligne</span>';
    } else {
      if (accountStatusEl) accountStatusEl.innerHTML = '<span style="color: #ef4444;">Pas connecté</span>';
    }
  } catch (error) {
    console.error('Erreur chargement compte:', error);
  }
}

// ✅ CACHE POUR LES INFOS DE STOCKAGE
let storageInfoCache = null;
let lastStorageLoadTime = 0;
const STORAGE_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

async function loadStorageInfo() {
  try {
    const now = Date.now();
    
    // Ne recharger que toutes les 5 minutes
    if (storageInfoCache && (now - lastStorageLoadTime) < STORAGE_CACHE_TIME) {
      displayStorageInfo(storageInfoCache);
      return;
    }
    
    const storageInfo = await ipcRenderer.invoke('get-storage-info');
    
    if (storageInfo && storageInfo.success) {
      storageInfoCache = storageInfo;
      lastStorageLoadTime = now;
      displayStorageInfo(storageInfo);
    }
  } catch (error) {
    console.error('Erreur chargement stockage:', error);
  }
}

function displayStorageInfo(storageInfo) {
  const gamePathEl = document.getElementById('storage-game-path');
  const totalSizeEl = document.getElementById('storage-total-size');
  const usedSpaceEl = document.getElementById('storage-used-space');
  const freeSpaceEl = document.getElementById('storage-free-space');
  const progressBarEl = document.getElementById('storage-progress');
  
  if (gamePathEl) gamePathEl.textContent = storageInfo.gamePath;
  if (totalSizeEl) totalSizeEl.textContent = storageInfo.totalGB + ' GB';
  if (usedSpaceEl) usedSpaceEl.textContent = storageInfo.usedGB + ' GB';
  if (freeSpaceEl) freeSpaceEl.textContent = storageInfo.freeGB + ' GB';
  
  const percentage = (storageInfo.usedGB / storageInfo.totalGB) * 100;
  if (progressBarEl) {
    progressBarEl.style.width = percentage + '%';
    progressBarEl.textContent = percentage.toFixed(1) + '%';
    
    if (percentage > 90) {
      progressBarEl.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    } else if (percentage > 70) {
      progressBarEl.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    } else {
      progressBarEl.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  }
}

async function loadNotificationSettings() {
  try {
    const notifSettings = await ipcRenderer.invoke('get-notification-settings');
    
    const launchNotifToggle = document.getElementById('launch-notif-toggle');
    const downloadNotifToggle = document.getElementById('download-notif-toggle');
    const updateNotifToggle = document.getElementById('update-notif-toggle');
    const errorNotifToggle = document.getElementById('error-notif-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    
    if (notifSettings) {
      if (launchNotifToggle) launchNotifToggle.checked = notifSettings.launchNotif !== false;
      if (downloadNotifToggle) downloadNotifToggle.checked = notifSettings.downloadNotif !== false;
      if (updateNotifToggle) updateNotifToggle.checked = notifSettings.updateNotif !== false;
      if (errorNotifToggle) errorNotifToggle.checked = notifSettings.errorNotif !== false;
      if (soundToggle) soundToggle.checked = notifSettings.sound !== false;
      if (volumeSlider) volumeSlider.value = notifSettings.volume || 50;
      if (volumeValue) volumeValue.textContent = (notifSettings.volume || 50) + '%';
    }
  } catch (error) {
    console.error('Erreur chargement notifications:', error);
  }
}

async function loadDiscordSettings() {
  try {
    const discordSettings = await ipcRenderer.invoke('get-discord-settings');
    
    const rpcToggle = document.getElementById('discord-rpc-main-toggle');
    const statusToggle = document.getElementById('discord-status-toggle');
    const detailsToggle = document.getElementById('discord-details-toggle');
    const imageToggle = document.getElementById('discord-image-toggle');
    const connectionStatusEl = document.getElementById('discord-connection-status');
    
    if (discordSettings) {
      if (rpcToggle) rpcToggle.checked = discordSettings.rpcEnabled !== false;
      if (statusToggle) statusToggle.checked = discordSettings.showStatus !== false;
      if (detailsToggle) detailsToggle.checked = discordSettings.showDetails !== false;
      if (imageToggle) imageToggle.checked = discordSettings.showImage !== false;
      
      // Mettre à jour le statut de la connexion
      if (connectionStatusEl) {
        if (discordSettings.isConnected) {
          connectionStatusEl.innerHTML = '<span style="color: #10b981;">Connecté</span>';
        } else {
          connectionStatusEl.innerHTML = '<span style="color: #ef4444;">Déconnecté</span>';
        }
      }
    }
  } catch (error) {
    console.error('Erreur chargement Discord:', error);
  }
}

// ✅ Écouter les changements de statut Discord en temps réel
ipcRenderer.on('discord-status-changed', (event, status) => {
  console.log('📡 Discord status updated:', status);
  loadDiscordSettings();
});

function setupSearchFunctionality() {
  const searchInput = document.querySelector('.search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      document.querySelectorAll('.menu-category').forEach(btn => {
        btn.style.display = 'flex';
      });
      return;
    }

    const tabKeywords = {
      'game': ['game', 'jeu', 'minecraft', 'option', 'version'],
      'general': ['general', 'parametres', 'ram', 'memoire', 'repertoire', 'dossier', 'discord', 'integration', 'allocation'],
      'account': ['account', 'compte', 'utilisateur', 'email', 'profil', 'deconnexion', 'authentification'],
      'storage': ['storage', 'stockage', 'espace', 'disque', 'cache', 'dossier', 'minecraft', 'libre'],
      'notifications': ['notifications', 'notification', 'alerte', 'son', 'volume', 'lancement', 'telechargement', 'mise', 'jour', 'erreur'],
      'discord': ['discord', 'rpc', 'presence', 'statut', 'rich', 'connexion', 'connection'],
      'about': ['about', 'apropos', 'version', 'developpeur', 'licence', 'technologie', 'fonctionnalite', 'information']
    };

    document.querySelectorAll('.menu-category').forEach(btn => {
      const tabName = btn.dataset.tab;
      const keywords = tabKeywords[tabName] || [];
      const btnText = btn.textContent.toLowerCase();
      
      const matches = keywords.some(keyword => keyword.includes(searchTerm)) ||
                      btnText.includes(searchTerm);
      
      btn.style.display = matches ? 'flex' : 'none';
    });
  });
}

/**
 * ============================================
 * DISCORD RPC TEST HANDLER - VERSION COMPLÈTE
 * ============================================
 */

class DiscordTestManager {
  constructor() {
    this.testButton = null;
    this.statusIndicator = null;
    this.statusText = null;
    this.connectionInfo = null;
    this.lastTestTime = 0;
    this.testCooldown = 3000; // 3 secondes
    this.autoCheckInterval = null;
  }

  init() {
    setTimeout(() => {
      this.testButton = document.getElementById('test-discord-btn');
      this.statusIndicator = document.getElementById('discord-status-indicator');
      this.statusText = document.getElementById('discord-status-text');
      this.connectionInfo = document.getElementById('discord-connection-info');

      if (this.testButton) {
        this.setupTestButton();
      }

      this.setupEventListeners();
    }, 500);
  }

  setupTestButton() {
    this.testButton.addEventListener('click', () => this.handleTest());
  }

  setupEventListeners() {
    ipcRenderer.on('discord-connected', (event, user) => {
      this.updateStatus('connected', user);
      this.showNotification('Discord connecté', 'success');
    });

    ipcRenderer.on('discord-disconnected', () => {
      this.updateStatus('disconnected');
      this.showNotification('Discord déconnecté', 'warning');
    });

    ipcRenderer.on('discord-connecting', () => {
      this.updateStatus('connecting');
    });

    ipcRenderer.on('discord-error', (event, error) => {
      this.updateStatus('error', null, error);
      this.showNotification('Erreur Discord: ' + error.message, 'error');
    });

    ipcRenderer.on('discord-activity-updated', (event, activity) => {
      console.log('Discord activity updated:', activity.details);
    });
  }

  async checkInitialStatus() {
    try {
      const status = await ipcRenderer.invoke('get-discord-status');
      this.updateStatus(
        status.connected ? 'connected' : 'disconnected',
        status.user
      );
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }

  async handleTest() {
    const now = Date.now();
    if (now - this.lastTestTime < this.testCooldown) {
      const remaining = Math.ceil((this.testCooldown - (now - this.lastTestTime)) / 1000);
      this.showNotification(`Attendez ${remaining}s avant de retester`, 'warning');
      return;
    }

    this.setButtonLoading(true);

    try {
      const result = await ipcRenderer.invoke('test-discord-rpc');
      this.lastTestTime = now;

      if (result.success) {
        this.handleTestSuccess(result);
      } else {
        this.handleTestError(result);
      }

      if (result.status) {
        this.updateStatus(
          result.status.connected ? 'connected' : 'disconnected',
          result.user,
          null,
          result.status
        );
      }

    } catch (error) {
      this.handleTestException(error);
    } finally {
      this.setButtonLoading(false);
    }
  }

  handleTestSuccess(result) {
    const username = result.user?.username || 'Utilisateur';
    const discriminator = result.user?.discriminator;
    const fullUsername = discriminator && discriminator !== '0' 
      ? `${username}#${discriminator}` 
      : username;

    this.showNotification(
      `Discord connecté\nCompte: ${fullUsername}`,
      'success'
    );

    this.animateSuccess();
  }

  handleTestError(result) {
    let errorMessage = 'Discord non disponible';

    if (result.status) {
      if (result.status.connecting) {
        errorMessage = 'Connexion en cours...\nVeuillez patienter.';
      } else if (result.status.reconnectAttempts > 0) {
        errorMessage = `Reconnexion (${result.status.reconnectAttempts})...`;
      } else {
        errorMessage = result.message || errorMessage;
      }
    }

    this.showNotification(errorMessage, 'error');
  }

  handleTestException(error) {
    console.error('Erreur test Discord:', error);

    let errorMsg = 'Erreur lors du test';

    if (error.message.includes('Discord is not running')) {
      errorMsg = 'Discord n\'est pas lancé\nVeuillez démarrer Discord et réessayer.';
    } else if (error.message.includes('timeout')) {
      errorMsg = 'Délai d\'attente dépassé\nDiscord ne répond pas.';
    } else {
      errorMsg = `Erreur: ${error.message}`;
    }

    this.showNotification(errorMsg, 'error');
  }

  updateStatus(status, user = null, error = null, fullStatus = null) {
    if (this.statusIndicator) {
      this.statusIndicator.className = 'discord-status-indicator';
      this.statusIndicator.classList.add(status);
    }

    if (this.statusText) {
      let statusMessage = 'Non connecté';

      switch (status) {
        case 'connected':
          statusMessage = user 
            ? `Connecté (${user.username})`
            : 'Connecté';
          break;
        case 'connecting':
          statusMessage = 'Connexion...';
          break;
        case 'disconnected':
          statusMessage = 'Non connecté';
          break;
        case 'error':
          statusMessage = `Erreur: ${error?.message || 'Inconnue'}`;
          break;
      }

      this.statusText.textContent = statusMessage;
    }

    if (this.connectionInfo && fullStatus) {
      let infoHTML = '';

      if (fullStatus.connected && user) {
        infoHTML = `
          <div class="connection-detail">
            <span class="detail-label">Utilisateur:</span>
            <span class="detail-value">${user.username}${user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : ''}</span>
          </div>
          <div class="connection-detail">
            <span class="detail-label">ID:</span>
            <span class="detail-value">${user.id || 'N/A'}</span>
          </div>
        `;
      } else if (fullStatus.reconnectAttempts > 0) {
        infoHTML = `
          <div class="connection-detail">
            <span class="detail-label">Tentatives de reconnexion:</span>
            <span class="detail-value">${fullStatus.reconnectAttempts}</span>
          </div>
        `;
      }

      this.connectionInfo.innerHTML = infoHTML;
    }

    if (this.testButton) {
      if (status === 'connected') {
        this.testButton.classList.add('success');
        this.testButton.classList.remove('error');
      } else if (status === 'error') {
        this.testButton.classList.add('error');
        this.testButton.classList.remove('success');
      } else {
        this.testButton.classList.remove('success', 'error');
      }
    }
  }

  setButtonLoading(loading) {
    if (!this.testButton) return;

    this.testButton.disabled = loading;

    if (loading) {
      this.testButton.dataset.originalText = this.testButton.textContent;
      this.testButton.innerHTML = `
        <div class="btn-content">
          <span class="spinner"></span>
          <span>Test en cours...</span>
        </div>
      `;
      this.testButton.classList.add('loading');
    } else {
      this.testButton.textContent = this.testButton.dataset.originalText || 'Tester la connexion Discord';
      this.testButton.classList.remove('loading');
    }
  }

  animateSuccess() {
    if (!this.testButton) return;

    this.testButton.classList.add('pulse-success');
    setTimeout(() => {
      this.testButton.classList.remove('pulse-success');
    }, 1000);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast-notification toast-${type}`;
    
    const icon = this.getNotificationIcon(type);
    
    notification.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-message">${message.replace(/\n/g, '<br>')}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(notification);

    const closeBtn = notification.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
      this.removeNotification(notification);
    }, 5000);
  }

  removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }

  getNotificationIcon(type) {
    const icons = {
      success: 'OK',
      error: 'ERROR',
      warning: 'WARN',
      info: 'INFO'
    };
    return icons[type] || icons.info;
  }

  startAutoCheck() {
    this.autoCheckInterval = setInterval(() => {
      this.checkInitialStatus();
    }, 30000);
  }

  destroy() {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
    }

    ipcRenderer.removeAllListeners('discord-connected');
    ipcRenderer.removeAllListeners('discord-disconnected');
    ipcRenderer.removeAllListeners('discord-connecting');
    ipcRenderer.removeAllListeners('discord-error');
    ipcRenderer.removeAllListeners('discord-activity-updated');
  }
}

let discordTestManager = null;

function initDiscordTest() {
  discordTestManager = new DiscordTestManager();
  discordTestManager.init();
}

function renderSettings() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="titlebar">
      <div class="titlebar-title">Parametres - ${LauncherVersion.getName()}</div>
      <div class="titlebar-buttons">
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

    <div class="settings-layout">
      <div class="settings-sidebar">
        <div class="settings-search">
          <input type="text" class="search-input" placeholder="Rechercher...">
        </div>
        <div class="settings-menu">
          <button class="menu-category active" data-tab="game">
            <span class="menu-icon"><i class="bi bi-controller"></i></span><span class="menu-text">Game</span>
          </button>
          <button class="menu-category" data-tab="general">
            <span class="menu-icon"><i class="bi bi-gear"></i></span><span class="menu-text">General</span>
          </button>
          <button class="menu-category" data-tab="account">
            <span class="menu-icon"><i class="bi bi-person-circle"></i></span><span class="menu-text">Account</span>
          </button>
          <button class="menu-category" data-tab="storage">
            <span class="menu-icon"><i class="bi bi-hdd"></i></span><span class="menu-text">Storage</span>
          </button>
          <button class="menu-category" data-tab="notifications">
            <span class="menu-icon"><i class="bi bi-bell"></i></span><span class="menu-text">Notifications</span>
          </button>
          <button class="menu-category" data-tab="discord">
            <span class="menu-icon"><i class="bi bi-discord"></i></span><span class="menu-text">Discord</span>
          </button>
          <button class="menu-category" data-tab="updates">
            <span class="menu-icon"><i class="bi bi-download"></i></span><span class="menu-text">Mises a jour</span>
          </button>
          <button class="menu-category" data-tab="about">
            <span class="menu-icon"><i class="bi bi-info-circle"></i></span><span class="menu-text">A propos</span>
          </button>
        </div>

        <div class="settings-footer">
          <p>${LauncherVersion.getFullVersion()}</p>
          <p>2026 Tous droits reserves</p>
        </div>
      </div>

      <div class="settings-content">
        <div class="settings-section" id="game-tab">
          <h2>Paramètres du jeu</h2>
          
          <div class="settings-card">
            <h3>Version de Minecraft</h3>
            <div class="setting-item">
              <label>Version utilisée (profil principal)</label>
              <select id="settings-version-select" class="input-field">
                <option value="26.1.2">26.1.2</option>
                <option value="26.1.1">26.1.1</option>
                <option value="1.21.11">1.21.11</option>
                <option value="1.21.10">1.21.10</option>
                <option value="1.21.9">1.21.9</option>
                <option value="1.21.8">1.21.8</option>
                <option value="1.21.7">1.21.7</option>
                <option value="1.21.6">1.21.6</option>
                <option value="1.21.5">1.21.5</option>
                <option value="1.21.4">1.21.4</option>
                <option value="1.21.3">1.21.3</option>
                <option value="1.21.2">1.21.2</option>
                <option value="1.21.1">1.21.1</option>
                <option value="1.21">1.21</option>
                <option value="1.20.6">1.20.6</option>
                <option value="1.20.4">1.20.4</option>
                <option value="1.20.2">1.20.2</option>
                <option value="1.20.1">1.20.1</option>
                <option value="1.20">1.20</option>
                <option value="1.19.4">1.19.4</option>
                <option value="1.19.2">1.19.2</option>
                <option value="1.19">1.19</option>
                <option value="1.18.2">1.18.2</option>
                <option value="1.16.5">1.16.5</option>
                <option value="1.12.2">1.12.2</option>
                <option value="1.8.9">1.8.9</option>
              </select>
              <p class="help-text">Change la version pour le profil principal</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Serveur par défaut</h3>
            <div class="setting-item">
              <label>Adresse du serveur (ex: play.hypixel.net ou ip:port)</label>
              <input type="text" id="default-server-input" class="input-field" placeholder="exemple.com">
              <p class="help-text">Utilisé quand vous cliquez sur Rejoindre rapide ou quand aucun serveur n'est choisi</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Java (optionnel)</h3>
            <div class="setting-item">
              <label>Version Java requise pour cette version MC:</label>
              <p id="java-required-version" style="color: #10b981; padding: 10px 0; font-weight: 600; font-size: 14px;">Java 21</p>
              <p class="help-text">Change automatiquement selon la version Minecraft sélectionnée</p>
            </div>
            <div class="setting-item" style="margin-top: 16px;">
              <label>Chemin vers javaw.exe</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="java-path-input" class="input-field" placeholder="exemple: C:\\Program Files\\Java\\jdk-25.0.1\\bin\\javaw.exe" style="flex: 1;">
                <button id="detect-java-btn" class="dir-browse-btn" style="min-width: 100px;"><span style="display: inline-flex; width: 16px; height: 16px;">${lucideIcons.magnifyingGlass}</span> Détecter</button>
              </div>
              <p id="java-detected-path" class="help-text" style="margin-top: 8px; color: #cbd5e1;">Cliquez sur &quot;Détecter&quot; pour chercher Java automatiquement</p>
              <p class="help-text">Laisse vide pour utiliser la configuration par défaut</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Affichage du jeu</h3>
            <div class="setting-item">
              <label>Résolution</label>
              <div style="display: flex; gap: 12px;">
                <input type="number" id="mc-width" class="input-field" min="640" max="3840" placeholder="1280" style="flex: 1;">
                <input type="number" id="mc-height" class="input-field" min="480" max="2160" placeholder="720" style="flex: 1;">
              </div>
              <p class="help-text">Définit la taille de la fenêtre Minecraft</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Comportement du lancement</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="close-launcher-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Masquer le launcher après lancement</span>
              </label>
              <p class="help-text">Cache la fenêtre principale une fois le jeu démarré</p>
            </div>
            <div class="setting-item" style="margin-top: 16px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="show-logs-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Afficher la fenêtre des logs</span>
              </label>
              <p class="help-text">Ouvre une fenêtre dédiée aux logs de lancement</p>
            </div>
            <div class="setting-item" style="margin-top: 16px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="startup-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Lancer ${LauncherVersion.getName()} au démarrage de Windows</span>
              </label>
              <p class="help-text">Ajoute l'application dans les Applications de démarrage (Gestionnaire des tâches)</p>
            </div>
          </div>

          <div class="button-group">
            <button id="save-game-settings-btn" class="btn-primary">Valider et sauvegarder</button>
          </div>
        </div>

        <div class="settings-section" id="general-tab" style="display: none;">
          <h2>Parametres generaux</h2>

          <div class="settings-card">
            <h3>Repertoire du jeu</h3>
            <div class="setting-item">
              <label>Chemin du repertoire Minecraft</label>
              <div class="dir-input-group">
                <input type="text" id="game-dir-input" class="input-field" readonly>
                <button id="browse-btn" class="dir-browse-btn">Parcourir</button>
              </div>
              <p class="help-text">Selectionner le dossier de Minecraft</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Integrations</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="discord-rpc-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Afficher votre statut sur Discord</span>
              </label>
              <p class="help-text">Permet a Discord de voir si vous jouez a Minecraft</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Affichage</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="fullscreen-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Lancer en plein écran</span>
              </label>
              <p class="help-text">Lance le launcher en mode plein écran au démarrage</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Allocation RAM</h3>
            <div class="setting-item">
              <label>Mémoire RAM</label>
              <div style="display: flex; align-items: center; gap: 12px; margin-top: 10px;">
                <input type="range" id="ram-slider" min="1" max="16" value="4" style="flex: 1; height: 6px; cursor: pointer;">
                <div style="min-width: 60px; text-align: center;">
                  <span id="ram-value" style="color: #6366f1; font-weight: 600; font-size: 14px;">4 GB</span>
                </div>
              </div>
              <p id="ram-help-text" class="help-text">Allocate between 1 and 16 GB of RAM for Minecraft</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Mises à jour du Launcher</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="check-update-startup-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Vérifier les mises à jour au démarrage</span>
              </label>
              <p class="help-text">Vérifie automatiquement les nouvelles versions au lancement</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="auto-update-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Télécharger et installer automatiquement</span>
              </label>
              <p class="help-text">Télécharge et installe les mises à jour sans confirmation</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button id="auto-install-update-btn" class="btn-primary" style="font-size: 13px; padding: 10px;">Mettre à jour (Auto)</button>
                <button id="manual-check-update-btn" class="btn-primary" style="font-size: 13px; padding: 10px;">Vérifier (Manuel)</button>
              </div>
              <p class="help-text" style="margin-top: 15px;">Auto: télécharge et installe immédiatement | Manuel: vérifier et confirmer</p>
            </div>
          </div>

          <div class="button-group">
            <button id="save-settings-btn" class="btn-primary">Valider et sauvegarder</button>
            <button id="cancel-settings-btn" class="btn-secondary">Annuler</button>
          </div>
        </div>

        <div class="settings-section" id="account-tab" style="display: none;">
          <h2>Compte</h2>
          <div class="settings-card">
            <h3>Informations du compte</h3>
            <div class="setting-item">
              <label>Nom d'utilisateur</label>
              <p id="account-username" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item">
              <label>ID Utilisateur</label>
              <p id="account-email" style="color: #d1d5db; padding: 10px 0; font-weight: 500; font-family: 'Courier New', monospace; word-break: break-all;">Chargement...</p>
            </div>
            <div class="setting-item">
              <label>Statut</label>
              <p id="account-status" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Actions du compte</h3>
            <button id="logout-btn" class="btn-secondary" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none;">
              Se deconnecter
            </button>
            <p class="help-text" style="margin-top: 15px;">Cliquez pour vous deconnecter de votre compte</p>
          </div>
        </div>

        <div class="settings-section" id="storage-tab" style="display: none;">
          <h2>Stockage</h2>
          <div class="settings-card">
            <h3>Informations de stockage</h3>
            <div class="setting-item">
              <label>Chemin du repertoire Minecraft</label>
              <p id="storage-game-path" style="color: #d1d5db; padding: 10px 0; font-weight: 500; word-break: break-all;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <label>Espace total</label>
              <p id="storage-total-size" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <label>Espace utilisé</label>
              <p id="storage-used-space" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <label>Espace libre</label>
              <p id="storage-free-space" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 25px;">
              <label>Barre de progression</label>
              <div style="width: 100%; height: 30px; background: rgba(99, 102, 241, 0.1); border-radius: 10px; overflow: hidden; margin-top: 10px;">
                <div id="storage-progress" style="height: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 0%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;"></div>
              </div>
              <p class="help-text">Utilisation de l'espace disque pour Minecraft</p>
            </div>
          </div>

          <div class="settings-card">
            <h3>Actions de stockage</h3>
            <div class="setting-item">
              <button id="open-storage-btn" class="btn-primary">Ouvrir le dossier Minecraft</button>
              <p class="help-text" style="margin-top: 15px;">Acceder directement au dossier d'installation</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <button id="refresh-storage-btn" class="btn-secondary">Rafraîchir les infos</button>
              <p class="help-text" style="margin-top: 15px;">Recalculer l'espace utilisé (peut prendre du temps)</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <button id="clear-cache-btn" class="btn-secondary">Vider le cache</button>
              <p class="help-text" style="margin-top: 15px;">Supprimer les fichiers temporaires (ne supprime pas les mondes)</p>
            </div>
          </div>
        </div>

        <div class="settings-section" id="notifications-tab" style="display: none;">
          <h2>Notifications</h2>
          <div class="settings-card">
            <h3>Types de notifications</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="launch-notif-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Notifier au lancement du jeu</span>
              </label>
              <p class="help-text">Vous recevrez une notification quand le jeu sera lance</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="download-notif-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Notifier au telechargement termine</span>
              </label>
              <p class="help-text">Vous recevrez une notification quand les telechargements seront termines</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="update-notif-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Notifier les mises a jour disponibles</span>
              </label>
              <p class="help-text">Vous serez informe lorsque des mises a jour sont disponibles</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="error-notif-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Notifier les erreurs</span>
              </label>
              <p class="help-text">Vous serez averti en cas d'erreur ou de probleme</p>
            </div>
          </div>

          <div class="settings-card" style="display: none;">
            <h3>Son des notifications</h3>
            <div class="setting-item">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="sound-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Activer le son des notifications</span>
              </label>
              <p class="help-text">Les notifications emetront un son</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label>Volume du son (%)</label>
              <div class="ram-input-group">
                <div class="ram-slider-container">
                  <input type="range" id="volume-slider" class="slider" min="0" max="100" value="50">
                </div>
                <div class="ram-display" id="volume-value">50%</div>
              </div>
              <p class="help-text">Regler le volume du son des notifications</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <button id="test-notif-btn" class="btn-primary">Tester une notification</button>
              <p class="help-text" style="margin-top: 15px;">Cliquez pour tester le son et l'affichage</p>
            </div>
          </div>

          <div class="button-group">
            <button id="save-notif-btn" class="btn-primary">Valider et sauvegarder</button>
            <button id="reset-notif-btn" class="btn-secondary">Reinitialiser par defaut</button>
          </div>
        </div>

        <div class="settings-section" id="discord-tab" style="display: none;">
          <h2>Discord</h2>
          
          <!-- État de la connexion avec bouton de test intégré -->
          <div class="settings-card">
            <h3>État de la connexion</h3>
            <div class="discord-connection-status">
              <div class="status-header">
                <div class="status-indicator-wrapper">
                  <span id="discord-status-indicator" class="discord-status-indicator disconnected"></span>
                  <span id="discord-status-text" class="status-text">Non connecté</span>
                </div>
              </div>
              
              <div id="discord-connection-info" class="connection-info">
                <!-- Les détails de connexion apparaîtront ici -->
              </div>
            </div>
            
            <div class="setting-item" style="margin-top: 20px;">
              <button id="test-discord-btn" class="btn-discord-test">
                Tester la connexion Discord
              </button>
              <p class="help-text" style="margin-top: 10px;">Vérifier que Discord RPC fonctionne correctement</p>
            </div>
          </div>

          <!-- Configuration Discord RPC -->
          <div class="settings-card">
            <h3>Configuration Discord RPC</h3>
            <div class="setting-item" style="margin-top: 0;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="discord-rpc-main-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Activer Discord Rich Presence</span>
              </label>
              <p class="help-text">Affiche votre statut de jeu sur Discord</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="discord-status-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Afficher votre statut de jeu</span>
              </label>
              <p class="help-text">Affiche si vous êtes en train de jouer, dans le launcher ou hors ligne</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="discord-details-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Afficher les détails du jeu</span>
              </label>
              <p class="help-text">Affiche la version de Minecraft et le serveur (si applicable)</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="discord-image-toggle" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <span>Afficher les images</span>
              </label>
              <p class="help-text">Affiche le logo Minecraft et ${LauncherVersion.getName()} dans Discord</p>
            </div>
          </div>

          <!-- Boutons de sauvegarde -->
          <div class="button-group">
            <button id="save-discord-btn" class="btn-primary">Valider et sauvegarder</button>
            <button id="reset-discord-btn" class="btn-secondary">Réinitialiser par défaut</button>
          </div>
        </div>

        <div class="settings-section" id="updates-tab" style="display: none;">
          <h2>Mises a jour</h2>
          <div class="settings-card">
            <h3>Etat des mises a jour</h3>
            <div class="setting-item">
              <label>Version actuelle</label>
              <p id="current-version" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <label>Derniere version disponible</label>
              <p id="latest-version" style="color: #d1d5db; padding: 10px 0; font-weight: 500;">Chargement...</p>
            </div>
            <div class="setting-item" style="margin-top: 20px;">
              <label>Statut</label>
              <p id="update-status" style="color: #10b981; padding: 10px 0; font-weight: 500;">Verifiant les mises a jour...</p>
            </div>

            <div class="setting-item" style="margin-top: 20px; display: none;" id="changelog-container">
              <label>Changelog</label>
              <div style="margin-top: 10px; padding: 12px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; max-height: 250px; overflow-y: auto; border-left: 3px solid #6366f1;">
                <pre id="release-notes" style="color: #cbd5e1; font-size: 12px; line-height: 1.5; margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">Chargement...</pre>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <h3>Actions</h3>
            <div class="setting-item">
              <button id="check-updates-btn" class="btn-primary" style="width: 100%;">Verifier les mises a jour</button>
              <p class="help-text" style="margin-top: 15px;">Clique pour chercher de nouvelles versions disponibles</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <button id="install-update-btn" class="btn-primary" style="width: 100%; background: #10b981; display: none;">Installer la mise a jour</button>
              <p class="help-text" style="margin-top: 15px;">Telecharge et installe la derniere version</p>
            </div>

            <div class="setting-item" style="margin-top: 20px;">
              <div id="update-progress-container" style="display: none;">
                <label>Progression du telechargement</label>
                <div style="width: 100%; height: 30px; background: rgba(99, 102, 241, 0.1); border-radius: 10px; overflow: hidden; margin-top: 10px;">
                  <div id="update-progress-bar" style="height: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 0%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px;">0%</div>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <h3>Informations</h3>
            <p style="color: #d1d5db; line-height: 1.8;">
              Le launcher verifiera automatiquement les nouvelles versions au demarrage. 
              Vous pouvez aussi verifier manuellement en cliquant sur le bouton ci-dessus.
            </p>
            <p style="color: #94a3b8; line-height: 1.8; margin-top: 15px;">
              <strong style="color: #6366f1;">Note:</strong> L'application se relancera automatiquement apres l'installation.
            </p>
          </div>
        </div>

        <div class="settings-section" id="about-tab" style="display: none;">
          <h2>A propos</h2>
          <div class="settings-card">
            <h3>${LauncherVersion.getName()}</h3>
            <p style="color: #d1d5db; line-height: 1.8; margin-bottom: 20px;">
              <strong style="color: #6366f1; font-size: 16px;">Version:</strong> ${LauncherVersion.getVersionString()}<br>
              <strong style="color: #6366f1;">Developpeur:</strong> Pharos<br>
              <strong style="color: #6366f1;">Licence:</strong> VMv1<br>
            </p>
          </div>

          <div class="settings-card">
            <h3>Description</h3>
            <p style="color: #d1d5db; line-height: 1.8;">
              ${LauncherVersion.getName()} est un launcher Minecraft complet et moderne offrant une experience utilisateur exceptionnelle. 
              Le projet combine la puissance d'Electron avec Node.js pour fournir une application de bureau performante et intuitive.
            </p>
          </div>

          <div class="settings-card">
            <h3>Fonctionnalites principales</h3>
            <ul style="color: #d1d5db; line-height: 2; list-style: none; padding: 0;">
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Authentification Microsoft premium</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Gestion complète des profils</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Support Discord Rich Presence</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Gestion des mods et versions</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Notifications en temps reel</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Gestionnaire de stockage integre</span>
              </li>
              <li style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>Interface utilisateur moderne et responsive</span>
              </li>
            </ul>
          </div>

          <div class="settings-card">
            <h3>Technologies utilisees</h3>
            <p style="color: #d1d5db; line-height: 1.8;">
              <strong style="color: #6366f1;">Frontend:</strong> HTML5, CSS3, JavaScript vanilla<br>
              <strong style="color: #6366f1;">Backend:</strong> Node.js, Electron<br>
              <strong style="color: #6366f1;">Base de donnees:</strong> electron-store<br>
              <strong style="color: #6366f1;">Integration:</strong> Discord RPC, Minecraft API
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // ✅ TITLEBAR BUTTONS - Utiliser .closest() pour gérer les clics sur les SVG enfants
  document.addEventListener('click', (e) => {
    const minimizeBtn = e.target.closest('#minimize-btn');
    const maximizeBtn = e.target.closest('#maximize-btn');
    const closeBtn = e.target.closest('#close-btn');
    
    if (minimizeBtn) ipcRenderer.send('minimize-settings-window');
    else if (maximizeBtn) ipcRenderer.send('maximize-settings-window');
    else if (closeBtn) ipcRenderer.send('close-settings-window');
  });

  // ✅ TABS MENU
  document.querySelectorAll('.menu-category').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-category').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
      
      btn.classList.add('active');
      const tabId = btn.dataset.tab + '-tab';
      const section = document.getElementById(tabId);
      if (section) section.style.display = 'block';
      if (btn.dataset.tab === 'discord') {
        setTimeout(() => {
          try {
            if (!discordTestManager) initDiscordTest();
            const btnTest = document.getElementById('test-discord-btn');
            if (btnTest) btnTest.click();
          } catch (_) {}
        }, 250);
      }
    });
  });

  // ✅ SETUP RECHERCHE
  setupSearchFunctionality();

  // ✅ PARCOURIR REPERTOIRE
  const browseBtn = document.getElementById('browse-btn');
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      const result = await ipcRenderer.invoke('select-game-directory');
      if (result.success) {
        document.getElementById('game-dir-input').value = result.path;
        currentSettings.gameDirectory = result.path;
      }
    });
  }

  // ✅ STARTUP TOGGLE (DÉMARRAGE WINDOWS)
  const startupToggle = document.getElementById('startup-toggle');
  if (startupToggle) {
    startupToggle.addEventListener('change', async (e) => {
      try {
        const enabled = !!e.target.checked;
        currentSettings.startupOnBoot = enabled;
        await ipcRenderer.invoke('set-startup-enabled', enabled);
      } catch (error) {
        console.error('Erreur startup-toggle:', error);
      }
    });
  }

  // ✅ DISCORD TOGGLE
  const discordToggle = document.getElementById('discord-rpc-toggle');
  if (discordToggle) {
    discordToggle.addEventListener('change', (e) => {
      currentSettings.discordRPC = e.target.checked;
    });
  }

  // ✅ LOGOUT
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const confirmed = await ui.showConfirm({
        title: 'Se deconnecter ?',
        message: 'La session actuelle sera fermee sur le launcher.',
        confirmLabel: 'Se deconnecter',
        cancelLabel: 'Annuler',
        type: 'error'
      });
      if (confirmed) {
        try {
          logoutBtn.disabled = true;
          logoutBtn.textContent = 'Déconnexion...';
          ui.showToast({
            title: 'Deconnexion en cours',
            message: 'La session est en train d etre fermee.',
            type: 'info'
          });
          await ipcRenderer.invoke('logout-account');
          ipcRenderer.send('close-settings-window');
          ipcRenderer.send('logout-from-settings');
        } catch (error) {
          alert('Erreur lors de la déconnexion');
          logoutBtn.disabled = false;
          logoutBtn.textContent = 'Se déconnecter';
        }
      }
    });
  }

  // ✅ STORAGE - OUVRIR DOSSIER
  const openStorageBtn = document.getElementById('open-storage-btn');
  if (openStorageBtn) {
    openStorageBtn.addEventListener('click', async () => {
      await ipcRenderer.invoke('open-minecraft-folder');
    });
  }

  // ✅ STORAGE - RAFRAÎCHIR LES INFOS
  const refreshStorageBtn = document.getElementById('refresh-storage-btn');
  if (refreshStorageBtn) {
    refreshStorageBtn.addEventListener('click', async () => {
      refreshStorageBtn.disabled = true;
      refreshStorageBtn.textContent = 'Calcul en cours...';
      
      lastStorageLoadTime = 0;
      storageInfoCache = null;
      
      await loadStorageInfo();
      
      refreshStorageBtn.disabled = false;
      refreshStorageBtn.textContent = 'Rafraîchir les infos';
    });
  }

  // ✅ STORAGE - VIDER CACHE
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      const confirmed = await ui.showConfirm({
        title: 'Vider le cache ?',
        message: 'Les fichiers temporaires de Minecraft seront supprimes.',
        confirmLabel: 'Vider le cache',
        cancelLabel: 'Annuler',
        type: 'error'
      });
      if (confirmed) {
        const result = await ipcRenderer.invoke('clear-minecraft-cache');
        if (result.success) {
          alert(result.message);
          await loadStorageInfo();
        }
      }
    });
  }

  // ✅ VOLUME SLIDER
  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      document.getElementById('volume-value').textContent = e.target.value + '%';
    });
  }

  // ✅ TEST NOTIFICATION
  const testNotifBtn = document.getElementById('test-notif-btn');
  if (testNotifBtn) {
    testNotifBtn.addEventListener('click', async () => {
      try {
        const soundEnabled = document.getElementById('sound-toggle')?.checked;
        const volumeValue = parseInt(document.getElementById('volume-slider')?.value, 10);
        const result = await ipcRenderer.invoke('test-notification', {
          sound: soundEnabled,
          volume: Number.isFinite(volumeValue) ? volumeValue : 50
        });

        if (result.success) {
          ui.showToast({
            title: 'Test de notification',
            message: 'La notification de test a été envoyée.',
            type: 'success',
            duration: 3500
          });
        } else {
          ui.showToast({
            title: 'Erreur',
            message: result.error || 'Impossible d\'envoyer la notification de test.',
            type: 'error'
          });
        }
      } catch (error) {
        console.error('Erreur notification:', error);
        ui.showToast({
          title: 'Erreur',
          message: error.message || 'Impossible d\'envoyer la notification de test.',
          type: 'error'
        });
      }
    });
  }

  // ✅ SAVE NOTIFICATIONS
  const saveNotifBtn = document.getElementById('save-notif-btn');
  if (saveNotifBtn) {
    saveNotifBtn.addEventListener('click', async () => {
      const btn = saveNotifBtn;
      btn.disabled = true;
      btn.textContent = 'Sauvegarde en cours...';

      try {
        const notifSettings = {
          launchNotif: document.getElementById('launch-notif-toggle').checked,
          downloadNotif: document.getElementById('download-notif-toggle').checked,
          updateNotif: document.getElementById('update-notif-toggle').checked,
          errorNotif: document.getElementById('error-notif-toggle').checked,
          sound: document.getElementById('sound-toggle').checked,
          volume: parseInt(document.getElementById('volume-slider').value)
        };

        const result = await ipcRenderer.invoke('save-notification-settings', notifSettings);
        alert('Parametres de notifications sauvegardes !');
      } catch (error) {
        alert('Erreur lors de la sauvegarde');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Valider et sauvegarder';
      }
    });
  }

  // ✅ RESET NOTIFICATIONS
  const resetNotifBtn = document.getElementById('reset-notif-btn');
  if (resetNotifBtn) {
    resetNotifBtn.addEventListener('click', async () => {
      const confirmed = await ui.showConfirm({
        title: 'Reinitialiser les notifications ?',
        message: 'Tous les parametres de notifications seront restaures par defaut.',
        confirmLabel: 'Reinitialiser',
        cancelLabel: 'Annuler',
        type: 'error'
      });
      if (confirmed) {
        try {
          await ipcRenderer.invoke('reset-notification-settings');
          alert('Notifications reinitialisees !');
          await loadNotificationSettings();
        } catch (error) {
          alert('Erreur');
        }
      }
    });
  }

  // ✅ RECONNECT DISCORD
  const reconnectDiscordBtn = document.getElementById('reconnect-discord-btn');
  if (reconnectDiscordBtn) {
    reconnectDiscordBtn.addEventListener('click', async () => {
      const btn = reconnectDiscordBtn;
      btn.disabled = true;
      btn.textContent = 'Reconnexion en cours...';

      try {
        const result = await ipcRenderer.invoke('reconnect-discord-rpc');
        if (result.success) {
          alert('Discord reconnecté !');
          await loadDiscordSettings();
        } else {
          alert('Impossible de reconnecter Discord');
        }
      } catch (error) {
        alert('Erreur');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Reconnecter Discord';
      }
    });
  }

  // ✅ SAVE DISCORD
  const saveDiscordBtn = document.getElementById('save-discord-btn');
  if (saveDiscordBtn) {
    saveDiscordBtn.addEventListener('click', async () => {
      const btn = saveDiscordBtn;
      btn.disabled = true;
      btn.textContent = 'Sauvegarde en cours...';

      try {
        const discordSettings = {
          rpcEnabled: document.getElementById('discord-rpc-main-toggle').checked,
          showStatus: document.getElementById('discord-status-toggle').checked,
          showDetails: document.getElementById('discord-details-toggle').checked,
          showImage: document.getElementById('discord-image-toggle').checked
        };

        await ipcRenderer.invoke('save-discord-settings', discordSettings);
        alert('Parametres Discord sauvegardes !');
      } catch (error) {
        alert('Erreur lors de la sauvegarde');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Valider et sauvegarder';
      }
    });
  }

  // ✅ RESET DISCORD
  const resetDiscordBtn = document.getElementById('reset-discord-btn');
  if (resetDiscordBtn) {
    resetDiscordBtn.addEventListener('click', async () => {
      const confirmed = await ui.showConfirm({
        title: 'Reinitialiser Discord ?',
        message: 'Les parametres Discord reviendront a leur configuration par defaut.',
        confirmLabel: 'Reinitialiser',
        cancelLabel: 'Annuler',
        type: 'error'
      });
      if (confirmed) {
        try {
          await ipcRenderer.invoke('reset-discord-settings');
          alert('Parametres Discord reinitialisés !');
          await loadDiscordSettings();
        } catch (error) {
          alert('Erreur');
        }
      }
    });
  }

  // ✅ RAM SLIDER - AUTO SAVE
  const ramSlider = document.getElementById('ram-slider');
  const ramValue = document.getElementById('ram-value');
  let ramSaveTimeout;
  if (ramSlider) {
    ramSlider.addEventListener('input', (e) => {
      const ramGB = parseInt(e.target.value);
      ramValue.textContent = `${ramGB} GB`;
      
      // Auto-save with delay
      clearTimeout(ramSaveTimeout);
      ramSaveTimeout = setTimeout(async () => {
        try {
          const settings = await ipcRenderer.invoke('get-settings');
          settings.ramAllocation = ramGB;
          await ipcRenderer.invoke('save-settings', settings);
          console.log(`✅ RAM allocation sauvegardée: ${ramGB}GB`);
          ramValue.style.color = '#10b981';
          setTimeout(() => { ramValue.style.color = ''; }, 1000);
        } catch (error) {
          console.error('Erreur sauvegarde RAM:', error);
          ramValue.style.color = '#ef4444';
        }
      }, 500);
    });
  }

  function updateJavaStatusMessage(message, color) {
    const detectedPathEl = document.getElementById('java-detected-path');
    if (detectedPathEl) {
      detectedPathEl.textContent = message;
      detectedPathEl.style.color = color;
    }
  }

  // ✅ SAVE GENERAL SETTINGS
  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const btn = saveBtn;
      btn.disabled = true;
      btn.textContent = 'Sauvegarde en cours...';

      try {
        const settings = {
          ...(currentSettings || {}),
          gameDirectory: document.getElementById('game-dir-input').value,
          discordRPC: document.getElementById('discord-rpc-toggle').checked,
          fullscreen: document.getElementById('fullscreen-toggle').checked,
          ramAllocation: parseInt(document.getElementById('ram-slider').value, 10),
          defaultServer: (document.getElementById('default-server-input')?.value || '').trim(),
          startupOnBoot: !!document.getElementById('startup-toggle')?.checked,
          javaPath: (document.getElementById('java-path-input')?.value || '').trim(),
          version: document.getElementById('settings-version-select')?.value || currentSettings?.version,
          mcWidth: parseInt(document.getElementById('mc-width')?.value || currentSettings?.mcWidth || '1280', 10),
          mcHeight: parseInt(document.getElementById('mc-height')?.value || currentSettings?.mcHeight || '720', 10),
          closeLauncherOnLaunch: !!document.getElementById('close-launcher-toggle')?.checked,
          showLogsWindow: !!document.getElementById('show-logs-toggle')?.checked,
          useProtocolConnect: !!document.getElementById('protocol-connect-toggle')?.checked,
          checkUpdateOnStartup: !!document.getElementById('check-update-startup-toggle')?.checked,
          autoUpdate: !!document.getElementById('auto-update-toggle')?.checked
        };

        if (settings.version) {
          await ipcRenderer.invoke('update-profile-version', settings.version);
        }

        await ipcRenderer.invoke('save-settings', settings);
        
        if (settings.fullscreen) {
          ipcRenderer.send('toggle-fullscreen', true);
        } else {
          ipcRenderer.send('toggle-fullscreen', false);
        }
        
        currentSettings = JSON.parse(JSON.stringify(settings));
        if (settings.javaPath) {
          updateJavaStatusMessage('Chemin Java sauvegardé', '#10b981');
        }
        alert('Parametres sauvegardes !');
        setTimeout(() => {
          ipcRenderer.send('close-settings-window');
        }, 300);
      } catch (error) {
        alert('✗ Erreur lors de la sauvegarde');
        btn.disabled = false;
        btn.textContent = 'Valider et sauvegarder';
      }
    });
  }

  // ✅ CANCEL
  const cancelBtn = document.getElementById('cancel-settings-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      ipcRenderer.send('close-settings-window');
    });
  }

  // ✅ UPDATES - CHECK FOR UPDATES
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
      checkUpdatesBtn.disabled = true;
      const originalText = checkUpdatesBtn.textContent;
      checkUpdatesBtn.textContent = 'Vérification en cours...';
      
      const statusEl = document.getElementById('update-status');
      const installBtn = document.getElementById('install-update-btn');
      const versionEl = document.getElementById('latest-version');
      const currentVersionEl = document.getElementById('current-version');
      
      try {
        const result = await ipcRenderer.invoke('check-updates');
        
        const changelogContainer = document.getElementById('changelog-container');
        const releaseNotesEl = document.getElementById('release-notes');
        
        if (result.error) {
          statusEl.textContent = `Erreur: ${result.error}`;
          statusEl.style.color = '#ef4444';
          installBtn.style.display = 'none';
          if (changelogContainer) changelogContainer.style.display = 'none';
        } else if (result.hasUpdate) {
          statusEl.innerHTML = `<span style="color: #10b981;">Mise à jour disponible!</span><br><small style="color: #cbd5e1;">Vous êtes en v${result.currentVersion}, passer à v${result.latestVersion}</small>`;
          installBtn.style.display = 'block';
          if (versionEl) versionEl.textContent = `v${result.latestVersion}`;
          
          if (changelogContainer && releaseNotesEl) {
            changelogContainer.style.display = 'block';
            releaseNotesEl.textContent = result.releaseNotes || 'Aucune note de version disponible';
          }
        } else {
          statusEl.innerHTML = `<span style="color: #10b981;">À jour!</span><br><small style="color: #cbd5e1;">Vous utilisez la dernière version (v${result.currentVersion})</small>`;
          installBtn.style.display = 'none';
          if (versionEl) versionEl.textContent = `v${result.latestVersion}`;
          if (changelogContainer) changelogContainer.style.display = 'none';
        }
        
        if (currentVersionEl) currentVersionEl.textContent = `v${result.currentVersion}`;
      } catch (error) {
        console.error('Erreur check-updates:', error);
        statusEl.textContent = `Erreur: ${error.message}`;
        statusEl.style.color = '#ef4444';
        installBtn.style.display = 'none';
        const changelogContainer = document.getElementById('changelog-container');
        if (changelogContainer) changelogContainer.style.display = 'none';
      } finally {
        checkUpdatesBtn.disabled = false;
        checkUpdatesBtn.textContent = originalText;
      }
    });
  }

  // ✅ UPDATES - INSTALL UPDATE
  const installUpdateBtn = document.getElementById('install-update-btn');
  if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', async () => {
      const confirmed = await ui.showConfirm({
        title: 'Installer la mise a jour ?',
        message: 'L application va telecharger la nouvelle version puis redemarrer automatiquement.',
        confirmLabel: 'Installer',
        cancelLabel: 'Annuler',
        type: 'info'
      });
      if (confirmed) {
        installUpdateBtn.disabled = true;
        const originalText = installUpdateBtn.textContent;
        installUpdateBtn.textContent = 'Téléchargement et installation...';
        document.getElementById('update-status').textContent = 'Installation en cours...';
        document.getElementById('update-status').style.color = '#64748b';
        
        try {
          const result = await ipcRenderer.invoke('install-update');
          if (result.success) {
            document.getElementById('update-status').innerHTML = `<span style="color: #10b981;">Installation en cours</span><br><small>L'application va redémarrer...</small>`;
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error('Erreur install-update:', error);
          document.getElementById('update-status').textContent = `Erreur: ${error.message}`;
          document.getElementById('update-status').style.color = '#ef4444';
          installUpdateBtn.disabled = false;
          installUpdateBtn.textContent = originalText;
        }
      }
    });
  }

  // ✅ MANUAL UPDATE CHECK BUTTON (in settings)
  const manualCheckUpdateBtn = document.getElementById('manual-check-update-btn');
  if (manualCheckUpdateBtn) {
    manualCheckUpdateBtn.addEventListener('click', async () => {
      manualCheckUpdateBtn.disabled = true;
      const originalText = manualCheckUpdateBtn.textContent;
      manualCheckUpdateBtn.textContent = 'Vérification en cours...';
      
      try {
        const result = await ipcRenderer.invoke('check-updates');
        
        if (result.error) {
          alert(`❌ Erreur: ${result.error}`);
        } else if (result.hasUpdate) {
          const confirm = await ui.showConfirm({
            title: 'Mise à jour disponible',
            message: `Velkora v${result.latestVersion} est disponible.\nVersion actuelle: v${result.currentVersion}\n\nVoulez-vous installer la mise à jour ?`,
            confirmLabel: 'Installer',
            cancelLabel: 'Plus tard',
            type: 'info'
          });
          if (confirm) {
            try {
              const installResult = await ipcRenderer.invoke('install-update');
              if (installResult.success) {
                console.log('✅ Installation lancée');
              }
            } catch (err) {
              alert(`❌ Erreur installation: ${err.message}`);
            }
          }
        } else {
          await ui.showDialog({
            title: '✅ Le launcher est à jour',
            message: `Vous utilisez déjà la dernière version disponible.\n\nVersion actuelle: v${result.currentVersion}\n\nAucune mise à jour n'est nécessaire.`,
            type: 'success'
          });
        }
      } catch (error) {
        console.error('Erreur check-updates:', error);
        alert(`❌ Erreur: ${error.message}`);
      } finally {
        manualCheckUpdateBtn.disabled = false;
        manualCheckUpdateBtn.textContent = originalText;
      }
    });
  }

  // ✅ AUTO UPDATE BUTTON (in settings)
  const autoInstallUpdateBtn = document.getElementById('auto-install-update-btn');
  if (autoInstallUpdateBtn) {
    autoInstallUpdateBtn.addEventListener('click', async () => {
      autoInstallUpdateBtn.disabled = true;
      const originalText = autoInstallUpdateBtn.textContent;
      autoInstallUpdateBtn.textContent = 'Vérification...';
      
      try {
        const result = await ipcRenderer.invoke('check-updates');
        
        if (result.error) {
          alert(`❌ Erreur: ${result.error}`);
        } else if (result.hasUpdate) {
          autoInstallUpdateBtn.textContent = 'Téléchargement...';
          try {
            const installResult = await ipcRenderer.invoke('install-update');
            if (installResult.success) {
              autoInstallUpdateBtn.textContent = 'Installation...';
              console.log('✅ Installation lancée');
            } else {
              alert(`❌ Erreur: ${installResult.error}`);
            }
          } catch (err) {
            alert(`❌ Erreur installation: ${err.message}`);
            autoInstallUpdateBtn.disabled = false;
            autoInstallUpdateBtn.textContent = originalText;
          }
        } else {
          await ui.showDialog({
            title: '✅ Le launcher est à jour',
            message: `Vous utilisez déjà la dernière version disponible.\n\nVersion actuelle: v${result.currentVersion}\n\nAucune mise à jour n'est nécessaire.`,
            type: 'success'
          });
          autoInstallUpdateBtn.disabled = false;
          autoInstallUpdateBtn.textContent = originalText;
        }
      } catch (error) {
        console.error('Erreur check-updates:', error);
        alert(`❌ Erreur: ${error.message}`);
        autoInstallUpdateBtn.disabled = false;
        autoInstallUpdateBtn.textContent = originalText;
      }
    });
  }

  // ✅ SAVE GAME TAB
  const saveGameBtn = document.getElementById('save-game-settings-btn');
  if (saveGameBtn) {
    saveGameBtn.addEventListener('click', async () => {
      saveGameBtn.disabled = true;
      saveGameBtn.textContent = 'Sauvegarde...';
      try {
        const defaultServer = (document.getElementById('default-server-input')?.value || '').trim();
        const version = document.getElementById('settings-version-select')?.value || null;
        const javaPath = (document.getElementById('java-path-input')?.value || '').trim();
        const width = parseInt(document.getElementById('mc-width')?.value || '1280', 10);
        const height = parseInt(document.getElementById('mc-height')?.value || '720', 10);
        const closeOnLaunch = !!document.getElementById('close-launcher-toggle')?.checked;
        const showLogs = !!document.getElementById('show-logs-toggle')?.checked;
        const useProtocol = !!document.getElementById('protocol-connect-toggle')?.checked;
        
        if (version) {
          await ipcRenderer.invoke('update-profile-version', version);
        }
        const settings = {
          ...(currentSettings || {}),
          defaultServer,
          javaPath,
          version,
          mcWidth: width,
          mcHeight: height,
          closeLauncherOnLaunch: closeOnLaunch,
          showLogsWindow: showLogs,
          useProtocolConnect: useProtocol
        };
        await ipcRenderer.invoke('save-settings', settings);
        currentSettings = JSON.parse(JSON.stringify(settings));
        if (javaPath) {
          updateJavaStatusMessage('Chemin Java sauvegardé', '#10b981');
        }
        alert('Paramètres du jeu sauvegardés');
      } catch (e) {
        alert('✗ Erreur lors de la sauvegarde');
      } finally {
        saveGameBtn.disabled = false;
        saveGameBtn.textContent = 'Valider et sauvegarder';
      }
    });
  }

  // ✅ UPDATE REQUIRED JAVA VERSION WHEN MC VERSION CHANGES
  const versionSelect = document.getElementById('settings-version-select');
  const requiredJavaEl = document.getElementById('java-required-version');
  
  const updateRequiredJava = async () => {
    const mcVersion = versionSelect?.value || '1.21.11';
    try {
      const result = await ipcRenderer.invoke('get-required-java-version', mcVersion);
      if (requiredJavaEl) {
        requiredJavaEl.textContent = `Java ${result.requiredVersion}+`;
        requiredJavaEl.style.color = result.requiredVersion >= 25 ? '#f59e0b' : '#10b981';
      }
    } catch (error) {
      console.error('Erreur get-required-java-version:', error);
    }
  };
  
  if (versionSelect) {
    versionSelect.addEventListener('change', updateRequiredJava);
    updateRequiredJava();
  }

  // ✅ DETECT JAVA BUTTON
  const detectJavaBtn = document.getElementById('detect-java-btn');
  if (detectJavaBtn) {
    detectJavaBtn.addEventListener('click', async () => {
      const mcVersion = versionSelect?.value || '1.21.11';
      const detectBtn = detectJavaBtn;
      detectBtn.disabled = true;
      const originalText = detectBtn.textContent;
      detectBtn.textContent = '� Recherche...';
      
      try {
        const requiredResult = await ipcRenderer.invoke('get-required-java-version', mcVersion);
        const javaVersion = requiredResult.requiredVersion;
        
        const detectResult = await ipcRenderer.invoke('get-detected-java-path', javaVersion);
        
        const detectedPathEl = document.getElementById('java-detected-path');
        const javaPathInput = document.getElementById('java-path-input');
        
        if (detectResult.found && detectResult.path) {
          javaPathInput.value = detectResult.path;
          detectedPathEl.textContent = `Java ${javaVersion} trouvé: ${detectResult.path}`;
          detectedPathEl.style.color = '#10b981';
        } else {
          detectedPathEl.textContent = `✗ Java ${javaVersion} non trouvé dans C:\\Program Files\\Java\\`;
          detectedPathEl.style.color = '#ef4444';
        }
      } catch (error) {
        console.error('Erreur detect-java:', error);
        document.getElementById('java-detected-path').textContent = `Erreur: ${error.message}`;
        document.getElementById('java-detected-path').style.color = '#ef4444';
      } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = originalText;
      }
    });
  }

  // ✅ LISTEN FOR UPDATE PROGRESS
  ipcRenderer.on('update-progress', (event, progress) => {
    const progressBar = document.getElementById('update-progress-bar');
    if (progressBar) {
      progressBar.style.width = progress + '%';
      progressBar.textContent = progress + '%';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOMContentLoaded started');
  try {
    ui.installStyles();
    console.log('✅ installStyles done');
    installAlertBridge();
    console.log('✅ installAlertBridge done');
    renderSettings();
    console.log('✅ renderSettings done');
  } catch (error) {
    console.error('Erreur lors du rendu:', error);
  }
  await loadSettings();
  await loadAccountInfo();
  await loadStorageInfo();
  await loadNotificationSettings();
  await loadDiscordSettings();
  
  // ✅ INITIALISER LE GESTIONNAIRE DISCORD
  initDiscordTest();
  
  const currentVersionEl = document.getElementById('current-version');
  if (currentVersionEl) {
    currentVersionEl.textContent = LauncherVersion.getFullVersion();
  }
  
  // 🔔 Signaler au main process que la fenêtre est prête
  ipcRenderer.send('settings-window-ready');
  
  setTimeout(() => {
    document.getElementById('check-updates-btn')?.click();
  }, 500);
});

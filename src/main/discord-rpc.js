const DiscordRPC = require('discord-rpc');
const EventEmitter = require('events');
const LauncherVersion = require('./launcher-version.js');

class DiscordPresence extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.clientId = options.clientId || '1511773943839588455';
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectDelay = options.reconnectDelay || 2000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    
    // État
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.enabled = true;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.activityUpdateTimeout = null;
    this.isDisconnecting = false;
    
    // Activité actuelle
    this.currentActivity = null;
    this.activityQueue = [];
    
    // Timestamps
    this.startTimestamp = Date.now();
    
    // Paramètres RPC de l'utilisateur
    this.rpcSettings = {
      showStatus: true,
      showDetails: true,
      showImage: true
    };
    this._socketGuardAttached = false;
  }

  _attachSocketErrorGuard() {
    try {
      const sock = this.client?.transport?.socket;
      if (sock && !sock.__discordSockGuard) {
        sock.__discordSockGuard = true;
        sock.on('error', (e) => {
          if (e && (e.code === 'ERR_STREAM_WRITE_AFTER_END' || /write after end/i.test(e.message || ''))) {
            console.warn('⚠️ Discord RPC socket error ignored:', e.message || e);
            return;
          }
          console.warn('⚠️ Discord RPC socket error:', e?.message || e);
        });
      }
    } catch (_) {}
  }

  /**
   * Initialiser la connexion Discord RPC avec retries
   */
  async initializeWithRetry(maxRetries = 3, delayBetweenRetries = 1000) {    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {      
      const success = await this.initialize();
      
      if (success) {
        return true;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
      }
    }
    
    return false;
  }

  /**
   * Nettoyer le client existant
   */
  cleanupClient() {
    if (this.client) {
      try {
        // Supprimer tous les listeners
        this.client.removeAllListeners();
        this.client.destroy();
        
        // Essayer de détruire proprement
        if (this.client.transport && this.client.transport.socket) {
          this.client.transport.socket.removeAllListeners();
        }
      } catch (error) {
        console.error('⚠️ Error during client cleanup:', error.message);
      }
      
      this.client = null;
    }
  }

  /**
   * Initialiser la connexion Discord RPC
   */
  async initialize() {
    if (!this.enabled) {
      return false;
    }

    if (this.isConnecting) {
      return false;
    }

    if (this.isConnected) {
      return true;
    }

    // Nettoyer tout client existant
    this.cleanupClient();

    let readyTimeout = null;
    let loginTimeout = null;

    try {
      this.isConnecting = true;
      // Créer un nouveau client
      this.client = new DiscordRPC.Client({
        transport: process.platform === 'win32' ? 'ipc' : 'ipc'
      });

      // Promise pour attendre le ready event
      const readyPromise = new Promise((resolve, reject) => {
        // Timeout de 15 secondes pour le ready event
        readyTimeout = setTimeout(() => {
          console.error('⏱️ Ready event timeout (15s)');
          reject(new Error('Ready timeout'));
        }, 15000);

        // Handler temporaire pour le ready
        const onReady = () => {
          clearTimeout(readyTimeout);
          resolve();
        };

        this.client.once('ready', onReady);
      });

      // Configurer les event handlers AVANT la connexion
      this.setupEventHandlers();

      // Attacher le garde d'erreur socket maintenant et après connexion
      this._attachSocketErrorGuard();
      this.once('connected', () => this._attachSocketErrorGuard());

      // Tenter la connexion avec timeout
      
      const loginPromise = this.client.login({ clientId: this.clientId });
      
      await Promise.race([
        loginPromise,
        new Promise((_, reject) => {
          loginTimeout = setTimeout(() => {
            reject(new Error('Login timeout (10s)'));
          }, 10000);
        })
      ]);

      clearTimeout(loginTimeout);

      // Attendre le ready event
      await readyPromise;

      // Marquer comme connecté
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Émettre l'événement de connexion
      this.emit('connected', this.client.user);

      // Appliquer l'activité en attente si présente
      if (this.currentActivity) {
        const queuedActivity = this.currentActivity;

        this.activityUpdateTimeout = setTimeout(async () => {
          if (!this.isConnected || !this.client) return;

          try {
            if (!queuedActivity || typeof queuedActivity !== 'object') return;

            await this.client.setActivity(queuedActivity);
            this.emit('activityUpdated', queuedActivity);
          } catch (e) {
            console.error('❌ Error updating activity:', e.message);
            this.emit('activityUpdateError', e);
          }
        }, 300);
      }

      return true;

    } catch (error) {
      // Nettoyer les timeouts
      if (readyTimeout) clearTimeout(readyTimeout);
      if (loginTimeout) clearTimeout(loginTimeout);

      this.isConnecting = false;
      this.isConnected = false;

      // Messages d'erreur plus clairs
      if (error.message.includes('timeout')) {
        console.error('❌ Connection timeout - Discord might not be running');
      } else if (error.message.includes('ENOENT') || error.message.includes('Could not connect')) {
        console.error('❌ Discord not detected - Please make sure Discord is running');
      } else {
        console.error('❌ Error during Discord RPC connection:', error.message);
      }

      // Nettoyer le client défaillant
      this.cleanupClient();

      this.emit('connectionError', error);

      // Ne pas tenter de reconnexion automatique ici
      // pour éviter les boucles infinies
      return false;
    }
  }

  /**
   * Configurer les gestionnaires d'événements
   */
  setupEventHandlers() {
    if (!this.client) return;

    // Déconnexion
    this.client.on('disconnected', () => {      
      const wasConnected = this.isConnected;
      
      this.isConnected = false;
      this.isConnecting = false;
      
      this.emit('disconnected');
      
      // Tenter une reconnexion automatique seulement si on était connecté avant
      if (this.autoReconnect && this.enabled && wasConnected) {
        this.scheduleReconnect();
      }
    });

    // Erreurs
    this.client.on('error', (error) => {
      console.error('❌ Discord RPC ERROR:', error?.message || error);
      this.emit('error', error);
      
      // Ne pas marquer comme déconnecté immédiatement sur une erreur
      // Laisser l'événement 'disconnected' gérer ça
    });
  }

  /**
   * Planifier une reconnexion
   */
  scheduleReconnect() {
    // Annuler toute reconnexion en cours
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached (${this.maxReconnectAttempts})`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      await this.initialize();
    }, delay);
  }

  /**
   * Appliquer une activité
   */
  async applyActivity(activity) {
    if (!this.isConnected || !this.client) {
      this.currentActivity = activity;
      return false;
    }

    try {
      if (this.activityUpdateTimeout) {
        clearTimeout(this.activityUpdateTimeout);
        this.activityUpdateTimeout = null;
      }

      const queuedActivity = activity;

      this.activityUpdateTimeout = setTimeout(async () => {
        this.activityUpdateTimeout = null;

        if (!this.isConnected || !this.client) return;

        try {
          if (!queuedActivity || typeof queuedActivity !== 'object') return;

          await this.client.setActivity(queuedActivity);
          this.emit('activityUpdated', queuedActivity);
        } catch (error) {
          console.error('❌ Error updating activity:', error.message);
          this.emit('activityUpdateError', error);
        }
      }, 300);

      return true;
    } catch (error) {
      console.error('❌ Error applying activity:', error.message);
      return false;
    }
  }

  /**
   * Mettre à jour l'activité
   */
  async updateActivity(activity) {
    this.currentActivity = activity;
    return await this.applyActivity(activity);
  }

  /**
   * Update RPC settings
   */
  updateRPCSettings(settings) {
    this.rpcSettings = {
      showStatus: settings.showStatus !== false,
      showDetails: settings.showDetails !== false,
      showImage: settings.showImage !== false
    };
        
    // Reapply the activity with the new settings
    if (this.currentActivity && this.isConnected) {
      this.applyActivity(this.currentActivity);
    }
  }

  /**
   * État: Dans le launcher
   */
  async setLauncher(username = 'Joueur', options = {}) {
    const activity = {
      details: this.rpcSettings.showDetails ? '📦 Dans le launcher' : undefined,
      state: this.rpcSettings.showStatus ? `👤 ${username}` : undefined,
      startTimestamp: this.startTimestamp,
      largeImageKey: this.rpcSettings.showImage ? 'minecraft' : undefined,
      largeImageText: this.rpcSettings.showImage ? `${LauncherVersion.getName()}` : undefined,
      instance: false,
    };

    return await this.updateActivity(activity);
  }

  /**
   * État: En train de jouer
   */
  async setPlaying(version, options = {}) {
    // S'assurer que options est un objet
    if (!options || typeof options !== 'object') {
      options = {};
    }

    const { server, players, modpack } = options;
    const isDiscordRunning = require('ps-list');
    
    let state = this.rpcSettings.showStatus ? `🎮 Version ${version}` : undefined;
    
    if (modpack && this.rpcSettings.showStatus) {
      state = `📦 ${modpack}`;
    }
    
    const activity = {
      details: this.rpcSettings.showDetails ? '⚔️ En train de jouer à Minecraft' : undefined,
      state: state,
      startTimestamp: Date.now(),
      largeImageKey: this.rpcSettings.showImage ? 'minecraft' : undefined,
      largeImageText: this.rpcSettings.showImage ? `${LauncherVersion.getName()}` : undefined,
      smallImageKey: this.rpcSettings.showImage ? 'play' : undefined,
      smallImageText: this.rpcSettings.showImage ? 'En jeu' : undefined,
      instance: false,
    };

    // Ajouter les informations du serveur si disponibles
    if (server && this.rpcSettings.showStatus) {
      activity.partyId = `server_${server}`;
      activity.partySize = players?.current || 1;
      activity.partyMax = players?.max || 100;
      
      activity.state += ` | 🌐 ${server}`;
    }

    // Boutons (optionnel - nécessite configuration sur Discord Developer Portal)
    if (options.buttons) {
      activity.buttons = options.buttons;
    }

    return await this.updateActivity(activity);
  }

  /**
   * État: Téléchargement
   */
  async setDownloading(version, progress = null) {
    let state = this.rpcSettings.showStatus ? '⏳ Installation en cours...' : undefined;
    
    if (progress !== null && this.rpcSettings.showStatus) {
      state = `⏳ ${Math.round(progress)}% téléchargé`;
    }

    const activity = {
      details: this.rpcSettings.showDetails ? `📥 Téléchargement v${version}` : undefined,
      state: state,
      startTimestamp: Date.now(),
      largeImageKey: this.rpcSettings.showImage ? 'minecraft' : undefined,
      largeImageText: this.rpcSettings.showImage ? `${LauncherVersion.getName()}` : undefined,
      smallImageKey: this.rpcSettings.showImage ? 'download' : undefined,
      smallImageText: this.rpcSettings.showImage ? 'Téléchargement' : undefined,
      instance: false,
    };

    return await this.updateActivity(activity);
  }

  /**
   * État: Menu principal
   */
  async setMainMenu(version) {
    const activity = {
      details: this.rpcSettings.showDetails ? '🏠 Menu principal' : undefined,
      state: this.rpcSettings.showStatus ? `Version ${version}` : undefined,
      startTimestamp: Date.now(),
      largeImageKey: this.rpcSettings.showImage ? 'minecraft' : undefined,
      largeImageText: this.rpcSettings.showImage ? `${LauncherVersion.getName()}` : undefined,
      instance: false,
    };

    return await this.updateActivity(activity);
  }

  /**
   * État: Dans un serveur
   */
  async setInServer(serverName, playerCount = null) {
    let state = this.rpcSettings.showStatus ? `🌐 ${serverName}` : undefined;
    
    if (playerCount && this.rpcSettings.showStatus) {
      state += ` | 👥 ${playerCount.current}/${playerCount.max}`;
    }

    const activity = {
      details: this.rpcSettings.showDetails ? '⚔️ Sur un serveur' : undefined,
      state: state,
      startTimestamp: Date.now(),
      largeImageKey: this.rpcSettings.showImage ? 'minecraft' : undefined,
      largeImageText: this.rpcSettings.showImage ? `${LauncherVersion.getName()}` : undefined,
      smallImageKey: this.rpcSettings.showImage ? 'server' : undefined,
      smallImageText: this.rpcSettings.showImage ? serverName : undefined,
      instance: false,
    };

    if (playerCount) {
      activity.partySize = playerCount.current;
      activity.partyMax = playerCount.max;
    }

    return await this.updateActivity(activity);
  }

  /**
   * État: AFK / Inactif
   */
  async setIdle(message = 'Inactif') {
    const activity = {
      details: '💤 Inactif',
      state: message,
      startTimestamp: this.startTimestamp,
      largeImageKey: 'minecraft',
      largeImageText: `${LauncherVersion.getName()}`,
      instance: false,
    };

    return await this.updateActivity(activity);
  }

  /**
   * Clear the activity
   */
  async clear() {
    if (!this.client) {
      return false;
    }

    try {
      // Éviter d'écrire si le transport est déjà fermé
      const sock = this.client?.transport?.socket;
      if (!sock || sock.destroyed || sock.writableEnded || sock.writableFinished) {
        console.warn('⚠️ Skip clearActivity: transport already closed');
        return false;
      }
      await this.client.clearActivity();
      this.currentActivity = null;
      this.emit('activityCleared');
      return true;
    } catch (error) {
      if (error && (error.code === 'ERR_STREAM_WRITE_AFTER_END' || /write after end/i.test(error.message || ''))) {
        console.warn('⚠️ Ignored clearActivity error:', error.message || error);
        return false;
      }
      console.error('❌ Error clearing activity:', error.message);
      return false;
    }
  }

  /**
   * Disconnect cleanly
   */
  async disconnect() {
    if (this.isDisconnecting) {
      return true;
    }

    // Désactiver la reconnexion automatique temporairement
    const autoReconnectBackup = this.autoReconnect;
    this.autoReconnect = false;

    // Annuler les reconnexions
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.activityUpdateTimeout) {
      clearTimeout(this.activityUpdateTimeout);
      this.activityUpdateTimeout = null;
    }

    // Clear l'activité
    if (this.isConnected) {
      try {
        await this.clear();
      } catch (error) {
        console.error('⚠️ Error clearing activity during disconnect:', error.message);
      }
    }

    this.isDisconnecting = true;

    // Détruire le client
    if (this.client) {
      try {
        // S'assurer que l'erreur 'write after end' est attrapée pendant destroy
        this._attachSocketErrorGuard();
        try { this.client.removeAllListeners(); } catch (_) {}
        await this.client.destroy();
      } catch (error) {
        console.error('⚠️ Error during client destruction:', error.message);
      }
    }

    // Nettoyer
    this.cleanupClient();
    
    this.isConnected = false;
    this.isConnecting = false;
    this.isDisconnecting = false;
    this.currentActivity = null;
    this.reconnectAttempts = 0;

    // Restaurer l'autoReconnect
    this.autoReconnect = autoReconnectBackup;

    this.emit('destroyed');
    
    return true;
  }

  /**
   * Détruire complètement
   */
  async destroy() {
    this.enabled = false;
    await this.disconnect();
    this.removeAllListeners();
  }

  /**
   * Activer/Désactiver
   */
  async setEnabled(enabled) {
    this.enabled = enabled;
    
    if (!enabled && this.isConnected) {
      await this.disconnect();
    } else if (enabled && !this.isConnected) {
      await this.initialize();
    }
  }

  /**
   * Réinitialiser le timestamp de démarrage
   */
  resetStartTime() {
    this.startTimestamp = Date.now();
  }

  /**
   * Obtenir le statut
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      enabled: this.enabled,
      reconnectAttempts: this.reconnectAttempts,
      currentActivity: this.currentActivity,
      user: this.client?.user || null,
    };
  }

  /**
   * Tester la connexion
   */
  async test() {
    if (!this.isConnected) {
      return { 
        success: false, 
        message: '❌ Discord non connecté',
        status: this.getStatus()
      };
    }

    try {
      return { 
        success: true, 
        message: '✅ Discord RPC fonctionne parfaitement !',
        user: this.client.user,
        status: this.getStatus()
      };
    } catch (error) {
      return { 
        success: false, 
        message: `❌ Erreur: ${error.message}`,
        status: this.getStatus()
      };
    }
  }

  // Alias pour compatibilité
  async connect() {
    return await this.initialize();
  }

  async setInLauncher(username) {
    return await this.setLauncher(username);
  }
}

module.exports = DiscordPresence;

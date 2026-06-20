// discord-handlers.js
const { ipcMain } = require('electron');
const LauncherVersion = require('./launcher-version.js');

let currentSettingsWindow = null;
let currentDiscordRPC = null;

/**
 * Mettre à jour la référence à la fenêtre settings
 */
function setSettingsWindow(window) {
  currentSettingsWindow = window;
}

// ✅ Garder le dernier statut envoyé pour éviter les broadcasts inutiles
let lastBroadcastedStatus = null;

/**
 * Envoyer le statut Discord à la fenêtre settings
 */
function broadcastDiscordStatus(discordRPC, force = false) {
  const rpc = discordRPC || currentDiscordRPC;
  
  if (!rpc) {
    return;
  }

  if (!currentSettingsWindow || currentSettingsWindow.isDestroyed()) {
    // Reset le cache si la fenêtre est fermée
    lastBroadcastedStatus = null;
    return;
  }

  try {
    const status = rpc.getStatus();
    
    // ✅ Vérifier si le statut a changé (sauf si force = true)
    const statusKey = `${status.connected}-${status.connecting}-${status.enabled}-${status.user?.username || 'none'}`;
    
    if (!force && lastBroadcastedStatus === statusKey) {
      // Statut identique, pas de broadcast
      return;
    }

    currentSettingsWindow.webContents.send('discord-status-changed', {
      connected: status.connected,
      connecting: status.connecting,
      enabled: status.enabled,
      user: status.user
    });
    
    // Mettre à jour le cache
    lastBroadcastedStatus = statusKey;
  } catch (error) {
    console.error('❌ Error broadcasting Discord status:', error.message);
  }
}

/**
 * Configuration des handlers Discord IPC
 */
function setupDiscordHandlers(discordRPC, store, settingsWindow) {
  // Stocker discordRPC au niveau du module
  currentDiscordRPC = discordRPC;
  
  // Enregistrer la fenêtre settings
  if (settingsWindow) {
    setSettingsWindow(settingsWindow);
  }
  
  // Configurer les listeners Discord pour mettre à jour l'UI
  if (discordRPC) {
    // Éviter les doubles listeners
    discordRPC.removeAllListeners('connected');
    discordRPC.removeAllListeners('disconnected');
    discordRPC.removeAllListeners('error');
    discordRPC.removeAllListeners('connectionError');

    discordRPC.on('connected', (user) => {
      broadcastDiscordStatus(discordRPC, true);
    });

    discordRPC.on('disconnected', () => {
      broadcastDiscordStatus(discordRPC, true);
    });

    discordRPC.on('error', (error) => {
      console.error('⚠️ Discord error event:', error?.message);
      broadcastDiscordStatus(discordRPC);
    });

    discordRPC.on('connectionError', (error) => {
      console.error('⚠️ Discord connection error event:', error?.message);
      broadcastDiscordStatus(discordRPC);
    });
  }
  
  // Handler: Settings window ready
  ipcMain.handle('settings-window-ready', async (event) => {
    return { success: true };
  });
  
  // Handler: Get Discord status
  ipcMain.handle('get-discord-status', async (event) => {
    try {
      const rpc = currentDiscordRPC || discordRPC;
      
      if (!rpc) {
        return {
          connected: false,
          connecting: false,
          enabled: false,
          reconnectAttempts: 0,
          user: null
        };
      }

      const status = rpc.getStatus();
      return status;
    } catch (error) {
      console.error('❌ Error getting Discord status:', error);
      return {
        connected: false,
        connecting: false,
        enabled: false,
        reconnectAttempts: 0,
        user: null,
        error: error.message
      };
    }
  });

  // Handler: Test Discord RPC
  ipcMain.handle('test-discord-rpc', async (event) => {
    try {
      const rpc = currentDiscordRPC || discordRPC;
      
      if (!rpc) {
        return {
          success: false,
          message: 'Discord RPC non initialisé',
          status: null
        };
      }

      const result = await rpc.test();      

      broadcastDiscordStatus(rpc);
      
      return result;
    } catch (error) {
      console.error('❌ Error testing Discord RPC:', error);
      return {
        success: false,
        message: error.message,
        status: discordRPC ? discordRPC.getStatus() : null
      };
    }
  });

  // Handler: Reconnect Discord RPC
  ipcMain.handle('reconnect-discord-rpc', async (event) => {
    try {
      const rpc = currentDiscordRPC || discordRPC;
      
      if (!rpc) {
        return { 
          success: false, 
          message: 'Discord RPC non initialisé' 
        };
      }

      // Broadcast "connecting"
      if (currentSettingsWindow && !currentSettingsWindow.isDestroyed()) {
        currentSettingsWindow.webContents.send('discord-status-changed', {
          connected: false,
          connecting: true,
          enabled: true,
          user: null
        });
      }

      // Déconnecter proprement
      await rpc.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnecter avec retries
      const success = await rpc.initializeWithRetry(3, 1000);
      
      // Attendre un peu pour que le statut se stabilise
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = rpc.getStatus();
      
      // Force le broadcast car c'est un vrai changement
      broadcastDiscordStatus(rpc, true);
      
      return {
        success: status.connected,
        message: status.connected ? 'Reconnecté avec succès !' : 'Échec de la reconnexion',
        status: status
      };
    } catch (error) {
      console.error('❌ Error reconnecting Discord RPC:', error);
      
      // Broadcast l'erreur
      broadcastDiscordStatus();
      
      return {
        success: false,
        message: `Erreur: ${error.message}`
      };
    }
  });

  // Handler: Get Discord settings
  ipcMain.handle('get-discord-settings', async (event) => {
    try {
      const rpc = currentDiscordRPC || discordRPC;
      const status = rpc ? rpc.getStatus() : {
        connected: false,
        connecting: false,
        enabled: false
      };

      const settings = {
        rpcEnabled: store.get('discord.rpcEnabled', true),
        showStatus: store.get('discord.showStatus', true),
        showDetails: store.get('discord.showDetails', true),
        showImage: store.get('discord.showImage', true),
        isConnected: status.connected,
        isConnecting: status.connecting
      };

      return settings;
    } catch (error) {
      console.error('❌ Error getting Discord settings:', error);
      return {
        rpcEnabled: true,
        showStatus: true,
        showDetails: true,
        showImage: true,
        isConnected: false,
        isConnecting: false
      };
    }
  });

  // Handler: Save Discord settings
  ipcMain.handle('save-discord-settings', async (event, settings) => {
    try {
      // Sauvegarder dans le store
      store.set('discord.rpcEnabled', settings.rpcEnabled);
      store.set('discord.showStatus', settings.showStatus);
      store.set('discord.showDetails', settings.showDetails);
      store.set('discord.showImage', settings.showImage);

      const rpc = currentDiscordRPC || discordRPC;
      
      if (!rpc) {
        return { success: true };
      }

      // Mettre à jour les paramètres RPC en direct
      rpc.updateRPCSettings({
        showStatus: settings.showStatus,
        showDetails: settings.showDetails,
        showImage: settings.showImage
      });

      // Gérer l'activation/désactivation
      if (!settings.rpcEnabled && rpc.isConnected) {
        await rpc.disconnect();
      } else if (settings.rpcEnabled && !rpc.isConnected && !rpc.isConnecting) {
        await rpc.initializeWithRetry(2, 500);
      }

      // Force le broadcast car c'est un vrai changement
      setTimeout(() => {
        broadcastDiscordStatus(rpc, true);
      }, 500);

      return { success: true };
    } catch (error) {
      console.error('❌ Error saving Discord settings:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Handler: Reset Discord settings
  ipcMain.handle('reset-discord-settings', async (event) => {
    try {
      // Réinitialiser les paramètres
      store.set('discord.rpcEnabled', true);
      store.set('discord.showStatus', true);
      store.set('discord.showDetails', true);
      store.set('discord.showImage', true);

      const rpc = currentDiscordRPC || discordRPC;

      if (rpc) {
        // Mettre à jour les paramètres RPC
        rpc.updateRPCSettings({
          showStatus: true,
          showDetails: true,
          showImage: true
        });
        
        // Reconnecter si pas déjà connecté
        if (!rpc.isConnected) {
          await rpc.initializeWithRetry(2, 500);
        }

        // Force le broadcast car c'est un vrai changement
        setTimeout(() => {
          broadcastDiscordStatus(rpc, true);
        }, 500);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting Discord settings:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });
}

/**
 * Mettre à jour la référence Discord RPC après initialisation
 */
function updateDiscordReference(discordRPC) {
  currentDiscordRPC = discordRPC;  
  // ✅ Reset le cache pour forcer un broadcast lors du prochain événement
  lastBroadcastedStatus = null;
  
  // Reconfigurer les event listeners
  if (discordRPC) {
    // Éviter les doubles listeners
    discordRPC.removeAllListeners('connected');
    discordRPC.removeAllListeners('disconnected');
    discordRPC.removeAllListeners('error');
    discordRPC.removeAllListeners('connectionError');

    discordRPC.on('connected', (user) => {
      broadcastDiscordStatus(discordRPC, true);
    });

    discordRPC.on('disconnected', () => {
      broadcastDiscordStatus(discordRPC, true);
    });

    discordRPC.on('error', (error) => {
      console.error('⚠️ Discord error event:', error?.message);
      broadcastDiscordStatus(discordRPC);
    });

    discordRPC.on('connectionError', (error) => {
      console.error('⚠️ Discord connection error event:', error?.message);
      broadcastDiscordStatus(discordRPC);
    });
  }
}

// Exporter les fonctions
module.exports = setupDiscordHandlers;
module.exports.setSettingsWindow = setSettingsWindow;
module.exports.broadcastDiscordStatus = broadcastDiscordStatus;
module.exports.updateDiscordReference = updateDiscordReference;
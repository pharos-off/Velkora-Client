/**
 * IPC Handlers pour les nouvelles fonctionnalités
 * - JVM Optimizer
 * - Resource Pack Manager
 * - Game Monitor
 * - Backup Manager
 */

const { ipcMain } = require('electron');

module.exports = function registerNewFeatureHandlers(electronApp, store) {
  const BackupManager = require('./backup-manager');
  const path = require('path');
  const os = require('os');

  // ==================== JVM OPTIMIZER ====================

  // Analyser le système et obtenir les recommandations
  ipcMain.handle('jvm-optimize', async () => {
    try {
      const optimizer = new JVMOptimizer();
      await optimizer.analyze();

      const args = optimizer.generateOptimizedArgs();
      const report = optimizer.getOptimizationReport();

      console.log('✅ JVM optimization generated');
      console.log('   Recommended RAM:', report.recommendedRam);
      console.log('   CPU Cores:', report.cpuCores);
      console.log('   Args count:', args.length);

      return {
        success: true,
        args: args,
        report: report
      };
    } catch (err) {
      console.warn('[JVM] Optimization error:', err);
      return {
        success: false,
        error: err.message,
        args: new JVMOptimizer().getDefaultArgs()
      };
    }
  });

  // Obtenir les infos d'optimisation du système
  ipcMain.handle('jvm-get-report', async () => {
    try {
      const optimizer = new JVMOptimizer();
      await optimizer.analyze();
      const report = optimizer.getOptimizationReport();

      return {
        success: true,
        report: report
      };
    } catch (err) {
      console.warn('[JVM] Report generation error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  });

  // ==================== RESOURCE PACK MANAGER ====================

  // Lister les packs de textures
  ipcMain.handle('list-resource-packs', async () => {
    try {
      const gameDir = store.get('settings', {}).gameDirectory || 
        path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
      const manager = new ResourcePackManager(gameDir);
      const stats = manager.getStats();

      console.log(`✅ Listed ${stats.totalPacks} resource packs`);

      return {
        success: true,
        stats: stats
      };
    } catch (err) {
      console.warn('[ResourcePacks] List error:', err);
      return {
        success: false,
        error: err.message,
        stats: { totalPacks: 0, activePacks: 0, totalSize: '0 B', packs: [] }
      };
    }
  });

  // Installer un resource pack
  ipcMain.handle('install-resource-pack', async (event, zipFilePath) => {
    try {
      const gameDir = store.get('settings', {}).gameDirectory || 
        path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
      const manager = new ResourcePackManager(gameDir);
      const result = manager.installPack(zipFilePath);

      if (result.success) {
        console.log(`✅ Resource pack installed: ${result.pack.name}`);
      } else {
        console.warn(`⚠️ Installation failed: ${result.error}`);
      }

      return result;
    } catch (err) {
      console.warn('[ResourcePacks] Install error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  });

  // Supprimer un resource pack
  ipcMain.handle('delete-resource-pack', async (event, packName) => {
    try {
      const gameDir = store.get('settings', {}).gameDirectory || 
        path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
      const manager = new ResourcePackManager(gameDir);
      const result = manager.deletePack(packName);

      console.log(`✅ Resource pack deleted: ${packName}`);
      return result;
    } catch (err) {
      console.warn('[ResourcePacks] Delete error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  });

  // ==================== GAME MONITOR ====================

  let gameMonitor = null;

  // Démarrer le monitoring
  ipcMain.handle('monitor-start', async () => {
    try {
      gameMonitor = new GameMonitor();
      gameMonitor.start();

      // Émettre les mises à jour vers la fenêtre principale
      gameMonitor.on('update', (stats) => {
        const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitor-update', stats);
        }
      });

      console.log('✅ Game monitor started');
      return { success: true };
    } catch (err) {
      console.warn('[Monitor] Start error:', err);
      return { success: false, error: err.message };
    }
  });

  // Arrêter le monitoring
  ipcMain.handle('monitor-stop', async () => {
    try {
      if (gameMonitor) {
        const summary = gameMonitor.getSummary();
        gameMonitor.stop();
        gameMonitor = null;

        console.log('✅ Game monitor stopped');
        console.log('📊 Summary:', summary);

        return { success: true, summary: summary };
      }
      return { success: true };
    } catch (err) {
      console.warn('[Monitor] Stop error:', err);
      return { success: false, error: err.message };
    }
  });

  // Obtenir les stats en temps réel
  ipcMain.handle('monitor-get-stats', async () => {
    try {
      if (!gameMonitor) {
        return { success: false, error: 'Monitor not running' };
      }

      const stats = gameMonitor.getStats();
      return { success: true, stats: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==================== BACKUP MANAGER ====================

  let backupManager = null;

  ipcMain.handle('backup-init', async () => {
    try {
      const gameDir = store.get('settings', {}).gameDirectory || 
        path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
      backupManager = new BackupManager(gameDir);

      console.log('✅ Backup manager initialized');
      return { success: true };
    } catch (err) {
      console.warn('[Backup] Init error:', err);
      return { success: false, error: err.message };
    }
  });

  // Créer un backup d'un monde
  ipcMain.handle('backup-create', async (event, worldName) => {
    try {
      if (!backupManager) {
        const gameDir = store.get('settings', {}).gameDirectory || 
          path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
        backupManager = new BackupManager(gameDir);
      }

      const result = await backupManager.backupWorld(worldName);
      console.log(`✅ Backup created for world: ${worldName}`);
      return result;
    } catch (err) {
      console.warn('[Backup] Create error:', err);
      return { success: false, error: err.message };
    }
  });

  // Restaurer un backup
  ipcMain.handle('backup-restore', async (event, backupName, worldName) => {
    try {
      if (!backupManager) {
        const gameDir = store.get('settings', {}).gameDirectory || 
          path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
        backupManager = new BackupManager(gameDir);
      }

      const result = await backupManager.restoreBackup(backupName, worldName);
      console.log(`✅ Backup restored: ${backupName}`);
      return result;
    } catch (err) {
      console.warn('[Backup] Restore error:', err);
      return { success: false, error: err.message };
    }
  });

  // Lister les backups
  ipcMain.handle('backup-list', async (event, worldName = null) => {
    try {
      if (!backupManager) {
        const gameDir = store.get('settings', {}).gameDirectory || 
          path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
        backupManager = new BackupManager(gameDir);
      }

      const backups = backupManager.listBackups(worldName);
      console.log(`✅ Listed ${backups.length} backups`);
      return { success: true, backups: backups };
    } catch (err) {
      console.warn('[Backup] List error:', err);
      return { success: false, error: err.message, backups: [] };
    }
  });

  // Supprimer un backup
  ipcMain.handle('backup-delete', async (event, backupName) => {
    try {
      if (!backupManager) {
        const gameDir = store.get('settings', {}).gameDirectory || 
          path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
        backupManager = new BackupManager(gameDir);
      }

      const result = backupManager.deleteBackup(backupName);
      console.log(`✅ Backup deleted: ${backupName}`);
      return result;
    } catch (err) {
      console.warn('[Backup] Delete error:', err);
      return { success: false, error: err.message };
    }
  });

  // Obtenir les stats de backup
  ipcMain.handle('backup-get-stats', async () => {
    try {
      if (!backupManager) {
        const gameDir = store.get('settings', {}).gameDirectory || 
          path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
        backupManager = new BackupManager(gameDir);
      }

      const stats = backupManager.getStats();
      console.log('✅ Backup stats retrieved');
      return { success: true, stats: stats };
    } catch (err) {
      console.warn('[Backup] Stats error:', err);
      return { success: false, error: err.message };
    }
  });
};

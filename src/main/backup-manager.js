const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { EventEmitter } = require('events');

/**
 * 💾 GESTIONNAIRE DE SAUVEGARDES
 * Gère les backups automatiques des mondes et données Minecraft
 */
class BackupManager extends EventEmitter {
  constructor(gameDirectory) {
    super();
    this.gameDirectory = gameDirectory;
    this.savesDir = path.join(gameDirectory, 'saves');
    this.backupsDir = path.join(gameDirectory, 'backups');
    this.configDir = path.join(gameDirectory, 'launcher_backups_config.json');
    this.ensureDirectories();
    this.loadConfig();
  }

  ensureDirectories() {
    [this.savesDir, this.backupsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Charger la configuration de backup
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configDir)) {
        this.config = JSON.parse(fs.readFileSync(this.configDir, 'utf8'));
      } else {
        this.config = {
          autoBackup: true,
          backupInterval: 3600000, // 1h
          maxBackups: 10,
          lastBackup: null,
          backups: []
        };
        this.saveConfig();
      }
    } catch (err) {
      console.warn('[Backup] Erreur chargement config:', err);
      this.config = {
        autoBackup: true,
        backupInterval: 3600000,
        maxBackups: 10,
        lastBackup: null,
        backups: []
      };
    }
  }

  /**
   * Sauvegarder la configuration
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configDir, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.warn('[Backup] Erreur sauvegarde config:', err);
    }
  }

  /**
   * Créer un backup d'un monde
   */
  async backupWorld(worldName) {
    return new Promise((resolve, reject) => {
      try {
        const worldPath = path.join(this.savesDir, worldName);

        if (!fs.existsSync(worldPath)) {
          return reject(new Error(`Monde "${worldName}" non trouvé`));
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${worldName}_${timestamp}.zip`;
        const backupPath = path.join(this.backupsDir, backupName);

        const zip = new AdmZip();
        const files = this.getFilesRecursive(worldPath);

        files.forEach(file => {
          const relativePath = path.relative(worldPath, file);
          const content = fs.readFileSync(file);
          zip.addFile(relativePath, content);
        });

        zip.writeZip(backupPath);

        // ✅ Mettre à jour la config
        this.config.backups.push({
          world: worldName,
          name: backupName,
          path: backupPath,
          size: fs.statSync(backupPath).size,
          date: new Date().toISOString()
        });

        // ✅ Limite de backups
        if (this.config.backups.length > this.config.maxBackups) {
          const oldBackup = this.config.backups.shift();
          if (fs.existsSync(oldBackup.path)) {
            fs.unlinkSync(oldBackup.path);
          }
        }

        this.config.lastBackup = new Date().toISOString();
        this.saveConfig();

        console.log(`[Backup] Backup créé: ${backupName}`);
        this.emit('backup-created', { world: worldName, size: fs.statSync(backupPath).size });

        resolve({
          success: true,
          backup: backupName,
          size: this.formatFileSize(fs.statSync(backupPath).size)
        });
      } catch (err) {
        console.warn('[Backup] Erreur création backup:', err);
        reject(err);
      }
    });
  }

  /**
   * Restaurer un backup
   */
  async restoreBackup(backupName, worldName) {
    return new Promise((resolve, reject) => {
      try {
        const backupPath = path.join(this.backupsDir, backupName);

        if (!fs.existsSync(backupPath)) {
          return reject(new Error(`Backup "${backupName}" non trouvé`));
        }

        const worldPath = path.join(this.savesDir, worldName);

        // ✅ Créer un backup avant de restaurer
        if (fs.existsSync(worldPath)) {
          const safePath = worldPath + '_backup_' + Date.now();
          fs.renameSync(worldPath, safePath);
        }

        // ✅ Restaurer
        fs.mkdirSync(worldPath, { recursive: true });
        const zip = new AdmZip(backupPath);
        zip.extractAllTo(worldPath, true);

        console.log(`[Backup] Backup restauré: ${backupName}`);
        this.emit('backup-restored', { backup: backupName, world: worldName });

        resolve({
          success: true,
          message: `Backup "${backupName}" restauré vers "${worldName}"`
        });
      } catch (err) {
        console.warn('[Backup] Erreur restauration backup:', err);
        reject(err);
      }
    });
  }

  /**
   * Lister les backups
   */
  listBackups(worldName = null) {
    try {
      let backups = this.config.backups || [];

      if (worldName) {
        backups = backups.filter(b => b.world === worldName);
      }

      return backups.map(b => ({
        name: b.name,
        world: b.world,
        date: new Date(b.date).toLocaleString('fr-FR'),
        size: this.formatFileSize(b.size)
      })).sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (err) {
      console.warn('[Backup] Erreur listing backups:', err);
      return [];
    }
  }

  /**
   * Supprimer un backup
   */
  deleteBackup(backupName) {
    try {
      const backupPath = path.join(this.backupsDir, backupName);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      this.config.backups = this.config.backups.filter(b => b.name !== backupName);
      this.saveConfig();

      console.log(`[Backup] Backup supprimé: ${backupName}`);
      this.emit('backup-deleted', { backup: backupName });

      return { success: true, message: `Backup "${backupName}" supprimé` };
    } catch (err) {
      console.warn('[Backup] Erreur suppression backup:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtenir les fichiers récursivement
   */
  getFilesRecursive(dir) {
    let files = [];

    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files = files.concat(this.getFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    });

    return files;
  }

  /**
   * Formater taille fichier
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  /**
   * Obtenir les stats
   */
  getStats() {
    try {
      const totalSize = this.config.backups.reduce((sum, b) => sum + (b.size || 0), 0);

      return {
        totalBackups: this.config.backups.length,
        totalSize: this.formatFileSize(totalSize),
        lastBackup: this.config.lastBackup ? new Date(this.config.lastBackup).toLocaleString('fr-FR') : 'Aucun',
        autoBackup: this.config.autoBackup
      };
    } catch (err) {
      console.warn('[Backup] Erreur calcul stats:', err);
      return { totalBackups: 0, totalSize: '0 B', lastBackup: 'Erreur' };
    }
  }
}

module.exports = BackupManager;

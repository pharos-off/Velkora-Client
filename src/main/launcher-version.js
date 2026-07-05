// ================================
// launcher-version.js
// Informations centralisées de version du launcher
// ================================

const LauncherVersion = {
  // Informations principales
  name: 'Velkora Client',
  version: '4.4.0', // Format: MAJOR.MINOR.PATCH
  versionName: '4.4.0', // Format: Nom de la version
  build: '20260705', // Format: YYYYMMDD
  releaseDate: '2026-07-05', // Format: YYYY-MM-DD
  channel: 'stable', // stable, beta, dev
  
  // Informations du développeur
  author: 'Pharos_Off',
  website: 'https://github.com/pharos-off/Velkora',
  discordServer: 'https://discord.gg/Velkora',
  
  // Méthodes utilitaires
  getFullVersion() {
    return `${this.name} v${this.version}`;
  },

  getName() {
    return `${this.name}`;
  },
  
  getFullVersionWithBuild() {
    return `${this.name} v${this.version} (Build ${this.build})`;
  },
  
  getVersionString() {
    return `v${this.version}`;
  },
  
  getVersion() {
    return this.version;
  },

  getBuildString() {
    return `Build ${this.build}`;
  },

  getBuild() {
    return this.build;
  },
  
  getChannelBadge() {
    const badges = {
      stable: { text: '✓ Stable', color: '#10b981' },
      beta: { text: '⚠️ Beta', color: '#f59e0b' },
      dev: { text: '🔧 Dev', color: '#ef4444' }
    };
    return badges[this.channel] || badges.stable;
  },
  
  isBeta() {
    return this.channel === 'beta';
  },
  
  isDev() {
    return this.channel === 'dev';
  },
  
  isStable() {
    return this.channel === 'stable';
  },
  
  // Comparer avec une autre version
  isNewerThan(otherVersion) {
    const [major1, minor1, patch1] = this.version.split('.').map(Number);
    const [major2, minor2, patch2] = otherVersion.split('.').map(Number);
    
    if (major1 !== major2) return major1 > major2;
    if (minor1 !== minor2) return minor1 > minor2;
    return patch1 > patch2;
  },
  
  // Obtenir toutes les infos en objet
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      versionName: this.versionName,
      build: this.build,
      releaseDate: this.releaseDate,
      channel: this.channel,
      author: this.author,
      fullVersion: this.getFullVersion()
    };
  }
};

// Export pour Node.js (CommonJS)
module.exports = LauncherVersion;

// Export pour ES6 modules (si vous utilisez import/export)
// export default LauncherVersion;
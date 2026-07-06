class ScreenLoading {
  constructor(app) {
    this.app = app;
    this.loadingScreen = null;
  }

  /**
   * ✅ INITIALISER LE LOADING SCREEN
   */
  init() {
    this.loadingScreen = document.getElementById('loading-screen');
    if (!this.loadingScreen) {
      console.warn('⚠️ Loading screen element not found');
      return;
    }
  }

  /**
   * ✅ VÉRIFIER ET AFFICHER LES NOTIFICATIONS DE MISE À JOUR
   */
  async checkAndDisplayUpdates() {
    // Updates checks are handled by the main process silently; renderer should not invoke check-updates.
    return;
  }

  /**
   * ✅ AFFICHER LA NOTIFICATION DE MISE À JOUR
   */
  displayUpdateNotification(latestVersion) {
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); z-index: 5000; font-weight: 600; cursor: pointer; transition: all 0.3s;';
    notification.innerHTML = `✅ Une mise à jour est disponible (v${latestVersion})`;
    
    notification.onmouseover = () => notification.style.transform = 'translateY(-4px)';
    notification.onmouseout = () => notification.style.transform = 'translateY(0)';
    notification.addEventListener('click', () => {
      ipcRenderer.send('open-settings', { tab: 'updates' });
      notification.remove();
    });
    
    document.body.appendChild(notification);
    
    // Auto-remove après 8 secondes
    setTimeout(() => {
      if (notification.parentElement) notification.remove();
    }, 8000);
  }

  /**
   * ✅ MASQUER LE LOADING SCREEN
   */
  hide() {
    setTimeout(() => {
      if (this.loadingScreen) {
        this.loadingScreen.classList.add('hidden');
        // Retirer du DOM après la transition
        setTimeout(() => {
          this.loadingScreen.style.display = 'none';
        }, 6000); //600
      }
    }, 6000); //800
  }
}

module.exports = ScreenLoading;

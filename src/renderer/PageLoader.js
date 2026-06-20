/**
 * ✅ GESTIONNAIRE DU LOADING SCREEN POUR CHANGEMENT DE PAGES
 * Affiche un écran de chargement uniquement lors du changement de page/vue
 * Charge la page en amont et décharge l'autre page
 */
class PageLoader {
  constructor() {
    this.isLoading = false;
    this.loadingTimeout = null;
    this.minLoadingDuration = 800; // 800ms d'affichage minimum du loading
    this.loadStartTime = 0;
    this.pageTransitionDelay = 500; // 500ms de délai de transition entre les pages
  }

  /**
   * ✅ GET LOADING SCREEN (Lazy load)
   */
  getLoadingScreen() {
    return document.getElementById('loading-screen');
  }

  /**
   * ✅ GET CONTENT DIV (Lazy load)
   */
  getContentDiv() {
    return document.getElementById('main-content-view');
  }

  /**
   * ✅ INITIALISER LE LOADER (optionnel, juste pour vérification)
   */
  init() {
    const loadingScreen = this.getLoadingScreen();
    const contentDiv = this.getContentDiv();
    
    if (!loadingScreen) {
      console.warn('⚠️ Loading screen element not found');
    }
    if (!contentDiv) {
      console.warn('⚠️ Content view element not found');
    }
  }

  /**
   * ✅ AFFICHER LE LOADING SCREEN
   */
  show() {
    const loadingScreen = this.getLoadingScreen();
    if (!loadingScreen || this.isLoading) return;
    
    // Vérifier si le loading screen est déjà caché (display: none)
    if (loadingScreen.style.display === 'none') {
      loadingScreen.style.display = '';
    }
    
    this.isLoading = true;
    this.loadStartTime = Date.now();
    
    // Afficher le loading screen
    loadingScreen.classList.remove('hidden');
    
    // Réinitialiser la barre de progression
    this.resetProgress();
    
    // Démarrer l'animation de la barre de progression
    this.animateProgress();
    
  }

  /**
   * ✅ MASQUER LE LOADING SCREEN AVEC DÉLAI MIN
   */
  hide() {
    const loadingScreen = this.getLoadingScreen();
    if (!loadingScreen || !this.isLoading) return;
    
    // Calculer le temps écoulé depuis le démarrage du loading
    const elapsed = Date.now() - this.loadStartTime;
    const remainingTime = Math.max(0, this.minLoadingDuration - elapsed);
    
    // Attendre le délai minimum avant de masquer
    clearTimeout(this.loadingTimeout);
    this.loadingTimeout = setTimeout(() => {
      const ls = this.getLoadingScreen();
      if (ls) {
        ls.classList.add('hidden');
      }
      this.isLoading = false;
    }, remainingTime);
  }

  /**
   * ✅ RÉINITIALISER LA BARRE DE PROGRESSION
   */
  resetProgress() {
    const bar = document.getElementById('loading-progress-bar');
    const pct = document.getElementById('loading-percent');
    const arcC = document.getElementById('progress-arc-c');
    const arcLen = 2 * Math.PI * 56;
    
    if (bar) bar.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (arcC) {
      arcC.style.strokeDasharray = arcLen;
      arcC.style.strokeDashoffset = arcLen;
    }
  }

  /**
   * ✅ ANIMER LA BARRE DE PROGRESSION
   */
  animateProgress() {
    const bar = document.getElementById('loading-progress-bar');
    const pct = document.getElementById('loading-percent');
    const arcC = document.getElementById('progress-arc-c');
    
    if (!bar || !pct) return;
    
    const arcLen = 2 * Math.PI * 56;
    let progress = 0;
    const animationDuration = 2000; // 2 secondes
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / animationDuration, 1);
      
      // Utiliser une courbe d'animation ease-out
      progress = 90 * (1 - Math.pow(1 - t, 3));
      
      bar.style.width = progress + '%';
      pct.textContent = Math.round(progress) + '%';
      
      if (arcC) {
        arcC.style.strokeDasharray = arcLen;
        arcC.style.strokeDashoffset = arcLen * (1 - progress / 100);
      }
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Finir à 90%
        if (!this.isLoading) {
          // Si le loading est déjà en cours de fermeture, compléter la progression
          bar.style.width = '100%';
          pct.textContent = '100%';
        }
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * ✅ CHARGER UNE PAGE AVEC LOADING
   * @param {Function} renderFunction - Fonction asynchrone qui retourne le HTML
   * @param {Function} setupFunction - Fonction pour initialiser les événements (optionnel)
   * @param {Boolean} showLoading - Afficher le loading screen (par défaut true)
   */
  async loadPage(renderFunction, setupFunction = null, showLoading = true) {
    try {
      const contentDiv = this.getContentDiv();
      if (!contentDiv) {
        console.error('❌ [PageLoader] Content div not found');
        return;
      }
      
      // Afficher le loading screen (optionnel)
      if (showLoading) {
        this.show();
      } else {
        // Ajouter une animation de fade-out si pas de loading screen
        contentDiv.style.transition = 'opacity 0.3s ease-out';
        contentDiv.style.opacity = '0.7';
        await this.delay(300);
      }
      
      // Attendre un petit délai pour que le loading s'affiche visuellement
      await this.delay(50);
      
      // Ajouter un délai supplémentaire pour les transitions
      await this.delay(this.pageTransitionDelay);
      
      // Nettoyer l'ancienne page
      this.cleanupOldPage();
      
      // Charger le HTML de la nouvelle page
      const html = await renderFunction();
      
      // Afficher le contenu dans le DOM
      if (contentDiv) {
        contentDiv.innerHTML = html;
        
        // Réinitialiser l'opacité avec transition
        contentDiv.style.opacity = '0';
        contentDiv.style.transition = 'opacity 0.4s ease-in';
        
        // Forcer le reflow pour déclencher la transition
        void contentDiv.offsetHeight;
        contentDiv.style.opacity = '1';
        
        // Exécuter les scripts inline
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
      }
      
      // Exécuter la fonction de setup si fournie
      if (setupFunction && typeof setupFunction === 'function') {
        setupFunction();
      }
      
      // Masquer le loading screen (seulement s'il a été montré)
      if (showLoading) {
        this.hide();
      }
      
    } catch (error) {
      console.error('❌ [PageLoader] Error loading page:', error);
      
      const contentDiv = this.getContentDiv();
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div style="
            padding: 40px 20px;
            color: #ef4444;
            text-align: center;
            font-size: 14px;
          ">
            <div style="margin-bottom: 10px;">Erreur lors du chargement</div>
            <div style="font-size: 12px; opacity: 0.8;">${error.message || 'Erreur inconnue'}</div>
          </div>
        `;
      }
      
      // Masquer le loading même en cas d'erreur (seulement s'il a été montré)
      if (showLoading) {
        this.hide();
      }
    }
  }

  /**
   * ✅ NETTOYER L'ANCIENNE PAGE
   */
  cleanupOldPage() {
    const contentDiv = this.getContentDiv();
    if (!contentDiv) return;
    
    try {
      // Supprimer les event listeners des anciens éléments
      const oldElements = contentDiv.querySelectorAll('[data-listener]');
      oldElements.forEach(el => {
        try {
          el.replaceWith(el.cloneNode(true));
        } catch (err) {
          console.warn('[Cleanup] Error removing element:', err);
        }
      });
      
      // Arrêter les éléments audio/vidéo
      const audioElements = contentDiv.querySelectorAll('audio, video');
      audioElements.forEach(el => {
        try {
          el.pause();
          el.src = '';
          el.load();
          el.remove();
        } catch (err) {
          console.warn('[Cleanup] Error removing audio/video:', err);
        }
      });
      
      // Supprimer les styles injectés localement
      const styleElements = contentDiv.querySelectorAll('style');
      styleElements.forEach(el => {
        try {
          el.remove();
        } catch (err) {
          console.warn('[Cleanup] Error removing style:', err);
        }
      });
      
      // Nettoyer le contenu
      contentDiv.innerHTML = '';
      
    } catch (error) {
      console.error('[Cleanup] Error during page cleanup:', error);
    }
  }

  /**
   * ✅ UTILITAIRE POUR DÉLAI
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ✅ ANNULER LE LOADING EN COURS
   */
  cancel() {
    clearTimeout(this.loadingTimeout);
    const loadingScreen = this.getLoadingScreen();
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    this.isLoading = false;
  }
}

// ✅ Exporter pour utilisation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageLoader;
}

// ✅ Rendre disponible globalement
if (typeof window !== 'undefined') {
  window.PageLoader = PageLoader;
}

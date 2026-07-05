/**
 * ================================
 * network-manager.js
 * Gestion optimisée des requêtes réseau avec cache et déduplication
 * ================================
 */

const fetch = require('node-fetch').default || require('node-fetch');
const CacheManager = require('./cache-manager');

class NetworkManager {
  constructor(options = {}) {
    this.cache = new CacheManager(options.cache || {});
    this.pendingRequests = new Map();
    this.timeout = options.timeout || 30000; // 30 secondes par défaut
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.stats = {
      requests: 0,
      cacheHits: 0,
      errors: 0,
      retries: 0
    };
  }

  /**
   * Effectuer une requête avec déduplication et cache
   */
  async fetch(url, options = {}) {
    // Vérifier le cache d'abord
    const cacheKey = `${options.method || 'GET'}:${url}`;
    const cached = this.cache.get(cacheKey);
    if (cached && !options.bypassCache) {
      this.stats.cacheHits++;
      console.log(`📦 Cache hit: ${cacheKey}`);
      return cached;
    }

    // Éviter les requêtes dupliquées en cours
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`⏳ Attente requête dupliquée: ${cacheKey}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Créer la promesse de la requête
    const requestPromise = this._fetchWithRetry(url, options);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      
      // Mettre en cache les réponses GET réussies
      if ((options.method || 'GET') === 'GET' && response.ok) {
        const cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
        this.cache.set(cacheKey, response, cacheTTL);
      }

      return response;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Requête avec retry automatique
   */
  async _fetchWithRetry(url, options = {}, attempt = 1) {
    this.stats.requests++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          timeout: this.timeout
        });

        clearTimeout(timeoutId);

        if (!response.ok && attempt < this.retryAttempts) {
          console.warn(`⚠️ Tentative ${attempt}/${this.retryAttempts} pour ${url} (status: ${response.status})`);
          this.stats.retries++;
          
          await this._delay(this.retryDelay * Math.pow(2, attempt - 1));
          return this._fetchWithRetry(url, options, attempt + 1);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      this.stats.errors++;

      if (attempt < this.retryAttempts) {
        console.warn(`⚠️ Erreur requête (tentative ${attempt}/${this.retryAttempts}): ${error.message}`);
        this.stats.retries++;
        
        await this._delay(this.retryDelay * Math.pow(2, attempt - 1));
        return this._fetchWithRetry(url, options, attempt + 1);
      }

      console.error(`❌ Erreur requête finale: ${error.message}`);
      throw error;
    }
  }

  /**
   * Délai avec exponential backoff
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Requête JSON avec gestion d'erreur
   */
  async fetchJSON(url, options = {}) {
    try {
      const response = await this.fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Erreur JSON pour ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      cache: this.cache.getStats(),
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Réinitialiser les statistiques
   */
  resetStats() {
    this.stats = {
      requests: 0,
      cacheHits: 0,
      errors: 0,
      retries: 0
    };
    this.cache.resetStats();
  }

  /**
   * Vider le cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Annuler une requête en attente
   */
  cancelPending(url, method = 'GET') {
    const cacheKey = `${method}:${url}`;
    this.pendingRequests.delete(cacheKey);
  }
}

module.exports = NetworkManager;

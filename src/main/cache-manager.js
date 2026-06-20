/**
 * ================================
 * cache-manager.js
 * Gestion optimisée du cache avec expiration et limite de taille
 * ================================
 */

class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.timers = new Map();
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Obtenir une valeur du cache
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);
    
    // Vérifier l'expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Définir une valeur dans le cache
   */
  set(key, value, ttl = this.defaultTTL) {
    // Vérifier la limite de taille
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    // Annuler le timer existant
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const entry = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null
    };

    this.cache.set(key, entry);
    this.stats.sets++;

    // Définir un timer pour supprimer le cache expiré
    if (ttl) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }

    return this;
  }

  /**
   * Vérifier l'existence d'une clé
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Supprimer une clé
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
    return this;
  }

  /**
   * Supprimer l'entrée la plus ancienne (LRU)
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Vider tout le cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
    return this;
  }

  /**
   * Obtenir les statistiques
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 'N/A';
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Réinitialiser les statistiques
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  /**
   * Obtenir ou définir avec fonction de calcul
   */
  async getOrSet(key, computeFn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await Promise.resolve(computeFn());
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error(`❌ Erreur calcul cache pour ${key}:`, error.message);
      throw error;
    }
  }
}

module.exports = CacheManager;

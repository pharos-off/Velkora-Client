/**
 * ================================
 * security-manager.js
 * Gestion centralisée de la sécurité et du chiffrement
 * ================================
 */

const crypto = require('crypto');
const Store = require('electron-store').default || require('electron-store');
const path = require('path');

class SecurityManager {
  constructor() {
    this.store = new Store();
    this.encryptionKey = this.initEncryptionKey();
    this.validationRules = {
      gameDirectory: /^[a-zA-Z0-9:\\/._-]+$/,
      version: /^[\d.]+(-[\w]+)?$/,
      username: /^[a-zA-Z0-9_]{3,16}$/,
      ip: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?$|^[a-zA-Z0-9.-]+(?::\d+)?$/,
      url: /^https?:\/\/.+/
    };
  }

  /**
   * Initialiser la clé de chiffrement persistante
   */
  initEncryptionKey() {
    let key = this.store.get('__encryption_key');
    if (!key) {
      key = crypto.randomBytes(32).toString('hex');
      this.store.set('__encryption_key', key);
    }
    return Buffer.from(key, 'hex');
  }

  /**
   * Chiffrer des données sensibles
   */
  encrypt(data) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        data: encrypted,
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('❌ Erreur chiffrement:', error.message);
      throw error;
    }
  }

  /**
   * Déchiffrer des données
   */
  decrypt(encrypted) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(encrypted.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('❌ Erreur déchiffrement:', error.message);
      throw error;
    }
  }

  /**
   * Valider une entrée utilisateur
   */
  validate(value, type) {
    const rule = this.validationRules[type];
    if (!rule) {
      console.warn(`⚠️ Pas de règle de validation pour: ${type}`);
      return true;
    }
    return rule.test(String(value));
  }

  /**
   * Valider une URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return this.validate(url, 'url');
    } catch {
      return false;
    }
  }

  /**
   * Valider un chemin de fichier
   */
  isValidFilePath(filePath) {
    // Vérifier qu'il ne contient pas de chemins remontés
    if (filePath.includes('..') || filePath.includes('~')) {
      return false;
    }
    return this.validate(filePath, 'gameDirectory');
  }

  /**
   * Nettoyer une chaîne contre les injections
   */
  sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>\"']/g, char => ({
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]))
      .slice(0, 1000); // Limiter la longueur
  }

  /**
   * Générer un token sécurisé
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hacher un mot de passe (utiliser pour les tokens)
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Stocker un token de manière sécurisée
   */
  storeAuthData(authData) {
    const encrypted = this.encrypt(authData);
    this.store.set('authData', encrypted);
    return true;
  }

  /**
   * Récupérer les données d'auth de manière sécurisée
   */
  getAuthData() {
    const encrypted = this.store.get('authData');
    if (!encrypted) return null;
    try {
      return this.decrypt(encrypted);
    } catch {
      console.warn('⚠️ Impossible de récupérer les données d\'authentification');
      return null;
    }
  }

  /**
   * Supprimer les données sensibles
   */
  clearAuthData() {
    this.store.delete('authData');
  }

  /**
   * Auditer une action sensible
   */
  auditLog(action, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      ...details
    };
    
    const logs = this.store.get('auditLogs', []);
    logs.push(logEntry);
    
    // Garder seulement les 1000 derniers logs
    if (logs.length > 1000) {
      logs.shift();
    }
    
    this.store.set('auditLogs', logs);
    console.log(`🔐 [AUDIT] ${action} - ${timestamp}`);
  }

  /**
   * Vérifier l'intégrité des données
   */
  generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Vérifier le hash
   */
  verifyHash(data, hash) {
    return this.generateHash(data) === hash;
  }
}

module.exports = new SecurityManager();

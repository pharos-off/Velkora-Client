/**
 * ✅ GESTIONNAIRE DES MODS
 * Responsabilité: Gérer, importer et contrôler les mods
 */

let ipcRenderer;
try {
  if (window && window.electron && window.electron.ipcRenderer) {
    ipcRenderer = window.electron.ipcRenderer;
  } else if (typeof require === 'function') {
    try {
      const _electron = require('electron');
      ipcRenderer = _electron && _electron.ipcRenderer ? _electron.ipcRenderer : _electron;
    } catch (_) {
      ipcRenderer = null;
    }
  } else {
    ipcRenderer = null;
  }
} catch (e) {
  ipcRenderer = null;
}
const path = require('path');
const { icons: lucideIcons } = require('./lucide-icons');

class ModsManager {
  constructor(app) {
    this.app = app;
    this.deleteHandler = null;
    this.changeHandler = null;
    this.inputHandler = null;
    this.selectedModProfileId = null;
    this.modsFolder = '';
    this.toastContainerId = 'mods-toast-container';
    this.modalId = 'mods-feedback-modal';
    this.autoRefreshInterval = null;
    this.autoRefreshInFlight = false;
    this.lastModsSignature = '';
    this.currentCategory = 'mods'; // ✅ AJOUTÉ: Pour tracker mods, texturepacks, shaders
    this.filterState = {
      query: '',
      status: 'all',
      sort: 'recent'
    };
  }

  getProfiles() {
    return Array.isArray(this.app.profiles) ? this.app.profiles : [];
  }

  ensureSelectedModProfile() {
    const profiles = this.getProfiles();
    if (!profiles.length) {
      this.selectedModProfileId = null;
      return null;
    }

    if (!this.selectedModProfileId || !profiles.some(profile => profile.id === this.selectedModProfileId)) {
      this.selectedModProfileId = this.app.selectedProfile?.id || profiles[0].id;
    }

    return this.getSelectedModProfile();
  }

  getSelectedModProfile() {
    const profiles = this.getProfiles();
    return profiles.find(profile => profile.id === this.selectedModProfileId) || profiles[0] || null;
  }

  getProfileLoader(profile) {
    const raw = String(profile?.loader || profile?.name || '').toLowerCase();
    if (raw.includes('neoforge')) return 'neoforge';
    if (raw.includes('forge')) return 'forge';
    if (raw.includes('fabric')) return 'fabric';
    if (raw.includes('quilt')) return 'quilt';
    return 'vanilla';
  }

  formatLoaderLabel(loader) {
    const labels = {
      vanilla: 'Vanilla',
      fabric: 'Fabric',
      forge: 'Forge',
      neoforge: 'NeoForge',
      quilt: 'Quilt'
    };
    return labels[loader] || loader;
  }

  escapeAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  parseSizeToBytes(sizeLabel) {
    const match = String(sizeLabel || '').trim().match(/^([\d.,]+)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };

    return Math.round(value * (multipliers[unit] || 1));
  }

  buildModsSignature(mods = []) {
    return (Array.isArray(mods) ? mods : [])
      .map((mod) => [
        mod?.fileName || '',
        mod?.path || '',
        mod?.enabled ? '1' : '0',
        mod?.size || '',
        mod?.importedAt || ''
      ].join('|'))
      .sort()
      .join('||');
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      void this.checkForExternalModChanges();
    }, 2500);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  async checkForExternalModChanges() {
    if (this.autoRefreshInFlight) {
      return;
    }

    if (this.app.currentView !== 'mods') {
      this.stopAutoRefresh();
      return;
    }

    if (document.getElementById('modrinth-modal')) {
      return;
    }

    this.autoRefreshInFlight = true;
    try {
      const mods = await ipcRenderer.invoke('get-installed-mods');
      const nextSignature = this.buildModsSignature(mods);
      if (nextSignature && nextSignature !== this.lastModsSignature) {
        this.lastModsSignature = nextSignature;
        await this.rerenderModsView();
      }
    } catch (error) {
      console.warn('Detection automatique des mods indisponible:', error);
    } finally {
      this.autoRefreshInFlight = false;
    }
  }

  // ✅ SETTER pour changer la catégorie actuelle
  setCurrentCategory(category) {
    if (['mods', 'texturepacks', 'shaders'].includes(category)) {
      this.currentCategory = category;
    }
  }

  /**
   * ✅ 1. RENDRE LE GESTIONNAIRE DE MODS (AVEC ONGLETS)
   */
  async render() {
    switch (this.currentCategory) {
      case 'texturepacks':
        return await this.renderTexturePacksSection();
      case 'shaders':
        return await this.renderShadersSection();
      default:
      case 'mods':
        return await this.renderModsSection();
    }
  }

  // ✅ RENDRE LES ONGLETS
  renderTabs() {
    const tabs = [
      { id: 'mods', label: 'Mods', icon: lucideIcons.puzzle },
      { id: 'texturepacks', label: 'Texture Packs', icon: lucideIcons.palette },
      { id: 'shaders', label: 'Shaders', icon: lucideIcons.sparkles }
    ];

    return `
      <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(99, 102, 241, 0.2); padding-bottom: 0;">
        ${tabs.map(tab => `
          <button class="mods-tab-button" data-tab="${tab.id}" style="
            padding: 12px 16px;
            background: ${this.currentCategory === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent'};
            border: none;
            border-bottom: ${this.currentCategory === tab.id ? '2px solid #6366f1' : '2px solid transparent'};
            color: ${this.currentCategory === tab.id ? '#e2e8f0' : '#94a3b8'};
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span>${tab.icon}</span> ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  // ✅ SECTION MODS (ANCIEN RENDU)
  async renderModsSection() {
    const [modsResult, modsFolderResult, settingsResult] = await Promise.all([
      ipcRenderer.invoke('get-installed-mods'),
      ipcRenderer.invoke('get-mods-folder').catch(error => ({ error })),
      ipcRenderer.invoke('get-settings').catch(() => ({}))
    ]);
    const mods = modsResult || [];
    try {
      const settingsGameDir = String(settingsResult?.gameDirectory || '').trim();
      if (settingsGameDir) {
        this.modsFolder = path.join(settingsGameDir, 'mods');
      } else {
        if (modsFolderResult?.error) {
          throw modsFolderResult.error;
        }
        this.modsFolder = modsFolderResult;
      }
    } catch (error) {
      console.warn('get-mods-folder indisponible:', error);
      this.modsFolder = 'Indisponible pour le moment. Redémarre complètement le launcher.';
    }
    const profiles = this.getProfiles();
    const selectedProfile = this.ensureSelectedModProfile();
    const selectedLoader = this.getProfileLoader(selectedProfile);
    const enabledModsCount = mods.filter(mod => mod.enabled).length;
    this.lastModsSignature = this.buildModsSignature(mods);

    return `
      <div class="view-container" style="padding: 40px;">
        <div class="view-header" style="margin-bottom: 24px;">
          <div>
            <h1 class="view-title" style="display: flex; align-items: center; gap: 12px;"><i class="bi bi-puzzle"></i> Gestionnaire de mods</h1>
            <p style="color: #94a3b8; margin-top: 10px;">${mods.length} mod(s) installés • ${enabledModsCount} activé(s)</p>
          </div>
        </div>

        ${this.renderTabs()}

        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 24px;">
          <button id="btn-open-mods-folder" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Ouvrir le dossier</button>
          <button id="btn-refresh-mods" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Rafraichir</button>
          <button id="btn-modrinth-search" class="btn-primary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto; background: linear-gradient(135deg, #1bd96a 0%, #0fb857 100%); border: none; cursor: pointer; display: flex; align-items: center; gap: 6px;"><span style="display: flex;">${lucideIcons.magnifyingGlass}</span> Modrinth</button>
          <button id="btn-import-mod" class="btn-primary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto; max-width: 120px;">+ Importer</button>
        </div>

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="display: flex; flex-wrap: wrap; gap: 18px; align-items: end; margin-bottom: 12px;">
            <div style="min-width: 240px; flex: 1;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;">Profil utilisé pour les téléchargements</div>
              <select id="mods-profile-select" style="width: 100%; padding: 10px 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0;">
                ${profiles.map(profile => `
                  <option value="${profile.id}" ${profile.id === selectedProfile?.id ? 'selected' : ''}>
                    ${profile.name} • ${profile.version}
                  </option>
                `).join('')}
              </select>
            </div>
            <div style="min-width: 180px;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;">Loader du profil</div>
              <select id="mods-loader-select" style="width: 100%; padding: 10px 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0;">
                ${['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'].map(loader => `
                  <option value="${loader}" ${loader === selectedLoader ? 'selected' : ''}>${this.formatLoaderLabel(loader)}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 6px;">
            <strong style="color: #6366f1;">Chemin d'installation :</strong> ${this.modsFolder || 'Non disponible'}
          </div>
          <div style="color: #94a3b8; font-size: 12px;">
            Version ciblée : ${selectedProfile?.version || 'Inconnue'} • Loader : ${this.formatLoaderLabel(selectedLoader)} • Les dépendances requises sont téléchargées automatiquement.
          </div>
        </div>

        ${mods.length === 0 ? this.renderEmpty() : this.renderModsList(mods)}
        ${this.renderStats(mods, enabledModsCount)}
        ${this.renderInfo()}
      </div>
    `;
  }

  // ✅ SECTION TEXTURE PACKS
  async renderTexturePacksSection() {
    const [resourcepacksFolder, installedPacks] = await Promise.all([
      ipcRenderer.invoke('get-resourcepacks-folder').catch(() => ''),
      ipcRenderer.invoke('get-installed-resourcepacks').catch(() => [])
    ]);
    const selectedProfile = this.app.selectedProfile || this.app.profiles?.[0] || null;
    const gameVersion = selectedProfile?.version || '';
    const packs = Array.isArray(installedPacks) ? installedPacks : [];

    return `
      <div class="view-container" style="padding: 40px;">
        <div class="view-header" style="margin-bottom: 24px;">
          <div>
            <h1 class="view-title" style="display: flex; align-items: center; gap: 12px;"><i class="bi bi-image"></i> Texture Packs</h1>
            <p style="color: #94a3b8; margin-top: 10px;">${packs.length} pack(s) installé(s) • Téléchargez et gérez vos packs de textures.</p>
          </div>
        </div>

        ${this.renderTabs()}

        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 24px;">
          <button id="btn-open-resourcepacks-folder" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Ouvrir le dossier</button>
          <button id="btn-refresh-resourcepacks" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Rafraichir</button>
        </div>

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px;">
            <strong style="color: #6366f1;">Chemin d'installation :</strong> ${this.escapeHtml(resourcepacksFolder || 'Non disponible')}
          </div>
          <div style="color: #94a3b8; font-size: 12px;">
            Version ciblée : ${this.escapeHtml(gameVersion || 'Inconnue')} • Les packs compatibles sont recherchés sur Modrinth.
          </div>
        </div>

        ${packs.length === 0 ? this.renderEmptyTexturePacks() : this.renderInstalledResourcePacksList(packs)}
        ${this.renderResourcePackStats(packs)}
        ${this.renderResourcePackInfo()}

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #e2e8f0; font-size: 15px; font-weight: 700; margin-bottom: 12px;">Recherche Modrinth</div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <input id="resourcepack-search-input" type="text" placeholder="Rechercher un texture pack..." style="flex: 1; min-width: 260px; padding: 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0; font-size: 14px;">
            <button id="btn-search-resourcepacks" class="btn-primary" style="padding: 10px 18px; width: auto;">Rechercher</button>
          </div>
        </div>

        <div id="resourcepacks-results" style="max-width: 1000px;">
          <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 16px;">${lucideIcons.download}</div>
            <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Recherchez un texture pack</h3>
            <p style="color: #94a3b8; margin: 0;">Les téléchargements seront placés dans le dossier resourcepacks du jeu.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ✅ SECTION SHADERS
  async renderShadersSection() {
    const [shadersFolder, installedShaders] = await Promise.all([
      ipcRenderer.invoke('get-shaders-folder').catch(() => ''),
      ipcRenderer.invoke('get-installed-shaders').catch(() => [])
    ]);
    const selectedProfile = this.app.selectedProfile || this.app.profiles?.[0] || null;
    const gameVersion = selectedProfile?.version || '';
    const shaders = Array.isArray(installedShaders) ? installedShaders : [];

    return `
      <div class="view-container" style="padding: 40px;">
        <div class="view-header" style="margin-bottom: 24px;">
          <div>
            <h1 class="view-title" style="display: flex; align-items: center; gap: 12px;"><span style="display: flex; width: 24px; height: 24px;">${lucideIcons.sparkles}</span> Shaders</h1>
            <p style="color: #94a3b8; margin-top: 10px;">${shaders.length} shader(s) installé(s) • Téléchargez et gérez vos shaders.</p>
          </div>
        </div>

        ${this.renderTabs()}

        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 24px;">
          <button id="btn-open-shaders-folder" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Ouvrir le dossier</button>
          <button id="btn-refresh-shaders" class="btn-secondary" style="white-space: nowrap; padding: 8px 16px; font-size: 14px; width: auto;">Rafraichir</button>
        </div>

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px;">
            <strong style="color: #6366f1;">Chemin d'installation :</strong> ${this.escapeHtml(shadersFolder || 'Non disponible')}
          </div>
          <div style="color: #94a3b8; font-size: 12px;">
            Version ciblée : ${this.escapeHtml(gameVersion || 'Inconnue')} • Les shaders compatibles sont recherchés sur Modrinth.
          </div>
        </div>

        ${shaders.length === 0 ? this.renderEmptyShaders() : this.renderInstalledShadersList(shaders)}
        ${this.renderShaderStats(shaders)}
        ${this.renderShaderInfo()}

        <div style="max-width: 1000px; margin-bottom: 24px; padding: 18px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px;">
          <div style="color: #e2e8f0; font-size: 15px; font-weight: 700; margin-bottom: 12px;">Recherche Modrinth</div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <input id="shader-search-input" type="text" placeholder="Rechercher un shader..." style="flex: 1; min-width: 260px; padding: 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0; font-size: 14px;">
            <button id="btn-search-shaders" class="btn-primary" style="padding: 10px 18px; width: auto;">Rechercher</button>
          </div>
        </div>

        <div id="shaders-results" style="max-width: 1000px;">
          <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 16px;">${lucideIcons.download}</div>
            <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Recherchez un shader</h3>
            <p style="color: #94a3b8; margin: 0;">Les téléchargements seront placés dans le dossier shaderpacks du jeu.</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ✅ 2. RENDRE L'ÉTAT VIDE
   */
  renderEmpty() {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px;">
        <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 16px; display: flex; justify-content: center;">${lucideIcons.download}</div>
          <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Aucun mod installé</h3>
          <p style="color: #94a3b8; margin: 0;">Importez ou téléchargez votre premier mod pour personnaliser Minecraft</p>
        </div>
      </div>
    `;
  }

  /**
   * ✅ 3. RENDRE LA LISTE DES MODS (EN COLONNE)
   */
  renderModsList(mods) {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; width: 100%;">
        <div id="mods-list-container" style="display: block; width: 100%;">
          ${mods.map((mod) => this.renderModItem(mod)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * ✅ 4. RENDRE UN ITEM MOD
   */
  renderModItem(mod) {
    const details = [
      `Version du mod : ${mod.version || 'N/A'}`,
      mod.gameVersion ? `MC : ${mod.gameVersion}` : null,
      mod.loader ? `Loader : ${this.formatLoaderLabel(mod.loader)}` : null,
      `Taille : ${mod.size || 'N/A'}`,
      mod.isDependency ? 'Dependance' : null
    ].filter(Boolean).join(' • ');

    return `
      <div class="mod-item" data-mod-id="${mod.id}" data-name="${this.escapeAttribute(mod.name)}" data-version="${this.escapeAttribute(mod.version || '')}" data-file-name="${this.escapeAttribute(mod.fileName || '')}" data-path="${this.escapeAttribute(mod.path || '')}" data-enabled="${mod.enabled ? 'true' : 'false'}" data-dependency="${mod.isDependency ? 'true' : 'false'}" data-size-bytes="${this.parseSizeToBytes(mod.size)}" data-imported-at="${this.escapeAttribute(mod.importedAt || '')}" data-game-version="${this.escapeAttribute(mod.gameVersion || '')}" data-loader="${this.escapeAttribute(mod.loader || '')}" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; transition: all 0.3s; width: 100%; min-width: 0; margin-bottom: 12px; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <input type="checkbox" class="mod-toggle" data-mod-id="${mod.id}" ${mod.enabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;">
          
          <!-- MOD IMAGE -->
          <div style="width: 48px; height: 48px; min-width: 48px; min-height: 48px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${mod.image 
              ? `<img src="${mod.image}" alt="${this.escapeAttribute(mod.name)}" style="width: 100%; height: 100%; object-fit: cover;">` 
              : `<div style="font-size: 24px;">${lucideIcons.package}</div>`
            }
          </div>
          
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="flex-shrink: 0; font-size: 16px; color: ${mod.enabled ? '#22c55e' : '#ef4444'};">${mod.enabled ? lucideIcons.checkCircle2 : lucideIcons.xCircle}</span>
              <span style="overflow: hidden; text-overflow: ellipsis;">${mod.name}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
              ${details}
            </div>
          </div>
        </div>
        <button class="btn-delete-mod" data-mod-id="${mod.id}" data-mod-name="${this.escapeAttribute(mod.name)}" title="Supprimer ce mod" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 8px; transition: all 0.3s; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0;">
          ${lucideIcons.trash3}
        </button>
      </div>
    `;
  }

  /**
   * ✅ 5. RENDRE LES STATISTIQUES
   */
  renderStats(mods, enabledModsCount) {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        ${this.renderStatCard('Mods installés', mods.length, lucideIcons.download)}
        ${this.renderStatCard('Mods activés', enabledModsCount, lucideIcons.checkCircle2, '#22c55e')}
        ${this.renderStatCard('Mods désactivés', mods.length - enabledModsCount, lucideIcons.xCircle, '#ef4444')}
      </div>
    `;
  }

  /**
   * ✅ 6. RENDRE UNE CARTE STATISTIQUE
   */
  renderStatCard(label, value, icon, color = '#e2e8f0') {
    return `
      <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
        <div style="color: ${color}; font-weight: 600; margin-bottom: 4px;">${value}</div>
        <div style="color: #94a3b8; font-size: 12px;">${label}</div>
      </div>
    `;
  }

  /**
   * ✅ 7. RENDRE LES INFOS
   */
  renderInfo() {
    return `
      <div style="max-width: 1000px; padding: 20px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px;">
        <p style="color: #cbd5e1; margin: 0; font-size: 14px;">
          <strong style="color: #6366f1;"><span style="display: inline-flex; width: 16px; height: 16px;">${lucideIcons.lightbulb}</span> Info:</strong> Vous pouvez activer/désactiver les mods sans les supprimer. Vérifiez la compatibilité avec votre version de Minecraft avant d'activer un mod.
        </p>
      </div>
    `;
  }

  // ✅ Helper pour texture packs
  renderEmptyTexturePacks() {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px;">
        <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 16px; display: flex; justify-content: center;">${lucideIcons.download}</div>
          <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Aucun texture pack installé</h3>
          <p style="color: #94a3b8; margin: 0;">Utilisez la recherche Modrinth ci-dessous pour télécharger votre premier pack.</p>
        </div>
      </div>
    `;
  }

  renderInstalledResourcePacksList(packs) {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <h2 style="margin: 0; color: #e2e8f0; font-size: 20px;">Packs installés</h2>
          <div style="color: #94a3b8; font-size: 12px;">Cliquez sur un pack pour voir ses détails.</div>
        </div>
        <div id="resourcepacks-list-container" style="display: block; width: 100%;">
          ${packs.map((pack) => this.renderResourcePackItem(pack)).join('')}
        </div>
      </div>
    `;
  }

  renderResourcePackItem(pack) {
    const details = [
      `Fichier : ${pack.fileName || 'Inconnu'}`,
      `Type : ${pack.type === 'folder' ? 'Dossier' : 'Archive'}`,
      `Taille : ${pack.size || 'N/A'}`
    ].join(' • ');

    return `
      <div class="resourcepack-item" data-pack-name="${this.escapeHtml(pack.name || '')}" data-file-name="${this.escapeHtml(pack.fileName || '')}" data-pack-path="${this.escapeHtml(pack.path || '')}" data-pack-size="${this.escapeHtml(pack.size || '')}" data-pack-type="${this.escapeHtml(pack.type || '')}" data-imported-at="${this.escapeHtml(pack.importedAt || '')}" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; transition: all 0.3s; width: 100%; min-width: 0; margin-bottom: 12px; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <div style="width: 48px; height: 48px; min-width: 48px; border-radius: 8px; background: rgba(51, 65, 85, 0.6); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.2); transition: all 0.3s;">
            ${pack.image ? `<img src="${pack.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; width: 20px; height: 20px; color: #94a3b8;">${lucideIcons.palette}</div>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${this.escapeHtml(pack.name || pack.fileName || 'Texture pack')}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.escapeHtml(details)}
            </div>
          </div>
        </div>
        <button class="btn-delete-resourcepack" data-pack-path="${this.escapeHtml(pack.path || '')}" data-pack-name="${this.escapeHtml(pack.name || '')}" title="Supprimer ce texture pack" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 8px; transition: all 0.3s; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0;">
          ${lucideIcons.trash3}
        </button>
      </div>
    `;
  }

  renderResourcePackStats(packs) {
    const folderCount = packs.filter((pack) => pack.type === 'folder').length;
    const archiveCount = packs.length - folderCount;
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        ${this.renderStatCard('Packs installés', packs.length, lucideIcons.download)}
        ${this.renderStatCard('Archives', archiveCount, lucideIcons.archive, '#22c55e')}
        ${this.renderStatCard('Dossiers', folderCount, lucideIcons.folder, '#f59e0b')}
      </div>
    `;
  }

  renderResourcePackInfo() {
    return `
      <div style="max-width: 1000px; padding: 20px; margin-bottom: 30px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px;">
        <p style="color: #cbd5e1; margin: 0; font-size: 14px;">
          <strong style="color: #6366f1;">Info :</strong> Les noms longs sont tronqués dans la liste, mais vous pouvez cliquer sur un pack pour afficher ses détails complets ou le supprimer.
        </p>
      </div>
    `;
  }

  // ✅ Helpers pour shaders
  renderEmptyShaders() {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px;">
        <div style="background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 60px 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 16px; display: flex; justify-content: center;">${lucideIcons.download}</div>
          <h3 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 18px;">Aucun shader installé</h3>
          <p style="color: #94a3b8; margin: 0;">Utilisez la recherche Modrinth ci-dessous pour télécharger votre premier shader.</p>
        </div>
      </div>
    `;
  }

  renderInstalledShadersList(shaders) {
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <h2 style="margin: 0; color: #e2e8f0; font-size: 20px;">Shaders installés</h2>
          <div style="color: #94a3b8; font-size: 12px;">Cliquez sur un shader pour voir ses détails.</div>
        </div>
        <div id="shaders-list-container" style="display: block; width: 100%;">
          ${shaders.map((shader) => this.renderShaderItem(shader)).join('')}
        </div>
      </div>
    `;
  }

  renderShaderItem(shader) {
    const details = [
      `Fichier : ${shader.fileName || 'Inconnu'}`,
      `Type : ${shader.type === 'folder' ? 'Dossier' : 'Archive'}`,
      `Taille : ${shader.size || 'N/A'}`
    ].join(' • ');

    return `
      <div class="shader-item" data-shader-name="${this.escapeHtml(shader.name || '')}" data-file-name="${this.escapeHtml(shader.fileName || '')}" data-shader-path="${this.escapeHtml(shader.path || '')}" data-shader-size="${this.escapeHtml(shader.size || '')}" data-shader-type="${this.escapeHtml(shader.type || '')}" data-imported-at="${this.escapeHtml(shader.importedAt || '')}" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; transition: all 0.3s; width: 100%; min-width: 0; margin-bottom: 12px; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <div style="width: 48px; height: 48px; min-width: 48px; border-radius: 8px; background: rgba(51, 65, 85, 0.6); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.2); transition: all 0.3s;">
            ${shader.image ? `<img src="${shader.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; width: 20px; height: 20px; color: #cbd5e1;">${lucideIcons.sparkles}</div>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${this.escapeHtml(shader.name || shader.fileName || 'Shader')}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.escapeHtml(details)}
            </div>
          </div>
        </div>
        <button class="btn-delete-shader" data-shader-path="${this.escapeHtml(shader.path || '')}" data-shader-name="${this.escapeHtml(shader.name || '')}" title="Supprimer ce shader" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 8px; transition: all 0.3s; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0;">
          ${lucideIcons.trash3}
        </button>
      </div>
    `;
  }

  renderShaderStats(shaders) {
    const folderCount = shaders.filter((shader) => shader.type === 'folder').length;
    const archiveCount = shaders.length - folderCount;
    return `
      <div style="max-width: 1000px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        ${this.renderStatCard('Shaders installés', shaders.length, lucideIcons.sparkles)}
        ${this.renderStatCard('Archives', archiveCount, lucideIcons.archive, '#22c55e')}
        ${this.renderStatCard('Dossiers', folderCount, lucideIcons.folder, '#f59e0b')}
      </div>
    `;
  }

  renderShaderInfo() {
    return `
      <div style="max-width: 1000px; padding: 20px; margin-bottom: 30px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px;">
        <p style="color: #cbd5e1; margin: 0; font-size: 14px;">
          <strong style="color: #6366f1;">Info :</strong> Les shaders doivent être compatibles avec votre version de Minecraft et votre mod loader. Assurez-vous d'avoir les prérequis installés avant d'activer un shader.
        </p>
      </div>
    `;
  }

  /**
   * ✅ 8. CONFIGURER LES ÉVÉNEMENTS
   */
  setupEvents() {
    // Nettoyer les anciens écouteurs
    this.cleanup();

    // Créer les handlers
    this.deleteHandler = (e) => this.handleClick(e);
    this.changeHandler = (e) => this.handleChange(e);

    // Ajouter les écouteurs
    document.addEventListener('click', this.deleteHandler);
    document.addEventListener('change', this.changeHandler);
    
    // ✅ AJOUTER LES ÉCOUTEURS POUR LES ONGLETS
    const tabButtons = document.querySelectorAll('.mods-tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = button.dataset.tab;
        this.setCurrentCategory(tabId);
        this.rerenderModsView();
      });
    });
    
    this.applyLocalFilters();
    this.startAutoRefresh();
  }

  /**
   * ✅ 9. GESTIONNAIRE DE CLICS
   */
  async handleClick(e) {
    if (e.target.id === 'btn-open-mods-folder' || e.target.closest('#btn-open-mods-folder')) {
      e.preventDefault();
      e.stopPropagation();
      if (this.modsFolder && !String(this.modsFolder).includes('Indisponible')) {
        ipcRenderer.send('open-folder', this.modsFolder);
        this.showToast({
          title: 'Dossier des mods ouvert',
          message: this.modsFolder,
          type: 'success'
        });
      }
      return;
    }

    if (e.target.id === 'btn-refresh-mods' || e.target.closest('#btn-refresh-mods')) {
      e.preventDefault();
      e.stopPropagation();
      await this.rerenderModsView();
      this.showToast({
        title: 'Liste mise a jour',
        message: 'Les mods ont ete recharges.',
        type: 'info'
      });
      return;
    }

    // Bouton Modrinth
    if (e.target.id === 'btn-modrinth-search' || e.target.closest('#btn-modrinth-search')) {
      e.preventDefault();
      e.stopPropagation();
      await this.showModrinthModal();
      return;
    }

    // Bouton importer
    if (e.target.id === 'btn-import-mod' || e.target.closest('#btn-import-mod')) {
      e.preventDefault();
      e.stopPropagation();
      await this.handleImport();
      return;
    }
    
    // Bouton supprimer (cherche aussi dans les parents)
    let deleteBtn = e.target.classList.contains('btn-delete-mod') ? e.target : null;
    if (!deleteBtn && e.target.closest) {
      deleteBtn = e.target.closest('.btn-delete-mod');
    }
    
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const modId = parseInt(deleteBtn.getAttribute('data-mod-id'));
      const modName = deleteBtn.getAttribute('data-mod-name') || 'ce mod';
      console.log('🗑️ Suppression mod ID:', modId);
      await this.handleDelete(modId, modName);
      return;
    }

    const modItem = e.target.closest('.mod-item');
    if (modItem && !e.target.closest('.mod-toggle')) {
      e.preventDefault();
      await this.showModDetails(modItem);
    }

    // ✅ HANDLERS POUR LES TEXTURE PACKS
    if (e.target.id === 'btn-open-resourcepacks-folder' || e.target.closest('#btn-open-resourcepacks-folder')) {
      e.preventDefault();
      e.stopPropagation();
      const folder = await ipcRenderer.invoke('get-resourcepacks-folder').catch(() => '');
      if (folder) {
        ipcRenderer.send('open-folder', folder);
        this.showToast({
          title: 'Dossier des texture packs ouvert',
          message: folder,
          type: 'success'
        });
      }
      return;
    }

    if (e.target.id === 'btn-refresh-resourcepacks' || e.target.closest('#btn-refresh-resourcepacks')) {
      e.preventDefault();
      e.stopPropagation();
      await this.rerenderModsView();
      this.showToast({
        title: 'Texture packs recharges',
        message: 'La liste des texture packs a ete mise a jour.',
        type: 'info'
      });
      return;
    }

    if (e.target.id === 'btn-search-resourcepacks' || e.target.closest('#btn-search-resourcepacks')) {
      e.preventDefault();
      e.stopPropagation();
      const searchInput = document.getElementById('resourcepack-search-input');
      const query = searchInput?.value?.trim();
      if (query) {
        await this.searchTexturePacks(query);
      }
      return;
    }

    if (e.target.id === 'btn-open-shaders-folder' || e.target.closest('#btn-open-shaders-folder')) {
      e.preventDefault();
      e.stopPropagation();
      const folder = await ipcRenderer.invoke('get-shaders-folder').catch(() => '');
      if (folder) {
        ipcRenderer.send('open-folder', folder);
        this.showToast({
          title: 'Dossier des shaders ouvert',
          message: folder,
          type: 'success'
        });
      }
      return;
    }

    if (e.target.id === 'btn-refresh-shaders' || e.target.closest('#btn-refresh-shaders')) {
      e.preventDefault();
      e.stopPropagation();
      await this.rerenderModsView();
      this.showToast({
        title: 'Shaders recharges',
        message: 'La liste des shaders a ete mise a jour.',
        type: 'info'
      });
      return;
    }

    if (e.target.id === 'btn-search-shaders' || e.target.closest('#btn-search-shaders')) {
      e.preventDefault();
      e.stopPropagation();
      const searchInput = document.getElementById('shader-search-input');
      const query = searchInput?.value?.trim();
      if (query) {
        await this.searchShaders(query);
      }
      return;
    }

    // DELETE resourcepack
    let deleteResourcepackBtn = e.target.classList.contains('btn-delete-resourcepack') ? e.target : null;
    if (!deleteResourcepackBtn && e.target.closest) {
      deleteResourcepackBtn = e.target.closest('.btn-delete-resourcepack');
    }
    
    if (deleteResourcepackBtn) {
      e.preventDefault();
      e.stopPropagation();
      const packPath = deleteResourcepackBtn.getAttribute('data-pack-path');
      const packName = deleteResourcepackBtn.getAttribute('data-pack-name') || 'ce texture pack';
      await this.deleteTexturePack(packPath, packName);
      return;
    }

    // DELETE shader
    let deleteShaderBtn = e.target.classList.contains('btn-delete-shader') ? e.target : null;
    if (!deleteShaderBtn && e.target.closest) {
      deleteShaderBtn = e.target.closest('.btn-delete-shader');
    }
    
    if (deleteShaderBtn) {
      e.preventDefault();
      e.stopPropagation();
      const shaderPath = deleteShaderBtn.getAttribute('data-shader-path');
      const shaderName = deleteShaderBtn.getAttribute('data-shader-name') || 'ce shader';
      await this.deleteShader(shaderPath, shaderName);
      return;
    }

    const packItem = e.target.closest('.resourcepack-item');
    if (packItem) {
      e.preventDefault();
      await this.showTexturePackDetails(packItem);
    }
  }

  /**
   * ✅ 10. GESTIONNAIRE DE CHANGEMENTS
   */
  async handleChange(e) {
    if (e.target.id === 'mods-profile-select') {
      const profileId = parseInt(e.target.value, 10);
      this.selectedModProfileId = profileId;
      await this.refreshProfiles(profileId);
      await this.rerenderModsView();
      this.showToast({
        title: 'Profil actif mis a jour',
        message: 'Les prochains telechargements utiliseront ce profil.',
        type: 'info'
      });
      return;
    }

    if (e.target.id === 'mods-loader-select') {
      const profile = this.getSelectedModProfile();
      if (!profile) return;

      const result = await ipcRenderer.invoke('update-profile-loader', profile.id, e.target.value);
      if (result?.success) {
        await this.refreshProfiles(profile.id);
        await this.rerenderModsView();
        this.showToast({
          title: 'Loader mis a jour',
          message: `Le profil utilise maintenant ${this.formatLoaderLabel(e.target.value)}.`,
          type: 'success'
        });
      } else {
        this.showToast({
          title: 'Modification impossible',
          message: result?.error || 'Impossible de modifier le loader.',
          type: 'error'
        });
      }
      return;
    }

    if (e.target.id === 'mods-status-filter') {
      this.filterState.status = e.target.value || 'all';
      this.applyLocalFilters();
      return;
    }

    if (e.target.id === 'mods-sort-select') {
      this.filterState.sort = e.target.value || 'recent';
      this.applyLocalFilters();
      return;
    }

    if (e.target.classList.contains('mod-toggle')) {
      const modId = parseInt(e.target.getAttribute('data-mod-id'));
      const enabled = e.target.checked;
      await this.handleToggle(modId, enabled);
    }
  }

  applyLocalFilters() {
    const listContainer = document.getElementById('mods-list-container');
    if (!listContainer) {
      return;
    }

    const statusSelect = document.getElementById('mods-status-filter');
    const sortSelect = document.getElementById('mods-sort-select');

    if (statusSelect) this.filterState.status = statusSelect.value || 'all';
    if (sortSelect) this.filterState.sort = sortSelect.value || 'recent';

    const items = Array.from(listContainer.querySelectorAll('.mod-item'));

    items.sort((a, b) => this.compareModElements(a, b));
    items.forEach(item => listContainer.appendChild(item));

    let visibleCount = 0;
    items.forEach((item) => {
      const enabled = item.dataset.enabled === 'true';
      const dependency = item.dataset.dependency === 'true';

      let matchesStatus = true;
      if (this.filterState.status === 'enabled') matchesStatus = enabled;
      if (this.filterState.status === 'disabled') matchesStatus = !enabled;
      if (this.filterState.status === 'dependencies') matchesStatus = dependency;

      const visible = matchesStatus;
      item.style.display = visible ? 'flex' : 'none';
      if (visible) visibleCount += 1;
    });

    const visibleCountEl = document.getElementById('mods-visible-count');
    if (visibleCountEl) {
      visibleCountEl.textContent = `Affichage: ${visibleCount}/${items.length} mod(s)`;
    }
  }

  compareModElements(a, b) {
    switch (this.filterState.sort) {
      case 'name':
        return String(a.dataset.name || '').localeCompare(String(b.dataset.name || ''), 'fr', { sensitivity: 'base' });
      case 'size':
        return Number(b.dataset.sizeBytes || 0) - Number(a.dataset.sizeBytes || 0);
      case 'gameVersion':
        return String(b.dataset.gameVersion || '').localeCompare(String(a.dataset.gameVersion || ''), 'fr', { numeric: true, sensitivity: 'base' });
      case 'recent':
      default:
        return new Date(b.dataset.importedAt || 0).getTime() - new Date(a.dataset.importedAt || 0).getTime();
    }
  }

  getVisibleModElements() {
    return Array.from(document.querySelectorAll('#mods-list-container .mod-item'))
      .filter(item => item.style.display !== 'none');
  }

  async showModDetails(modItem) {
    const details = [
      `Fichier: ${modItem.dataset.fileName || 'Inconnu'}`,
      `Version du mod: ${modItem.dataset.version || 'N/A'}`,
      `Version Minecraft: ${modItem.dataset.gameVersion || 'Non renseignee'}`,
      `Loader: ${this.formatLoaderLabel(modItem.dataset.loader || 'vanilla')}`,
      `Etat: ${modItem.dataset.enabled === 'true' ? 'Actif' : 'Desactive'}`,
      `Dependance: ${modItem.dataset.dependency === 'true' ? 'Oui' : 'Non'}`,
      `Chemin: ${modItem.dataset.path || 'Inconnu'}`
    ];

    await this.showDialog({
      title: modItem.dataset.name || 'Details du mod',
      message: 'Informations disponibles pour ce mod.',
      details,
      type: 'info'
    });
  }

  /**
   * ✅ 11. HANDLERS DES ACTIONS
   */
  async handleImport() {
    console.log('📥 Début import de mod');
    try {
      const result = await ipcRenderer.invoke('import-mod');
      console.log('✅ Résultat import:', result);
      if (result && result.success) {
        await this.rerenderModsView();
        await this.showDialog({
          title: 'Import termine',
          message: result.message || 'Le ou les mods ont ete importes avec succes.',
          type: 'success',
          details: Array.isArray(result.errors) ? result.errors : []
        });
      } else if (result?.message) {
        this.showToast({
          title: 'Import annule',
          message: result.message,
          type: result?.canceled ? 'info' : 'error'
        });
      }
    } catch (error) {
      console.error('❌ Erreur import:', error);
      this.showToast({
        title: 'Erreur d\'import',
        message: error.message,
        type: 'error'
      });
    }
  }

  async handleDelete(modId, modName = 'ce mod') {
    console.log('🗣️ Début suppression mod:', modId);

    const confirmed = await this.showConfirmDialog({
      title: 'Supprimer ce mod ?',
      message: `${modName} sera retire de la liste et son fichier sera supprime.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      type: 'error'
    });

    if (!confirmed) {
      console.log('❌ Suppression annulée');
      return;
    }

    try {
      console.log('✅ Deletion confirmed, calling IPC...');
      const result = await ipcRenderer.invoke('delete-mod', modId);
      console.log('📦 Deletion result:', result);

      if (result && result.success) {
        console.log('✅ Mod supprimé, rafraîchissement de la vue');
        await this.rerenderModsView();
        this.showToast({
          title: 'Mod supprime',
          message: `${modName} a ete supprime avec succes.`,
          type: 'success'
        });
      } else {
        console.error('❌ Échec suppression:', result?.message);
        this.showToast({
          title: 'Suppression impossible',
          message: result?.message || 'Suppression impossible.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      this.showToast({
        title: 'Erreur de suppression',
        message: error.message,
        type: 'error'
      });
    }
  }

  async handleToggle(modId, enabled) {
    // Update UI instantly
    const modItem = document.querySelector(`[data-mod-id="${modId}"]`);
    if (modItem) {
      const toggle = modItem.querySelector('.mod-toggle');
      const statusIcon = modItem.querySelector('span[style*="flex-shrink: 0"]');
      
      if (toggle) toggle.checked = enabled;
      if (statusIcon) statusIcon.textContent = enabled ? '✅' : '❌';
    }
    
    // Save to backend
    const result = await ipcRenderer.invoke('toggle-mod', { modId, enabled });
    
    // If backend failed, revert UI
    if (!result.success) {
      if (modItem) {
        const toggle = modItem.querySelector('.mod-toggle');
        const statusIcon = modItem.querySelector('span[style*="flex-shrink: 0"]');
        
        if (toggle) toggle.checked = !enabled;
        if (statusIcon) statusIcon.textContent = !enabled ? '✅' : '❌';
      }
      console.error('❌ Error toggling mod:', result.message);
      this.showToast({
        title: 'Etat du mod non modifie',
        message: result?.message || 'Le changement na pas pu etre enregistre.',
        type: 'error'
      });
    }
  }

  async refreshProfiles(preferredProfileId = null) {
    const profiles = await ipcRenderer.invoke('get-profiles');
    this.app.profiles = Array.isArray(profiles) ? profiles : [];

    const targetProfileId = preferredProfileId ?? this.selectedModProfileId ?? this.app.selectedProfile?.id;
    const selectedProfile = this.app.profiles.find(profile => profile.id === targetProfileId) || this.app.profiles[0] || null;

    this.app.selectedProfile = selectedProfile;
    this.selectedModProfileId = selectedProfile?.id || null;

    return selectedProfile;
  }

  async rerenderModsView() {
    this.app.currentView = 'mods';
    await this.app.render(true); // ✅ forceRerender=true pour forcer la mise à jour même en restant sur la même vue
  }

  /**
   * ✅ 12. MODRINTH INTEGRATION
   */
  async showModrinthModal() {
    // Vérifier si modal existe déjà
    let modal = document.getElementById('modrinth-modal');
    if (modal) modal.remove();
    const selectedProfile = this.ensureSelectedModProfile();
    const selectedLoader = this.getProfileLoader(selectedProfile);

    // Créer la modale
    modal = document.createElement('div');
    modal.id = 'modrinth-modal';
    modal.innerHTML = `
      <div id="modrinth-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div id="modrinth-dialog" tabindex="-1" style="background: #0f172a; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #e2e8f0; display: flex; align-items: center; gap: 8px;"><span style="display: flex; width: 18px; height: 18px;">${lucideIcons.magnifyingGlass}</span> Recherche Modrinth</h2>
            <button id="close-modrinth-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">${lucideIcons.closeX}</button>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 10px; color: #cbd5e1; font-size: 12px;">
            Profil : <strong style="color: #e2e8f0;">${selectedProfile?.name || 'Aucun'}</strong> •
            Version : <strong style="color: #e2e8f0;">${selectedProfile?.version || 'Inconnue'}</strong> •
            Loader : <strong style="color: #e2e8f0;">${this.formatLoaderLabel(selectedLoader)}</strong>
          </div>

          <div style="margin-bottom: 20px;">
            <input id="modrinth-search-input" type="text" placeholder="Rechercher des mods..." autocomplete="off" spellcheck="false" style="width: 100%; padding: 10px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0; font-size: 14px;">
          </div>

          <div id="modrinth-results" style="margin-bottom: 20px; min-height: 200px;">
            <p style="color: #94a3b8; text-align: center;">Entrez un terme pour rechercher des mods</p>
          </div>

          <button id="close-modrinth-btn" style="width: 100%; padding: 10px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; color: #e2e8f0; cursor: pointer; font-weight: 600;">Fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Événements
    document.getElementById('modrinth-overlay').addEventListener('click', () => modal.remove());
    document.getElementById('modrinth-dialog').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('close-modrinth-modal').addEventListener('click', () => modal.remove());
    document.getElementById('close-modrinth-btn').addEventListener('click', () => modal.remove());

    // Recherche en direct
    const searchInput = document.getElementById('modrinth-search-input');
    let searchTimeout;
    ['keydown', 'keyup', 'keypress', 'click', 'mousedown'].forEach(eventName => {
      searchInput.addEventListener(eventName, (e) => e.stopPropagation());
    });
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (e.target.value.trim()) {
          this.searchModrinth(e.target.value);
        } else {
          document.getElementById('modrinth-results').innerHTML = '<p style="color: #94a3b8; text-align: center;">Entrez un terme pour rechercher des mods</p>';
        }
      }, 500);
    });

    const focusSearchInput = () => {
      searchInput.focus({ preventScroll: true });
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    };

    requestAnimationFrame(() => requestAnimationFrame(focusSearchInput));
    setTimeout(focusSearchInput, 80);
    setTimeout(focusSearchInput, 180);
  }

  async searchModrinth(query) {
    const resultsContainer = document.getElementById('modrinth-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;"><span style="display: inline-flex; font-size: 18px;">${lucideIcons.loader}</span> Recherche en cours...</p>`;

    try {
      const response = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        resultsContainer.innerHTML = '<p style="color: #94a3b8; text-align: center;">Aucun mod trouvé</p>';
        return;
      }

      const html = data.hits.map(mod => `
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="width: 56px; height: 56px; min-width: 56px; min-height: 56px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${mod.icon_url ? `<img src="${mod.icon_url}" alt="${this.escapeHtml(mod.title)}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="font-size: 28px;">${lucideIcons.package}</div>`}
          </div>
          <div style="flex: 1;">
            <div style="color: #e2e8f0; font-weight: 600; margin-bottom: 4px;">${mod.title}</div>
            <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">${mod.description || 'Aucune description'}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">Versions disponibles: ${Array.isArray(mod.game_versions) ? mod.game_versions.slice(0, 5).join(', ') + (mod.game_versions.length > 5 ? '...' : '') : 'Inconnues'}</div>
            <div style="color: #6366f1; font-size: 12px;">Téléchargements : ${mod.downloads.toLocaleString()}</div>
          </div>
          <button class="btn-download-modrinth" data-mod-id="${mod.project_id || mod.slug}" data-mod-name="${mod.title}" style="background: linear-gradient(135deg, #1bd96a 0%, #0fb857 100%); border: none; padding: 8px 12px; border-radius: 6px; color: white; cursor: pointer; font-weight: 600; margin-left: 10px; flex-shrink: 0;">Télécharger</button>
        </div>
      `).join('');

      resultsContainer.innerHTML = html;

      // Ajouter événements de téléchargement
      document.querySelectorAll('.btn-download-modrinth').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await this.downloadModrinthMod(e.target.getAttribute('data-mod-id'), e.target.getAttribute('data-mod-name'));
        });
      });
    } catch (error) {
      console.error('❌ Modrinth search error:', error);
      resultsContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Erreur pendant la recherche. Réessayez.</p>';
    }
  }

  async downloadModrinthMod(projectId, modName) {
    try {
      console.log(`📥 Downloading mod: ${modName} (${projectId})`);
      const selectedProfile = this.ensureSelectedModProfile();
      const result = await ipcRenderer.invoke('download-modrinth-mod', projectId, modName, {
        profileId: selectedProfile?.id,
        profileName: selectedProfile?.name,
        gameVersion: selectedProfile?.version,
        loader: this.getProfileLoader(selectedProfile)
      });

      if (result.success) {
        // Fermer la modale et recharger les mods
        const modal = document.getElementById('modrinth-modal');
        if (modal) modal.remove();
        await this.rerenderModsView();
        await this.showDialog({
          title: 'Telechargement termine',
          message: result.message || `${modName} a ete telecharge et installe.`,
          type: 'success',
          details: this.buildDownloadDetails(modName, result)
        });
        setTimeout(() => {
          if (typeof window.focus === 'function') window.focus();
        }, 50);
      } else {
        this.showToast({
          title: 'Telechargement impossible',
          message: result.message,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('❌ Download error:', error);
      this.showToast({
        title: 'Erreur de telechargement',
        message: error.message,
        type: 'error'
      });
    }
  }

  buildDownloadDetails(modName, result = {}) {
    const details = [];
    const installedMods = Array.isArray(result.installedMods) ? result.installedMods : [];
    const dependenciesInstalled = Array.isArray(result.dependenciesInstalled) ? result.dependenciesInstalled : [];
    const skippedMods = Array.isArray(result.skippedMods) ? result.skippedMods : [];

    if (installedMods.length > 0) {
      details.push(`Installes: ${installedMods.join(', ')}`);
    }
    if (dependenciesInstalled.length > 0) {
      details.push(`Dependances ajoutees: ${dependenciesInstalled.join(', ')}`);
    }
    if (skippedMods.length > 0) {
      details.push(`Deja presents: ${skippedMods.join(', ')}`);
    }
    if (details.length === 0) {
      details.push(`${modName} a ete traite pour le profil selectionne.`);
    }

    return details;
  }

  getToastContainer() {
    let container = document.getElementById(this.toastContainerId);
    if (container) {
      return container;
    }

    container = document.createElement('div');
    container.id = this.toastContainerId;
    container.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 11000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: min(420px, calc(100vw - 32px));
    `;
    document.body.appendChild(container);
    return container;
  }

  showToast(messageOrOptions, type = 'info') {
    const options = typeof messageOrOptions === 'object'
      ? messageOrOptions
      : { message: messageOrOptions, type };
    const toast = document.createElement('div');
    const backgrounds = {
      success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      info: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
    };
    const icons = {
      success: 'OK',
      error: 'ERREUR',
      info: 'INFO'
    };

    toast.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: 14px;
      color: white;
      background: ${backgrounds[options.type] || backgrounds.info};
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      cursor: pointer;
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.14);
    `;

    const iconBadge = document.createElement('div');
    iconBadge.textContent = icons[options.type] || icons.info;
    iconBadge.style.cssText = `
      min-width: 52px;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.95);
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.04em;
    `;

    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; min-width: 0;';

    if (options.title) {
      const titleEl = document.createElement('div');
      titleEl.textContent = options.title;
      titleEl.style.cssText = 'font-size: 14px; font-weight: 700; margin-bottom: 4px;';
      content.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.textContent = options.message || '';
    messageEl.style.cssText = 'font-size: 13px; line-height: 1.45; color: rgba(255, 255, 255, 0.92); white-space: pre-line;';
    content.appendChild(messageEl);

    toast.appendChild(iconBadge);
    toast.appendChild(content);

    toast.addEventListener('click', () => toast.remove());
    this.getToastContainer().appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    }, options.duration || 3200);
  }

  showDialog({
    title = 'Information',
    message = '',
    details = [],
    type = 'info',
    confirmLabel = 'Fermer',
    cancelLabel = null
  } = {}) {
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = this.modalId;
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 12000;
        background: rgba(2, 6, 23, 0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        backdrop-filter: blur(10px);
      `;

      const accentColors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#6366f1'
      };

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        width: min(520px, 100%);
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-top: 3px solid ${accentColors[type] || accentColors.info};
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        color: #e2e8f0;
        overflow: hidden;
      `;

      const header = document.createElement('div');
      header.style.cssText = 'padding: 22px 24px 12px;';

      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      titleEl.style.cssText = 'font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;';

      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      messageEl.style.cssText = 'font-size: 14px; line-height: 1.6; color: #cbd5e1; white-space: pre-line;';

      header.appendChild(titleEl);
      header.appendChild(messageEl);
      dialog.appendChild(header);

      if (Array.isArray(details) && details.length > 0) {
        const detailsWrapper = document.createElement('div');
        detailsWrapper.style.cssText = 'padding: 0 24px 16px;';

        details.forEach((detail) => {
          const item = document.createElement('div');
          item.textContent = detail;
          item.style.cssText = `
            margin-top: 8px;
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(30, 41, 59, 0.78);
            border: 1px solid rgba(99, 102, 241, 0.18);
            color: #cbd5e1;
            font-size: 13px;
            line-height: 1.45;
          `;
          detailsWrapper.appendChild(item);
        });

        dialog.appendChild(detailsWrapper);
      }

      const footer = document.createElement('div');
      footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 18px 24px 24px;
        background: rgba(15, 23, 42, 0.6);
        border-top: 1px solid rgba(148, 163, 184, 0.1);
      `;

      const close = (value) => {
        overlay.remove();
        resolve(value);
      };

      if (cancelLabel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelLabel;
        cancelBtn.style.cssText = `
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(30, 41, 59, 0.72);
          color: #e2e8f0;
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        `;
        cancelBtn.addEventListener('click', () => close(false));
        footer.appendChild(cancelBtn);
      }

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = confirmLabel;
      confirmBtn.style.cssText = `
        border: none;
        background: linear-gradient(135deg, ${accentColors[type] || accentColors.info} 0%, rgba(79, 70, 229, 0.95) 100%);
        color: white;
        border-radius: 10px;
        padding: 10px 16px;
        cursor: pointer;
        font-weight: 700;
      `;
      confirmBtn.addEventListener('click', () => close(true));
      footer.appendChild(confirmBtn);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay && cancelLabel) {
          close(false);
        }
      });

      dialog.appendChild(footer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      confirmBtn.focus({ preventScroll: true });
    });
  }

  showConfirmDialog(options = {}) {
    return this.showDialog({
      ...options,
      confirmLabel: options.confirmLabel || 'Confirmer',
      cancelLabel: options.cancelLabel || 'Annuler'
    });
  }

  // ✅ TEXTURE PACK METHODS
  async showTexturePackDetails(packItem) {
    const details = [
      `Nom : ${packItem.dataset.packName || 'Inconnu'}`,
      `Fichier : ${packItem.dataset.fileName || 'Inconnu'}`,
      `Type : ${packItem.dataset.packType === 'folder' ? 'Dossier' : 'Archive'}`,
      `Taille : ${packItem.dataset.packSize || 'N/A'}`,
      `Ajouté le : ${packItem.dataset.importedAt ? new Date(packItem.dataset.importedAt).toLocaleString('fr-FR') : 'Inconnu'}`,
      `Chemin : ${packItem.dataset.packPath || 'Inconnu'}`
    ];

    await this.showDialog({
      title: packItem.dataset.packName || 'Détails du texture pack',
      message: 'Informations disponibles pour ce texture pack.',
      details,
      type: 'info'
    });
  }

  async deleteTexturePack(packPath, packName = 'ce texture pack') {
    const confirmed = await this.showConfirmDialog({
      title: 'Supprimer ce texture pack ?',
      message: `${packName} sera retiré du dossier resourcepacks.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      type: 'error'
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-resourcepack', packPath);
      if (result?.success) {
        this.showToast({
          title: 'Texture pack supprimé',
          message: `${packName} a été supprimé avec succès.`,
          type: 'success'
        });
        await this.rerenderModsView();
        return;
      }

      this.showToast({
        title: 'Suppression impossible',
        message: result?.message || 'Impossible de supprimer ce texture pack.',
        type: 'error'
      });
    } catch (error) {
      console.error('Erreur suppression texture pack:', error);
      this.showToast({
        title: 'Erreur',
        message: 'Une erreur est survenue lors de la suppression.',
        type: 'error'
      });
    }
  }

  async searchTexturePacks(query = '') {
    const resultsContainer = document.getElementById('resourcepacks-results');
    if (!resultsContainer) return;

    const searchQuery = query || document.getElementById('resourcepack-search-input')?.value?.trim() || '';
    if (!searchQuery) {
      this.showToast({
        title: 'Recherche vide',
        message: 'Entrez un nom de texture pack.',
        type: 'info'
      });
      return;
    }

    resultsContainer.innerHTML = `<div style="text-align: center; color: #94a3b8;"><div style="display: inline-flex; width: 20px; height: 20px;">${lucideIcons.loader}</div> Recherche en cours...</div>`;

    try {
      const gameVersion = this.app.selectedProfile?.version || '';
      const facets = encodeURIComponent(JSON.stringify([['project_type:resourcepack']]));
      const versionParam = gameVersion ? `&versions=${encodeURIComponent(JSON.stringify([gameVersion]))}` : '';
      const response = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&limit=12&facets=${facets}${versionParam}`);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        resultsContainer.innerHTML = '<p style="color: #94a3b8; text-align: center;">Aucun texture pack trouvé</p>';
        return;
      }

      resultsContainer.innerHTML = data.hits.map((pack) => `
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; gap: 16px; align-items: flex-start;">
          <div style="width: 56px; height: 56px; min-width: 56px; border-radius: 8px; background: rgba(51, 65, 85, 0.6); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.2);">
            ${pack.icon_url ? `<img src="${pack.icon_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; width: 24px; height: 24px; color: #94a3b8;">${lucideIcons.palette}</div>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="color: #e2e8f0; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(pack.title)}</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${this.escapeHtml(pack.description || 'Aucune description')}</div>
            <div style="color: #6366f1; font-size: 12px;">Téléchargements : ${(pack.downloads || 0).toLocaleString()}</div>
          </div>
          <button class="btn-download-resourcepack" data-pack-id="${this.escapeHtml(pack.project_id || pack.slug)}" data-pack-name="${this.escapeHtml(pack.title)}" style="background: linear-gradient(135deg, #1bd96a 0%, #0fb857 100%); border: none; padding: 10px 14px; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; white-space: nowrap; align-self: center;">Télécharger</button>
        </div>
      `).join('');

      document.querySelectorAll('.btn-download-resourcepack').forEach((button) => {
        button.addEventListener('click', async () => {
          await this.downloadTexturePack(button.dataset.packId, button.dataset.packName);
        });
      });
    } catch (error) {
      console.error('Erreur recherche texture packs:', error);
      resultsContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Erreur pendant la recherche.</p>';
    }
  }

  async downloadTexturePack(projectId, packName) {
    try {
      const result = await ipcRenderer.invoke('download-modrinth-resourcepack', projectId, packName, {
        gameVersion: this.app.selectedProfile?.version
      });

      if (result?.success) {
        await this.rerenderModsView();
        await this.showDialog({
          title: 'Texture pack téléchargé',
          message: `${packName} a été téléchargé et est installé dans le dossier resourcepacks.`,
          type: 'success'
        });
      } else {
        throw new Error(result?.message || 'Erreur lors du téléchargement');
      }
    } catch (error) {
      console.error('Erreur téléchargement texture pack:', error);
      await this.showDialog({
        title: 'Erreur de téléchargement',
        message: error.message ||'Une erreur est survenue lors du téléchargement du texture pack.',
        type: 'error'
      });
    }
  }

  async deleteShader(shaderPath, shaderName = 'ce shader') {
    if (!shaderPath) {
      this.showToast({
        title: 'Erreur',
        message: 'Chemin invalide',
        type: 'error'
      });
      return;
    }

    const confirmed = await this.showDialog({
      title: 'Supprimer le shader ?',
      message: `Êtes-vous sûr de vouloir supprimer "${shaderName}" ?`,
      type: 'question'
    });

    if (!confirmed) return;

    try {
      const result = await ipcRenderer.invoke('delete-shader', shaderPath);

      if (result?.success) {
        this.showToast({
          title: 'Shader supprimé',
          message: `${shaderName} a été supprimé avec succès.`,
          type: 'success'
        });
        await this.rerenderModsView();
        return;
      }

      this.showToast({
        title: 'Suppression impossible',
        message: result?.message || 'Impossible de supprimer ce shader.',
        type: 'error'
      });
    } catch (error) {
      console.error('Erreur suppression shader:', error);
      this.showToast({
        title: 'Erreur',
        message: 'Une erreur est survenue lors de la suppression.',
        type: 'error'
      });
    }
  }

  async searchShaders(query = '') {
    const resultsContainer = document.getElementById('shaders-results');
    if (!resultsContainer) return;

    const searchQuery = query || document.getElementById('shader-search-input')?.value?.trim() || '';
    if (!searchQuery) {
      this.showToast({
        title: 'Recherche vide',
        message: 'Entrez un nom de shader.',
        type: 'info'
      });
      return;
    }

    resultsContainer.innerHTML = `<div style="text-align: center; color: #94a3b8;"><div style="display: inline-flex; width: 20px; height: 20px;">${lucideIcons.loader}</div> Recherche en cours...</div>`;

    try {
      const gameVersion = this.app.selectedProfile?.version || '';
      const facets = encodeURIComponent(JSON.stringify([['project_type:shader']]));
      const versionParam = gameVersion ? `&versions=${encodeURIComponent(JSON.stringify([gameVersion]))}` : '';
      const response = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&limit=12&facets=${facets}${versionParam}`);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        resultsContainer.innerHTML = '<p style="color: #94a3b8; text-align: center;">Aucun shader trouvé</p>';
        return;
      }

      resultsContainer.innerHTML = data.hits.map((shader) => `
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; gap: 16px; align-items: flex-start;">
          <div style="width: 56px; height: 56px; min-width: 56px; border-radius: 8px; background: rgba(51, 65, 85, 0.6); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.2);">
            ${shader.icon_url ? `<img src="${shader.icon_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; width: 24px; height: 24px; color: #cbd5e1;">${lucideIcons.sparkles}</div>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="color: #e2e8f0; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(shader.title)}</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${this.escapeHtml(shader.description || 'Aucune description')}</div>
            <div style="color: #6366f1; font-size: 12px;">Téléchargements : ${(shader.downloads || 0).toLocaleString()}</div>
          </div>
          <button class="btn-download-shader" data-shader-id="${this.escapeHtml(shader.project_id || shader.slug)}" data-shader-name="${this.escapeHtml(shader.title)}" style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border: none; padding: 10px 14px; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; white-space: nowrap; align-self: center;">Télécharger</button>
        </div>
      `).join('');

      document.querySelectorAll('.btn-download-shader').forEach((button) => {
        button.addEventListener('click', async () => {
          await this.downloadShader(button.dataset.shaderId, button.dataset.shaderName);
        });
      });
    } catch (error) {
      console.error('Erreur recherche shaders:', error);
      resultsContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Erreur pendant la recherche.</p>';
    }
  }

  async downloadShader(projectId, shaderName) {
    try {
      const result = await ipcRenderer.invoke('download-modrinth-shader', projectId, shaderName, {
        gameVersion: this.app.selectedProfile?.version
      });

      if (result?.success) {
        await this.rerenderModsView();
        await this.showDialog({
          title: 'Shader téléchargé',
          message: `${shaderName} a été téléchargé et est installé dans le dossier shaderpacks.`,
          type: 'success'
        });
      } else {
        throw new Error(result?.message || 'Erreur lors du téléchargement');
      }
    } catch (error) {
      console.error('Erreur téléchargement shader:', error);
      await this.showDialog({
        title: 'Erreur de téléchargement',
        message: error.message || 'Une erreur est survenue lors du téléchargement du shader.',
        type: 'error'
      });
    }
  }

  /**
   * ✅ 13. NETTOYER
   */
  cleanup() {
    this.stopAutoRefresh();
    if (this.deleteHandler) {
      document.removeEventListener('click', this.deleteHandler);
    }
    if (this.changeHandler) {
      document.removeEventListener('change', this.changeHandler);
    }
    if (this.inputHandler) {
      document.removeEventListener('input', this.inputHandler);
    }
  }
}

module.exports = ModsManager;

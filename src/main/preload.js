const { contextBridge, ipcRenderer, shell } = require('electron');

// Whitelists des canaux IPC (adapter si besoin)
const INVOKE_ALLOWED = [
  'get-player-head','get-auth-data','get-profiles','get-settings','get-system-ram','get-friends','check-friends-status',
  'subscribe-newsletter','get-logo-path','get-screenshots-list','get-screenshots-count','get-screenshots-folder',
  'get-saves-folder','get-saves-count','get-resourcepacks-folder','get-installed-resourcepacks','get-installed-mods','create-profile',
  'delete-profile','duplicate-profile','get-game-stats','get-assets-path','select-game-directory','set-startup-enabled','get-startup-enabled',
  'get-storage-info','get-notification-settings','save-notification-settings','test-notification','test-discord-rpc','get-discord-settings',
  'save-discord-settings','open-minecraft-folder','reset-discord-settings','get-required-java-version','get-detected-java-path',
  'update-profile-version','save-settings','logout-account','ping-server','get-account-info','launch-game','get-mods-folder','launch-minecraft',
  'import-mod','download-modrinth-mod','download-modrinth-resourcepack','get-shaders-folder','get-installed-shaders','download-modrinth-shader',
  'delete-mod','delete-resourcepack','delete-shader','login-microsoft','check-online','get-versions','get-game-directory','get-installed-versions'
];

const SEND_ALLOWED = [
  'minimize-window','maximize-window','close-window','open-external','open-folder','toggle-fullscreen',
  'minimize-settings-window','maximize-settings-window','close-settings-window','logout-from-settings','close-settings-window','open-settings',
  'minimize-logs-window','maximize-logs-window','close-logs-window','clear-logs','settings-window-ready'
];

const ON_ALLOWED = [
  'add-log','settings-updated','set-logs','play-notification-sound','game-closed','launch-progress','launch-error',
  'navigate-to-tab','logout-from-settings','return-to-login','theme-updated','discord-status-changed','discord-connected',
  'discord-disconnected','discord-connecting','discord-error','discord-activity-updated','update-progress',
  'keyboard-shortcuts','keyboard-commands','keyboard-settings','keyboard-home','keyboard-launch','clear-logs','network-status'
];

const listeners = new Map();

function safeInvoke(channel, ...args) {
  if (!INVOKE_ALLOWED.includes(channel)) {
    console.warn('[preload] invoke blocked for channel:', channel);
    return Promise.reject(new Error('Canal non autorisé'));
  }
  return ipcRenderer.invoke(channel, ...args);
}

function safeSend(channel, ...args) {
  if (!SEND_ALLOWED.includes(channel)) {
    console.warn('[preload] send blocked for channel:', channel);
    return;
  }
  return ipcRenderer.send(channel, ...args);
}

function safeOn(channel, listener) {
  if (!ON_ALLOWED.includes(channel)) {
    console.warn('[preload] on blocked for channel:', channel);
    return;
  }
  const wrapped = (event, ...args) => {
    try { listener({}, ...args); } catch (e) { console.error(e); }
  };
  if (!listeners.has(channel)) listeners.set(channel, new Map());
  listeners.get(channel).set(listener, wrapped);
  ipcRenderer.on(channel, wrapped);
}

function safeRemoveListener(channel, listener) {
  const chMap = listeners.get(channel);
  if (!chMap) return;
  const wrapped = chMap.get(listener);
  if (wrapped) {
    ipcRenderer.removeListener(channel, wrapped);
    chMap.delete(listener);
  }
  if (chMap.size === 0) listeners.delete(channel);
}

function safeOnce(channel, listener) {
  if (!ON_ALLOWED.includes(channel)) {
    console.warn('[preload] once blocked for channel:', channel);
    return;
  }
  const wrapped = (event, ...args) => {
    try { listener({}, ...args); } catch (e) { console.error(e); }
  };
  ipcRenderer.once(channel, wrapped);
}

function safeRemoveAllListeners(channel) {
  ipcRenderer.removeAllListeners(channel);
  listeners.delete(channel);
}

// Préparer l'API sécurisée à exposer au renderer
const electronApi = {
  ipcRenderer: {
    invoke: safeInvoke,
    send: safeSend,
    on: safeOn,
    once: safeOnce,
    removeListener: safeRemoveListener,
    removeAllListeners: safeRemoveAllListeners
  },
  shell: {
    openExternal: (url) => shell.openExternal(url)
  }
};

// Essayer d'exposer via contextBridge (si disponible). Si cela échoue ou
// si le renderer n'a pas accès à l'objet exposé, attacher un fallback
// directement sur la portée globale (window/globalThis), utile en dev.
try {
  // contextBridge.exposeInMainWorld n'est disponible que quand contextIsolation=true
  // Vérifier que contextIsolation est activé avant d'essayer
  if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
    try {
      contextBridge.exposeInMainWorld('electron', electronApi);
    } catch (e) {
      // contextIsolation=false, skip contextBridge
      if (!/contextIsolation/.test(e?.message || '')) {
        console.warn('[preload] contextBridge.exposeInMainWorld failed:', e && e.message);
      }
    }
  }
} catch (e) {
  // ignore
}

try {
  // Dans certains modes (contextIsolation=false), l'exposition via
  // contextBridge peut ne pas rendre l'objet accessible au script de
  // la page. Fournir un fallback en attachant directement à window.
  if (typeof window !== 'undefined') {
    try { window.electron = electronApi; } catch (_) { /* ignore */ }
  }
  if (typeof globalThis !== 'undefined') {
    try { globalThis.electron = electronApi; } catch (_) { /* ignore */ }
  }
  if (typeof global !== 'undefined') {
    try { global.electron = electronApi; } catch (_) { /* ignore */ }
  }
} catch (e) {
  console.warn('[preload] attach electronApi to global/window failed:', e && e.message);
}

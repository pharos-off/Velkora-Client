const { app, BrowserWindow, ipcMain, dialog, shell, session, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require("child_process");
const MinecraftLauncher = require('./minecraft-launcher');
const MicrosoftAuth = require('./microsoft-auth');
const DiscordPresence = require('./discord-rpc');
const setupDiscordHandlers = require('./discord-handler');
const LauncherVersion = require('./launcher-version.js');
const { setSettingsWindow, updateDiscordReference } = require('./discord-handler');
const SecurityManager = require('./security-manager');
const ElectronSecurity = require('./electron-security');
const NetworkManager = require('./network-manager');
const CacheManager = require('./cache-manager');
let _msAuthInstance = null;

const si = require('systeminformation');
const fetch = require('node-fetch');
const mc = require('minecraft-protocol');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

// ✅ Initialiser les gestionnaires de sécurité et de performance
const electronSecurity = new ElectronSecurity();
const networkManager = new NetworkManager({
  timeout: 30000,
  retryAttempts: 3,
  cache: { maxSize: 100, defaultTTL: 5 * 60 * 1000 }
});


const LAUNCHER_VERSION = '4.3.2';
const LAUNCHER_BUILD = '20260620';
const LAUNCHER_NAME = 'Velkora Client';
function getAssetPath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', ...segments);
  }

  return path.join(__dirname, '../../assets', ...segments);
}

function getIconPath() {
  return getAssetPath('icon.ico');
}

const __emojiMap = {
  '✅': '[OK]',
  '❌': '[ERR]',
  '⚠️': '[WARN]',
  '⚠': '[WARN]',
  '⏳': '[WAIT]',
  '🔗': '[LINK]',
  '🔌': '[DISC]',
  '🔧': '[CFG]',
  '📡': '[NET]',
  '🔄': '[RETRY]',
  '🧪': '[TEST]',
  '📦': '[PKG]',
  '📥': '[DL]',
  '🏠': '[HOME]',
  '🎮': '[PLAY]',
  '🌐': '[NET]',
  '👤': '[USER]',
  '🧹': '[CLEAN]',
  '⏱️': '[TIME]',
  '🚀': '[LAUNCH]',
  '✓': '[OK]'
};

let apiProcess = null;

function startApiServer() {
  const serverPath = path.join(__dirname, "../../server.js");

  // ✅ Vérifier que le fichier exists avant de lancer
  if (!fs.existsSync(serverPath)) {
    console.warn('[API] Fichier server.js non trouvé:', serverPath);
    return;
  }

  apiProcess = spawn("node", [serverPath], {
    shell: true,
    stdio: "inherit"
  });

  apiProcess.on("error", (err) => {
    console.error("[API] Erreur lancement:", err);
  });

  console.log("[API] Backend lancé");
}

function __sanitizeText(t) {
  if (typeof t !== 'string') return t;
  let out = t;
  for (const k in __emojiMap) {
    if (out.includes(k)) out = out.split(k).join(__emojiMap[k]);
  }
  return out;
}
const __origConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};
console.log = (...args) => __origConsole.log.apply(console, args.map(__sanitizeText));
console.info = (...args) => __origConsole.info.apply(console, args.map(__sanitizeText));
console.warn = (...args) => __origConsole.warn.apply(console, args.map(__sanitizeText));
console.error = (...args) => __origConsole.error.apply(console, args.map(__sanitizeText));
console.log(`🚀 ${LAUNCHER_NAME} v${LAUNCHER_VERSION} (Build ${LAUNCHER_BUILD})`);

// Chemins pour les mods
function getGameDir() {
  const settings = store.get('settings', {});
  const defaultPath = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
  return settings.gameDirectory || defaultPath;
}

function getModsDir() {
  const gameDir = getGameDir();
  return path.join(gameDir, 'mods');
}

function getResourcePacksDir() {
  const gameDir = getGameDir();
  return path.join(gameDir, 'resourcepacks');
}

function getShadersDir() {
  const gameDir = getGameDir();
  return path.join(gameDir, 'shaderpacks');
}

let MODS_DB_FILE = null;

function getModsDbFile() {
  if (!MODS_DB_FILE) {
    MODS_DB_FILE = path.join(app.getPath('userData'), 'mods.json');
  }
  return MODS_DB_FILE;
}

// Initialization will be done in app.on('ready')
// app.setAsDefaultProtocolClient('minecraft');

// S'assurer que le dossier mods existe
function initModsDirectory() {
  try {
    const modsDir = getModsDir();
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
      console.log('📁 Mods folder created:', modsDir);
    }
  } catch (error) {
    console.error('Error creating mods folder:', error);
  }
}

function initResourcePacksDirectory() {
  try {
    const resourcePacksDir = getResourcePacksDir();
    if (!fs.existsSync(resourcePacksDir)) {
      fs.mkdirSync(resourcePacksDir, { recursive: true });
      console.log('📁 Resourcepacks folder created:', resourcePacksDir);
    }
  } catch (error) {
    console.error('Error creating resourcepacks folder:', error);
  }
}

function initShadersDirectory() {
  try {
    const shadersDir = getShadersDir();
    if (!fs.existsSync(shadersDir)) {
      fs.mkdirSync(shadersDir, { recursive: true });
      console.log('📁 Shaderpacks folder created:', shadersDir);
    }
  } catch (error) {
    console.error('Error creating shaderpacks folder:', error);
  }
}

// ✅ CLEANUP OLD SETUP FILES FROM TEMP DIRECTORY
function cleanupOldInstallers() {
  try {
    const tempDir = os.tmpdir();
    const files = fs.readdirSync(tempDir);
    
    const setupFiles = files.filter(f => f.startsWith('velkora') && f.endsWith('.exe'));
    
    setupFiles.forEach(file => {
      try {
        const filePath = path.join(tempDir, file);
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up old installer: ${file}`);
      } catch (err) {
        // Silently fail if file is locked or doesn't exist
        if (err.code !== 'EBUSY' && err.code !== 'ENOENT') {
          console.warn(`Could not delete ${file}:`, err.code);
        }
      }
    });
  } catch (error) {
    console.warn('⚠️ Cleanup of old installers failed:', error.message);
  }
}

// ✅ LIMITER LA CONCURRENCE HTTP/HTTPS (Windows compatible)
const http = require('http');
const https = require('https');
http.globalAgent.maxSockets = 5;
https.globalAgent.maxSockets = 5;

// ✅ INTERCEPTER child_process POUR CACHER LA CONSOLE JAVA
const childProcess = require('child_process');
const { icons } = require('../renderer/lucide-icons');
const originalSpawn = childProcess.spawn;

// (No global child_process wrappers — keep defaults)

const store = new Store();
console.log('📋 [INIT] Electron Store path:', store.path);
let mainWindow;
let loadingWindow = null;
let settingsWindow = null;
let logsWindow = null;
let discordRPC = null;
let launcher = null;
let _discordCleaned = false;
let minecraftRunning = false;
let lastLaunchAttempt = 0;
let lastGameClosedAt = 0;
let tokenRefreshInterval = null;
// Ignorer certaines erreurs bénignes lors de l’extinction (race Discord RPC)
process.on('uncaughtException', (err) => {
  try {
    if (err && (err.code === 'ERR_STREAM_WRITE_AFTER_END' || /write after end/i.test(err.message || ''))) {
      console.warn('Ignored shutdown error:', err.message || err);
      return;
    }
  } catch (_) {}

  try {
    console.error('Uncaught Exception:', err && (err.stack || err.message || err));
  } catch (_) {}

  try {
    if (logsWindow && !logsWindow.isDestroyed() && logsWindow.webContents) {
      const msg = String((err && (err.stack || err.message)) || err);
      logsWindow.webContents.send('add-log', { type: 'error', message: `UncaughtException: ${msg}` });
    }
  } catch (_) {}

  // Ne pas ré-émettre l'erreur pour éviter de quitter l'application.
  // Laisser le processus continuer et reporter l'erreur dans la fenêtre de logs.
});

// Catch unhandled promise rejections and forward to logs instead of crashing
process.on('unhandledRejection', (reason, promise) => {
  try {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  } catch (_) {}
  try {
    if (logsWindow && !logsWindow.isDestroyed() && logsWindow.webContents) {
      const msg = String(reason && (reason.stack || reason.message) || reason);
      logsWindow.webContents.send('add-log', { type: 'error', message: `UnhandledRejection: ${msg}` });
    }
  } catch (_) {}
});
const LAUNCH_COOLDOWN = 1000;
let modsLoadedCount = 0;
let currentLogs = [];

// ✅ Discord handlers will be registered in app.on('ready')
// updateDiscordReference(discordRPC);
// setupDiscordHandlers(null, store, null);

// ✅ APP USER MODEL ID (icône correcte lors de l’épinglage dans la barre des tâches)
try {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.velkora-client.app');
  }
} catch (_) {}

// ✅ DÉMARRAGE AUTOMATIQUE WINDOWS (RUN REGISTRY)
ipcMain.handle('get-startup-enabled', async () => {
  try {
    const s = app.getLoginItemSettings();
    return !!s.openAtLogin;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('set-startup-enabled', async (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      path: process.execPath,
    });
    const settings = store.get('settings', {});
    settings.startupOnBoot = !!enabled;
    store.set('settings', settings);
    return { success: true, enabled: !!enabled };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

// ✅ IPC HANDLER POUR AFFICHER LA FENÊTRE PRINCIPALE ET FERMER LE LOADING SCREEN
ipcMain.handle('show-main-window', async () => {
  try {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

function createWindow() {
  const iconPath = path.resolve(getIconPath());
  
  const windowOptions = {
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#0f172a',
    show: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  // Charger l'icône avec nativeImage si elle existe
  if (fs.existsSync(iconPath)) {
    try {
      windowOptions.icon = nativeImage.createFromPath(iconPath);
    } catch (e) {
      console.warn('Erreur chargement icône:', e);
    }
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // S'assurer que l'icône est définie sur Windows (taskbar)
  if (process.platform === 'win32' && fs.existsSync(iconPath)) {
    try {
      mainWindow.setIcon(nativeImage.createFromPath(iconPath));
    } catch (e) {
      console.warn('Erreur setIcon:', e);
    }
  }

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.some(arg => arg === '--dev' || arg === 'dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle renderer crashes/unresponsive states and attempt graceful recovery
  try {
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('Renderer process gone:', details);
      addLog('Renderer process gone: ' + (details && details.reason ? details.reason : JSON.stringify(details)), 'error');
      try { if (!mainWindow.isDestroyed()) mainWindow.reload(); } catch (_) {}
    });

    mainWindow.webContents.on('crashed', (event) => {
      console.error('Renderer crashed:', event);
      addLog('Renderer crashed — reloading', 'error');
      try { if (!mainWindow.isDestroyed()) mainWindow.reload(); } catch (_) {}
    });

    mainWindow.on('unresponsive', () => {
      console.warn('Main window unresponsive — reloading');
      addLog('Main window unresponsive — attempting reload', 'warning');
      try { if (!mainWindow.isDestroyed()) mainWindow.reload(); } catch (_) {}
    });
  } catch (_) {}

  mainWindow.on('closed', () => {    
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const iconPath = path.resolve(getIconPath());

  const windowOptions = {
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f172a',
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  // Charger l'icône avec nativeImage si elle existe
  if (fs.existsSync(iconPath)) {
    try {
      windowOptions.icon = nativeImage.createFromPath(iconPath);
    } catch (e) {
      console.warn('Erreur chargement icône settings:', e);
    }
  }

  settingsWindow = new BrowserWindow(windowOptions);

  // Mettre à jour la référence dans discord-handler
  setSettingsWindow(settingsWindow);

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  // Ouvrir DevTools en mode dev
  if (process.argv.some(arg => arg === '--dev' || arg === 'dev')) {
    settingsWindow.webContents.openDevTools();
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ✅ FENÊTRE DE LOGS
function createLogsWindow() {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.focus();
    return;
  }

  const iconPath = path.resolve(getIconPath());

  const windowOptions = {
    width: 950,
    height: 600,
    minWidth: 700,
    minHeight: 400,
    frame: false,
    backgroundColor: '#0a0e27',
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  // Charger l'icône avec nativeImage si elle existe
  if (fs.existsSync(iconPath)) {
    try {
      windowOptions.icon = nativeImage.createFromPath(iconPath);
    } catch (e) {
      console.warn('Erreur chargement icône logs:', e);
    }
  }

  logsWindow = new BrowserWindow(windowOptions);

  // Ouvrir DevTools en mode dev
  if (process.argv.some(arg => arg === '--dev' || arg === 'dev')) {
    setTimeout(() => {
      if (logsWindow && !logsWindow.isDestroyed()) {
        logsWindow.webContents.openDevTools();
      }
    }, 1000);
  }

  // Créer l'HTML de la fenêtre des logs
  const logsHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Logs Minecraft</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background: #0a0e27;
          color: #e2e8f0;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .logs-header {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          border-bottom: 1px solid rgba(99, 102, 241, 0.3);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
        }

        .logs-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logs-title {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .logs-search {
          flex: 1;
          max-width: 300px;
        }

        .logs-search input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 6px;
          color: #e2e8f0;
          font-size: 12px;
          font-family: inherit;
        }

        .logs-search input::placeholder {
          color: #64748b;
        }

        .logs-search input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(30, 41, 59, 0.8);
        }

        .logs-buttons {
          display: flex;
          gap: 8px;
        }

        .logs-btn {
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          color: #cbd5e1;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
          text-align: center;
          white-space: nowrap;
        }

        .logs-btn:hover {
          background: rgba(99, 102, 241, 0.3);
          border-color: rgba(99, 102, 241, 0.5);
          color: #e2e8f0;
        }

        .logs-container {
          flex: 1;
          overflow-y: auto;
          background: #0a0e27;
          padding: 12px 16px;
        }

        .log-line {
          padding: 2px 0;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-all;
          font-size: 11px;
        }

        .log-line.info {
          color: #cbd5e1;
        }

        .log-line.success {
          color: #10b981;
        }

        .log-line.warning {
          color: #f59e0b;
        }

        .log-line.error {
          color: #ef4444;
        }

        .log-line.debug {
          color: #8b5cf6;
        }

        .logs-empty {
          text-align: center;
          color: #64748b;
          padding-top: 40px;
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.5);
        }

        .titlebar {
          height: 40px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 30, 50, 0.9) 100%);
          border-bottom: 1px solid rgba(99, 102, 241, 0.15);
          display: flex;
          align-items: center;
          padding: 0 12px;
          -webkit-app-region: drag;
          user-select: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .titlebar-title {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: #cbd5e1;
        }

        .titlebar-buttons {
          display: flex;
          gap: 10px;
          -webkit-app-region: no-drag;
          align-items: center;
        }

        .titlebar-button {
          width: 36px;
          height: 36px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.15);
          color: #cbd5e1;
          cursor: pointer;
          font-size: 14px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          -webkit-app-region: no-drag;
          user-select: none;
        }
        .titlebar-button:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.3);
          color: #f1f5f9;
          transform: translateY(-1px);
        }
        .titlebar-button:active {
          transform: translateY(0);
          background: rgba(99, 102, 241, 0.15);
        }
        .titlebar-button.minimize:hover {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.25);
          color: #4ade80;
        }
        .titlebar-button.maximize:hover {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }
        .titlebar-button.close:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ff6b6b;
        }
        .titlebar-button.close:active {
          background: rgba(239, 68, 68, 0.25);
        }
      </style>
    </head>
    <body>
      <div class="titlebar">
        <div class="titlebar-title">Mission Control / ${LAUNCHER_NAME} with ${os.version}</div>
        <div class="titlebar-buttons">
          <button class="titlebar-button minimize" id="minimize-btn" title="Réduire">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="titlebar-button maximize" id="maximize-btn" title="Agrandir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="titlebar-button close" id="close-btn" title="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="logs-header">
        <div class="logs-header-left">
          <div class="logs-title">📋 Logs de lancement</div>
          <div class="logs-search">
            <input type="text" id="search-input" placeholder="Search logs...">
          </div>
        </div>
        <div class="logs-buttons">
          <button class="logs-btn" id="clear-btn" title=Effacer>${icons.trash}</button>
          <button class="logs-btn" id="copy-btn" title=Copier tout>${icons.clipboard}</button>
        </div>
      </div>

      <div class="logs-container" id="logs-container">
        <div class="logs-empty" style="display:flex; align-items:center; justify-content:center; height:100%; color:#64748b;">No logs found. Launch game to generate some!</div>
      </div>

      <script>
        const { ipcRenderer } = require('electron');

        const logsContainer = document.getElementById('logs-container');
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-btn');
        const copyBtn = document.getElementById('copy-btn');
        const minimizeBtn = document.getElementById('minimize-btn');
        const maximizeBtn = document.getElementById('maximize-btn');
        const closeBtn = document.getElementById('close-btn');
        
        let allLogs = [];
        let filteredLogs = [];

        // Ajouter un log
        ipcRenderer.on('add-log', (event, log) => {
          allLogs.push(log);
          filterLogs();
          scrollToBottom();
        });

        // Remplacer tous les logs
        ipcRenderer.on('set-logs', (event, logs) => {
          allLogs = logs;
          filterLogs();
          scrollToBottom();
        });

        // Recherche
        searchInput.addEventListener('input', () => {
          filterLogs();
        });

        function filterLogs() {
          const query = searchInput.value.toLowerCase();
          if (!query) {
            filteredLogs = [...allLogs];
          } else {
            filteredLogs = allLogs.filter(log => 
              log.message.toLowerCase().includes(query)
            );
          }
          renderLogs();
        }

        function renderLogs() {
          if (filteredLogs.length === 0) {
            logsContainer.innerHTML = '<div class="logs-empty">Aucun log trouvé</div>';
            return;
          }

          logsContainer.innerHTML = filteredLogs.map(log => {
            return \`<div class="log-line \${log.type}">\${log.message}</div>\`;
          }).join('');
        }

        function scrollToBottom() {
          logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        clearBtn.addEventListener('click', () => {
          allLogs = [];
          filteredLogs = [];
          renderLogs();
          ipcRenderer.send('clear-logs');
        });

        copyBtn.addEventListener('click', () => {
          const text = filteredLogs.map(log => log.message).join('\\n');
          require('electron').clipboard.writeText(text);
          copyBtn.textContent = '✓ Copié !';
          setTimeout(() => copyBtn.textContent = '📋 Copier tout', 2000);
        });

        minimizeBtn.addEventListener('click', () => {
          ipcRenderer.send('minimize-logs-window');
        });

        maximizeBtn.addEventListener('click', () => {
          ipcRenderer.send('maximize-logs-window');
        });

        closeBtn.addEventListener('click', () => {
          ipcRenderer.send('close-logs-window');
        });
      </script>
    </body>
    </html>
  `;

  // Charger l'HTML personnalisé
  logsWindow.webContents.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(logsHTML));

  logsWindow.on('closed', () => {
    logsWindow = null;
  });
}

// ✅ TRAY (ZONE DE NOTIFICATION WINDOWS)
let tray = null;
function createTray() {
  try {
    if (tray) return;
    const { Tray, Menu } = require('electron');
    const iconPath = getIconPath();
    tray = new Tray(iconPath);
    tray.setToolTip(LAUNCHER_NAME || 'VellkoraMC');
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ouvrir',
        click: () => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            } else {
              createWindow();
            }
          } catch (_) {}
        }
      },
      {
        label: 'Masquer',
        click: () => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide(); } catch (_) {} }
      },
      { type: 'separator' },
      {
        label: 'Recharger',
        click: () => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload(); } catch (_) {} }
      },
      { type: 'separator' },
      {
        label: 'Déconnecter Discord',
        click: async () => { 
          try { 
            if (discordRPC) {
              await discordRPC.setEnabled(false);
            }
          } catch (_) {} 
        }
      },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: async () => {
          try {
            if (discordRPC && !_discordCleaned) {
              _discordCleaned = true;
              await discordRPC.destroy();
              await new Promise(r => setTimeout(r, 200));
            }
          } catch (_) {}
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      } catch (_) {}
    });
  } catch (e) {
    console.error('Tray error:', e?.message || e);
  }
}

// ✅ DÉMARRER LE TIMER DE RENOUVELLEMENT AUTOMATIQUE DU TOKEN
function startTokenRefreshTimer() {
  // Rafraîchir le token toutes les 8 heures pour éviter les déconnexions 24h
  // (Microsoft tokens expirent après ~24h, donc 8h offre un margin confortable)
  tokenRefreshInterval = setInterval(async () => {
    try {
      const authData = store.get('authData');
      if (authData && _msAuthInstance) {
        const isValid = await _msAuthInstance.ensureValidToken();
        if (isValid) {
          console.log('✅ Token auto-refreshed successfully');
        } else {
          console.warn('⚠️ Token auto-refresh failed');
        }
      }
    } catch (error) {
      console.warn('⚠️ Token refresh timer error:', error.message);
    }
  }, 8 * 60 * 60 * 1000); // 8 heures
}

function stopTokenRefreshTimer() {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
}

// AJOUTER AVANT app.whenReady():

// ✅ NETTOYER LE CACHE ELECTRON AU DÉMARRAGE POUR ÉVITER LES ERREURS D'ACCÈS
app.on('ready', () => {
  try {
    // Initialize protocol handler
    app.setAsDefaultProtocolClient('minecraft');
    
    // Initialize Discord handlers
    updateDiscordReference(discordRPC);
    setupDiscordHandlers(null, store, null);
    console.log('✅ Discord IPC handlers registered');
    
    // Clean up old installer files
    cleanupOldInstallers();
    
    session.defaultSession.clearCache().catch(() => {});
    session.defaultSession.clearStorageData().catch(() => {});
  } catch (e) {
    console.log('Cache cleanup (non-critical):', e?.message);
  }
});

ipcMain.on('settings-updated', (event, settings) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settings);
  }
});
/*
// ✅ ENVOYER LE CHEMIN DES ASSETS POUR LA MUSIQUE (HORS DE app.asar)
ipcMain.handle('get-assets-path', async () => {
  // Utiliser process.resourcesPath qui pointe vers le dossier resources/
  // Les extraResources (music/) y sont extraits automatiquement
  let musicPath;
  
  if (app.isPackaged) {
    // Mode production: les musiques sont copiées dans resources/music
    musicPath = path.join(process.resourcesPath, 'assets', 'music');
  } else {
    // Mode développement: les assets sont dans le dossier root
    musicPath = path.join(__dirname, '../../assets/music');
  }
  
  console.log('✅ Music path sent to renderer:', musicPath);
  return musicPath;
});
*/

// ✅ GET LOGO PATH
ipcMain.handle('get-logo-path', async () => {
  const logoPath = getIconPath();
  
  // Convertir en URL file:// valide pour le renderer
  const fileUrl = 'file:///' + logoPath.replace(/\\/g, '/');
  console.log('✅ Logo URL sent to renderer:', fileUrl);
  return fileUrl;
});

// Obtenir les infos du compte
// ✅ NEWSLETTER SUBSCRIPTION
ipcMain.handle('subscribe-newsletter', async (event, { email }) => {
  try {
    const subscribers = store.get('newsletter-subscribers', []);
    if (!subscribers.includes(email)) {
      subscribers.push(email);
      store.set('newsletter-subscribers', subscribers);
    }
    return { success: true, message: 'Subscription successful' };
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('get-account-info', async () => {
  try {
    const authData = store.get('authData', null);
    
    if (!authData) {
      return { success: false, username: null };
    }

    return {
      success: true,
      username: authData.username,
      email: authData.email || authData.username + '@minecraft.net (temporaire pour reconnaitre nos joueurs)',
      uuid: authData.uuid || null,
      type: authData.type || null
    };
  } catch (error) {
    console.error('Error retrieving account:', error);
    return { success: false, error: error.message };
  }
});

async function initializeDiscord() {
  try {
    console.log('🎮 Initializing Discord RPC...');
    
    // Créer l'instance Discord
    discordRPC = new DiscordPresence({
      clientId: '1511773943839588455',
      autoReconnect: false,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10
    });

    // Charger les paramètres
    discordRPC.updateRPCSettings({
      showStatus: store.get('discord.showStatus', true),
      showDetails: store.get('discord.showDetails', true),
      showImage: store.get('discord.showImage', true)
    });

    // ✅ METTRE À JOUR LA RÉFÉRENCE DISCORD DANS LES HANDLERS
    const { updateDiscordReference } = require('./discord-handler');
    updateDiscordReference(discordRPC);

    // Écouter les événements (géré maintenant dans updateDiscordReference)
    // Mais on garde le setLauncher ici
    discordRPC.on('connected', (user) => {
      console.log('✅ Discord connected:', user.username);
      const authData = store.get('authData');
      if (authData) {
        discordRPC.setLauncher(authData.username || 'Joueur');
      }
    });

    // Se connecter avec retries
    setTimeout(async () => {
      const success = await discordRPC.initializeWithRetry(3, 2000);
      if (success) {
        console.log('✅ Discord RPC initialized successfully');
      } else {
        console.log('⚠️ Discord RPC failed to initialize (Discord may not be running)');
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erreur initialisation Discord:', error);
  }
}

// ==================== APP LIFECYCLE ====================

// Nettoyer Discord à la fermeture
app.on('before-quit', async () => {
  try {
    // ✅ Arrêter le timer de renouvellement du token
    stopTokenRefreshTimer();
    
    if (discordRPC && !_discordCleaned) {
      _discordCleaned = true;
      try { await discordRPC.destroy(); } catch (e) { console.error('Discord destroy error:', e?.message || e); }
    }
  } catch (e) {
    // ignorer toute erreur de fermeture
  }
  if (apiProcess) {
    apiProcess.kill();
    console.log("[API] Backend arrêté");
  }
});

app.on('will-quit', async () => {
  try {
    if (discordRPC && !_discordCleaned) {
      _discordCleaned = true;
      try { 
        await discordRPC.destroy(); 
        await new Promise(r => setTimeout(r, 200));
      } catch (_) {}
    }
  } catch (_) {}
});

app.on('quit', async () => {
  try {
    if (discordRPC && !_discordCleaned) {
      _discordCleaned = true;
      try { await discordRPC.destroy(); } catch (_) {}
    }
  } catch (_) {}
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== EXPORTS (si nécessaire) ====================

// Exporter discordRPC pour l'utiliser ailleurs dans ton app
module.exports = {
  getDiscordRPC: () => discordRPC,
  initializeDiscord
};

// ✅ ÉCOUTER LE SIGNAL DE DÉCONNEXION
ipcMain.on('logout-complete', (event) => {
  const settingsWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getTitle().includes('Paramètres'));
  if (settingsWindow) {
    settingsWindow.close();
  }
  
  // Afficher la fenêtre principale avec la page de login
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
  }
});

// ✅ Dialog de confirmation - AVEC SUPPORT POUR CUSTOM BUTTONS
ipcMain.handle('show-confirm-dialog', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'question',
    title: options.title || 'Confirmation',
    message: options.message || 'Êtes-vous sûr ?',
    buttons: ['Oui', 'Non'],
    defaultId: 0,
    cancelId: 1
  });
  
  return result.response === 0; // true = Oui, false = Non
});

// ✅ HANDLERS POUR LES LOGS
ipcMain.on('clear-logs', () => {
  currentLogs = [];
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('set-logs', []);
  }
});

// Fonction pour ajouter un log et l'envoyer à la fenêtre de logs
function addLog(message, type = 'info') {
  const log = {
    message: message,
    type: type,
    timestamp: new Date().toLocaleTimeString()
  };
  
  currentLogs.push(log);
  
  // Envoyer au logs window s'il est ouvert
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('add-log', log);
  }
}

// Les logs de la fenêtre dédiée n'affichent désormais que les logs Minecraft (via onLog)

app.whenReady().then(async () => {
  // ✅ Configurer l'ID de l'app pour la barre des tâches Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.velkora-client.app');
  }
  
  console.log('📋 [APP STARTUP] Checking for saved auth data...');
  const startupAuthData = store.get('authData');
  console.log('📋 [APP STARTUP] Saved auth data:', startupAuthData ? `${startupAuthData.username} (${startupAuthData.uuid})` : 'NULL');
  
  initModsDirectory();
  
  // ✅ Valider et rafraîchir le token au démarrage si nécessaire
  try {
    const authData = store.get('authData');
    if (authData && _msAuthInstance) {
      console.log('🔐 [APP STARTUP] Validating token...');
      const isValid = await _msAuthInstance.ensureValidToken();
      if (isValid) {
        console.log('✅ [APP STARTUP] Token validated on startup');
      } else {
        console.warn('⚠️ [APP STARTUP] Token validation failed on startup, user may need to re-authenticate');
      }
    } else {
      console.log('📋 [APP STARTUP] No auth data or MicrosoftAuth instance to validate');
    }
  } catch (error) {
    console.warn('⚠️ [APP STARTUP] Startup token validation error:', error.message);
  }
  
  // ✅ Démarrer le timer de renouvellement automatique du token
  startTokenRefreshTimer();

  // Appliquer le démarrage automatique selon les paramètres sauvegardés
  try {
    const saved = store.get('settings', {});
    const startup = !!saved.startupOnBoot;
    app.setLoginItemSettings({ openAtLogin: startup, path: process.execPath });
  } catch (_) {}

  // ✅ Retarder la création de la fenêtre principale pour laisser le loading screen s'afficher
  setTimeout(() => {
    createWindow();
  }, 500);
  
  // Support both legacy `settings.discordRPC` and canonical `discord.rpcEnabled`
  let discordEnabled = store.get('discord.rpcEnabled');
  if (typeof discordEnabled === 'undefined') {
    discordEnabled = store.get('settings.discordRPC', false);
  }
  if (discordEnabled) {
    try {
      if (!discordRPC) {
        await initializeDiscord();
      } else if (!discordRPC.isConnected) {
        await discordRPC.connect();
      }
    } catch (e) {
      console.warn('⚠️ Discord startup skipped:', e && e.message ? e.message : e);
    }
  }
  
  // Créer l'icône de zone de notification (Windows)
  createTray();

  // ✅ VÉRIFIER ET INSTALLER LES MISES À JOUR AUTOMATIQUEMENT
  setTimeout(async () => {
    try {
      const settings = store.get('settings', {});
      const checkUpdateOnStartup = settings.checkUpdateOnStartup !== false;
      const autoUpdate = settings.autoUpdate !== false;
      
      if (!checkUpdateOnStartup) {
        console.log('[v] Auto-update check on startup is disabled');
        return;
      }
      
      console.log('\n[o] Auto checking for updates on startup...');
      
      // Vérifier les mises à jour sans installer automatiquement
      const updateResult = await checkUpdatesWithSettings(autoUpdate);
      
      if (updateResult.hasUpdate) {
        if (autoUpdate) {
          console.log('✅ Automatic update in progress...');
        } else {
          console.log('✅ Update available - notification sent');
        }
      } else {
        console.log('[v] You are up to date');
      }
    } catch (error) {
      console.error('[!] Error checking for updates:', error.message);
    }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // ✅ CLEANUP: Libérer la mémoire
  minecraftRunning = false;
  lastLaunchAttempt = 0;
  
  try {
    if (discordRPC && !_discordCleaned) {
      _discordCleaned = true;
      // Tenter une déconnexion propre
      if (typeof discordRPC.disconnect === 'function') {
        discordRPC.disconnect().catch(() => {});
      }
      // Et détruire pour forcer la fermeture
      if (typeof discordRPC.destroy === 'function') {
        discordRPC.destroy().catch(() => {});
      }
    }
  } catch (_) {}
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Obtenir la RAM système
ipcMain.handle('get-system-ram', async () => {
  try {
    const mem = await si.mem();
    const totalGB = Math.floor(mem.total / (1024 * 1024 * 1024));
    return totalGB;
  } catch (error) {
    return 16;
  }
});

// ✅ OPTIMISATION RAM AUTOMATIQUE
ipcMain.handle('get-optimal-ram', async () => {
  try {
    const info = await si.mem();
    const totalRam = Math.floor(info.total / (1024 ** 3)); // Convert to GB
    const availableRam = Math.floor(info.available / (1024 ** 3));
    
    // Recommandation: 50% de la RAM libre, min 2GB, max (totalRam - 2GB)
    const recommended = Math.min(
      Math.max(Math.floor(availableRam * 0.5), 2),
      totalRam - 2
    );
    
    return {
      total: totalRam,
      available: availableRam,
      recommended: recommended,
      systemRam: info.total,
      freeRam: info.available
    };
  } catch (error) {
    console.error('Erreur optimisation RAM:', error);
    return { total: 16, available: 8, recommended: 4 };
  }
});

// ✅ OBTENIR LA RAM DISPONIBLE
ipcMain.handle('get-available-ram', async () => {
  try {
    const info = await si.mem();
    return Math.floor(info.available / (1024 ** 3));
  } catch (error) {
    return 0;
  }
});

// Authentification Microsoft
ipcMain.handle('login-microsoft', async (event, options = {}) => {
  const { forcePrompt = false } = options || {};

  try {
    console.log('🔐 [login-microsoft] Handler called - forcePrompt:', forcePrompt);
    const savedAuth = store.get('authData', null);
    console.log('🔐 [login-microsoft] Saved auth in store:', savedAuth ? `${savedAuth.username} (${savedAuth.uuid})` : 'NULL');

    if (!forcePrompt && savedAuth && savedAuth.type === 'microsoft') {
      console.log('🔐 [login-microsoft] Found saved Microsoft auth, attempting to use it');
      if (!_msAuthInstance) {
        console.log('🔐 [login-microsoft] Creating new MicrosoftAuth instance');
        _msAuthInstance = new MicrosoftAuth(store);
      }
      _msAuthInstance.tokenCache = savedAuth;

      // Si le token est valide, on évite de re-authentifier
      console.log('🔐 [login-microsoft] Validating token...');
      const currentToken = await _msAuthInstance.ensureValidToken();
      if (currentToken) {
        console.log('✅ [login-microsoft] Token validated successfully');
        const existing = store.get('authData');
        if (existing) {
          existing.accessToken = currentToken;
          console.log('💾 [login-microsoft] Updating accessToken in store');
          store.set('authData', existing);
        }
        
        // 🎮 INITIALISER DISCORD EN ARRIÈRE-PLAN (NON-BLOQUANT)
        const discordEnabled = store.get('discord.rpcEnabled', true);
        if (discordEnabled && !discordRPC) {
          // Ne pas attendre, lancer en arrière-plan
          initializeDiscord().catch(discordError => {
            console.warn('⚠️ Discord initialization failed:', discordError.message);
          });
        }
        
        console.log('✅ [login-microsoft] Returning saved auth data');
        return { success: true, data: store.get('authData') };
      }
      console.log('⚠️ [login-microsoft] Token validation failed, will authenticate');
    }

    console.log('🔐 [login-microsoft] Starting new authentication flow');
    if (!_msAuthInstance) {
      console.log('🔐 [login-microsoft] Creating new MicrosoftAuth instance for new auth');
      _msAuthInstance = new MicrosoftAuth(store);
    }
    const result = await _msAuthInstance.authenticate(forcePrompt);
    
    if (result.success) {
      console.log('✅ [login-microsoft] Authentication successful, saving data');
      console.log('   - username:', result.data.username);
      console.log('   - uuid:', result.data.uuid);
      store.set('authData', result.data);
      console.log('💾 [login-microsoft] authData saved to store');
      
      // 🎮 INITIALISER DISCORD EN ARRIÈRE-PLAN (NON-BLOQUANT)
      const discordEnabled = store.get('discord.rpcEnabled', true);
      if (discordEnabled && !discordRPC) {
        // Ne pas attendre, lancer en arrière-plan
        initializeDiscord().catch(discordError => {
          console.warn('⚠️ Discord initialization failed:', discordError.message);
        });
      }
      
      return result;
    }
    
    console.log('❌ [login-microsoft] Authentication failed');
    return { success: false, error: 'Authentification échouée' };
  } catch (error) {
    console.error('❌ [login-microsoft] Erreur Microsoft Auth:', error);
    return { success: false, error: error.message || 'Erreur de connexion' };
  }
});

// ✅ CACHE POUR LES STATISTIQUES (mise à jour toutes les 5 minutes)
let storageInfoCache = null;
let lastStorageUpdate = 0;
const STORAGE_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

ipcMain.handle('get-storage-info', async () => {
  try {
    const now = Date.now();
    
    // Utiliser le cache si récent
    if (storageInfoCache && (now - lastStorageUpdate) < STORAGE_CACHE_TIME) {
      return storageInfoCache;
    }
    
    const gameDir = getGameDir();
    
    // S'assurer que le dossier game existe
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    return new Promise((resolve) => {
      // ✅ Calculer la taille de manière plus efficace
      const getQuickSize = (dir, maxDepth = 2) => {
        let size = 0;
        const stack = [{ path: dir, depth: 0 }];
        
        while (stack.length > 0) {
          const { path: currentPath, depth } = stack.pop();
          
          if (depth > maxDepth) continue;
          
          try {
            const files = fs.readdirSync(currentPath);
            for (const file of files) {
              try {
                const filePath = path.join(currentPath, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && depth < maxDepth) {
                  stack.push({ path: filePath, depth: depth + 1 });
                } else if (stat.isFile()) {
                  size += stat.size;
                }
              } catch (e) {
                // Ignorer les fichiers non accessibles
              }
            }
          } catch (e) {
            // Ignorer les dossiers non accessibles
          }
        }
        
        return size;
      };
      
      try {
        // Utiliser le calcul rapide en premier
        const usedBytes = getQuickSize(gameDir, 3);
        const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        
        // ✅ Obtenir l'espace disque de manière plus rapide
        si.fsSize().then(diskInfo => {
          try {
            const drive = diskInfo.find(d => {
              try {
                return gameDir.toLowerCase().startsWith(d.mount.toLowerCase());
              } catch (e) {
                return false;
              }
            }) || diskInfo[0];
            
            const totalGB = (drive.size / (1024 * 1024 * 1024)).toFixed(2);
            const freeGB = (drive.available / (1024 * 1024 * 1024)).toFixed(2);
            
            const result = {
              success: true,
              gamePath: gameDir,
              usedGB: parseFloat(usedGB),
              totalGB: parseFloat(totalGB),
              freeGB: parseFloat(freeGB)
            };
            
            // Mettre en cache
            storageInfoCache = result;
            lastStorageUpdate = now;
            
            resolve(result);
          } catch (err) {
            // Retourner le résultat même si fsSize échoue
            const result = {
              success: true,
              gamePath: gameDir,
              usedGB: parseFloat(usedGB),
              totalGB: 0,
              freeGB: 0
            };
            
            storageInfoCache = result;
            lastStorageUpdate = now;
            resolve(result);
          }
        }).catch(err => {
          // Retourner le résultat partiel
          const result = {
            success: true,
            gamePath: gameDir,
            usedGB: parseFloat(usedGB),
            totalGB: 0,
            freeGB: 0
          };
          
          storageInfoCache = result;
          lastStorageUpdate = now;
          resolve(result);
        });
      } catch (err) {
        // En cas d'erreur, retourner un résultat vide
        resolve({
          success: false,
          error: 'Erreur calcul stockage'
        });
      }
    });
  } catch (error) {
    console.error('Error retrieving storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// ✅ OUVRIR LE DOSSIER MINECRAFT
ipcMain.handle('open-minecraft-folder', async () => {
  try {
    const gameDir = getGameDir();
    
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }
    
    await shell.openPath(gameDir);
    return { success: true };
  } catch (error) {
    console.error('Erreur ouverture dossier:', error);
    return { success: false, error: error.message };
  }
});

// ✅ VIDER LE CACHE
ipcMain.handle('clear-minecraft-cache', async () => {
  try {
    const gameDir = getGameDir();
    
    const cacheDirs = [
      path.join(gameDir, 'cache'),
      path.join(gameDir, 'logs'),
      path.join(gameDir, 'crash-reports')
    ];

    let clearedSize = 0;

    for (const cacheDir of cacheDirs) {
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        
        files.forEach(file => {
          const filePath = path.join(cacheDir, file);
          const stat = fs.statSync(filePath);
          clearedSize += stat.size;
          
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        });
      }
    }

    const clearedMB = (clearedSize / (1024 * 1024)).toFixed(2);
    console.log(`✅ Cache cleared: ${clearedMB} MB`);
    
    return {
      success: true,
      message: `Cache supprimé: ${clearedMB} MB`,
      clearedSize: clearedMB
    };
  } catch (error) {
    console.error('Erreur suppression cache:', error);
    return { success: false, error: error.message };
  }
});

function getNotificationSettingsFromStore() {
  const settings = store.get('notificationSettings', {});
  return {
    launchNotif: settings.launchNotif !== false,
    downloadNotif: settings.downloadNotif !== false,
    updateNotif: settings.updateNotif !== false,
    errorNotif: settings.errorNotif !== false,
    sound: settings.sound !== false,
    volume: typeof settings.volume === 'number' ? settings.volume : 50
  };
}

function playNotificationSoundInRenderer(volume = 0.5) {
  try {
    const payload = {
      volume: Math.max(0, Math.min(volume, 1))
    };

    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('play-notification-sound', payload);
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('play-notification-sound', payload);
    }
  } catch (error) {
    console.warn('Unable to send notification sound event:', error);
  }
}

function shouldShowNotification(type, settings = null) {
  const notifSettings = settings || getNotificationSettingsFromStore();
  switch (type) {
    case 'launch': return notifSettings.launchNotif;
    case 'download': return notifSettings.downloadNotif;
    case 'update': return notifSettings.updateNotif;
    case 'error': return notifSettings.errorNotif;
    default: return true;
  }
}

function showNotification(type, title, body, options = {}) {
  try {
    const notifSettings = getNotificationSettingsFromStore();
    if (!shouldShowNotification(type, notifSettings)) {
      return false;
    }

    const { Notification } = require('electron');
    const notif = new Notification({
      title,
      body,
      icon: getIconPath()
    });
    notif.show();

    const shouldPlaySound = options.sound !== undefined ? options.sound : notifSettings.sound;
    const volume = typeof options.volume === 'number' ? options.volume : notifSettings.volume;
    if (shouldPlaySound) {
      playNotificationSoundInRenderer(volume / 100);
    }

    return true;
  } catch (error) {
    console.warn('Notification error:', error);
    return false;
  }
}

// ✅ NOTIFICATIONS - OBTENIR LES PARAMETRES
ipcMain.handle('get-notification-settings', async () => {
  try {
    const notifSettings = store.get('notificationSettings', {});
    return {
      success: true,
      launchNotif: notifSettings.launchNotif !== false,
      downloadNotif: notifSettings.downloadNotif !== false,
      updateNotif: notifSettings.updateNotif !== false,
      errorNotif: notifSettings.errorNotif !== false,
      sound: notifSettings.sound !== false,
      volume: typeof notifSettings.volume === 'number' ? notifSettings.volume : 50
    };
  } catch (error) {
    console.error('Error retrieving notifications:', error);
    return { success: false, error: error.message };
  }
});

// ✅ NOTIFICATIONS - SAUVEGARDER
ipcMain.handle('save-notification-settings', async (event, settings) => {
  try {
    store.set('notificationSettings', settings);
    console.log('✅ Notification settings saved');
    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde notifications:', error);
    return { success: false, error: error.message };
  }
});

// ✅ NOTIFICATIONS - TEST
ipcMain.handle('test-notification', async (event, options = {}) => {
  try {
    const { Notification } = require('electron');
    const sound = options.sound !== undefined ? options.sound : true;
    const volume = typeof options.volume === 'number' ? options.volume : getNotificationSettingsFromStore().volume;

    const notif = new Notification({
      title: 'Test de notification',
      body: `Ceci est un test de notification ${LAUNCHER_NAME}`,
      icon: getIconPath()
    });

    notif.show();
    if (sound) {
      playNotificationSoundInRenderer(volume / 100);
    }

    console.log('✅ Test notification sent');
    return { success: true };
  } catch (error) {
    console.error('Erreur notification test:', error);
    return { success: false, error: error.message };
  }
});

// ✅ NOTIFICATIONS - REINITIALISER
ipcMain.handle('reset-notification-settings', async () => {
  try {
    const defaultSettings = {
      launchNotif: true,
      downloadNotif: true,
      updateNotif: true,
      errorNotif: true,
      sound: true,
      volume: 50
    };
    
    store.set('notificationSettings', defaultSettings);
    console.log('✅ Notification settings reset');
    return { success: true };
  } catch (error) {
    console.error('Error resetting notifications:', error);
    return { success: false, error: error.message };
  }
});

// ✅ HISTORIQUE DE JEU - ENREGISTRER UNE PARTIE
ipcMain.handle('log-game-session', async (event, sessionData) => {
  const sessions = store.get('gameSessions', []);
  
  const newSession = {
    id: Date.now(),
    version: sessionData.version,
    server: sessionData.server || 'Solo',
    username: sessionData.username,
    startTime: new Date(sessionData.startTime).toISOString(),
    endTime: new Date().toISOString(),
    durationMinutes: Math.round((new Date() - new Date(sessionData.startTime)) / 60000)
  };
  
  sessions.unshift(newSession);
  // Garder seulement les 100 dernières sessions
  if (sessions.length > 100) sessions.pop();
  
  store.set('gameSessions', sessions);
  console.log(`✅ Session registered: ${newSession.durationMinutes}min`);
  
  return { success: true };
});

// ✅ OBTENIR L'HISTORIQUE DE JEU
ipcMain.handle('get-game-sessions', async () => {
  return store.get('gameSessions', []);
});

// ✅ OBTENIR LES STATISTIQUES DE JEU
ipcMain.handle('get-game-stats', async () => {
  const sessions = store.get('gameSessions', []);
  
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalPlaytime: 0,
      averageSession: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayed: null,
      favoriteServer: 'Aucun',
      favoriteVersion: 'Aucune',
      favoriteMode: 'Survie',
      weeklyStats: [0, 0, 0, 0, 0, 0, 0],
      weeklySessionCount: 0
    };
  }
  
  const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const serverCounts = {};
  const versionCounts = {};
  const wins = sessions.filter(s => s.won).length;
  
  sessions.forEach(s => {
    serverCounts[s.server] = (serverCounts[s.server] || 0) + 1;
    versionCounts[s.version] = (versionCounts[s.version] || 0) + 1;
  });
  
  const favoriteServer = Object.entries(serverCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aucun';
  const favoriteVersion = Object.entries(versionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aucune';
  
  // Calculer les streaks
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  
  for (const session of sessions.reverse()) {
    if (session.won) {
      tempStreak++;
      currentStreak = tempStreak;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  
  const longestSession = sessions.reduce((max, s) => s.durationMinutes > max ? s.durationMinutes : max, 0);
  const longestSessionFormatted = `${Math.floor(longestSession / 60)}h ${longestSession % 60}min`;
  
  // ✅ CALCULER LES STATISTIQUES HEBDOMADAIRES
  const weeklyStats = [0, 0, 0, 0, 0, 0, 0]; // Lun à Dim (en heures)
  const weeklySessionCount = {};
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  sessions.forEach(session => {
    const sessionDate = new Date(session.startTime);
    
    // Vérifier si la session est dans la semaine dernière
    if (sessionDate >= oneWeekAgo && sessionDate <= now) {
      // Lundi = 1, Dimanche = 0 (convertir en index 0-6 où Lundi = 0)
      let dayIndex = sessionDate.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6; // Dimanche
      
      weeklyStats[dayIndex] += session.durationMinutes / 60; // Convertir en heures
      weeklySessionCount[dayIndex] = (weeklySessionCount[dayIndex] || 0) + 1;
    }
  });
  
  // Arrondir à 1 décimale
  weeklyStats.forEach((_, i) => {
    weeklyStats[i] = Math.round(weeklyStats[i] * 10) / 10;
  });
  
  const totalWeeklySessions = Object.values(weeklySessionCount).reduce((a, b) => a + b, 0);
  
  return {
    totalSessions: sessions.length,
    totalPlaytime: totalMinutes,
    totalPlaytimeFormatted: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min`,
    averageSession: Math.round(totalMinutes / sessions.length),
    wins: wins,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    lastPlayed: sessions[sessions.length - 1]?.startTime || null,
    longestSession: longestSessionFormatted,
    favoriteServer,
    favoriteVersion,
    favoriteMode: 'Survie',
    weeklyStats: weeklyStats,
    weeklySessionCount: totalWeeklySessions
  };
});

// Déconnexion
ipcMain.handle('logout', async () => {
  store.delete('authData');
  try {
    if (discordRPC && typeof discordRPC.clear === 'function') {
      await discordRPC.clear();
    }
  } catch (e) {
    console.warn('⚠️ Discord clear failed during logout:', e && e.message ? e.message : e);
  }
  return { success: true };
});

// Obtenir auth data
ipcMain.handle('get-auth-data', async () => {
  console.log('🔐 [get-auth-data] Handler called');
  let authData = store.get('authData', null);
  console.log('🔐 [get-auth-data] Retrieved from store:', authData ? `${authData.username} (${authData.uuid})` : 'NULL');
  
  if (authData && authData.type !== 'microsoft') {
    console.log('⚠️ [get-auth-data] Auth data is not Microsoft type, deleting');
    store.delete('authData');
    return null;
  }

  if (authData) {
    try {
      console.log('🔐 [get-auth-data] Validating auth token...');
      if (!_msAuthInstance) {
        console.log('🔐 [get-auth-data] Creating new MicrosoftAuth instance');
        _msAuthInstance = new MicrosoftAuth(store);
      }
      _msAuthInstance.tokenCache = authData;

      const validToken = await _msAuthInstance.ensureValidToken();
      if (validToken) {
        console.log('✅ [get-auth-data] Token is valid');
        authData = store.get('authData', authData);
        return authData;
      }

      // ⚠️ Si le token refresh échoue, on garde les données au lieu de les supprimer
      // Cela peut être une erreur réseau temporaire, donc on ne les supprime que lors du lancement du jeu
      console.warn('⚠️ [get-auth-data] Could not refresh token, but keeping saved data for next attempt');
      authData = store.get('authData', authData);
      return authData;
    } catch (error) {
      console.warn('⚠️ [get-auth-data] Error validating stored auth data:', error.message);
      return authData;
    }
  }

  console.log('❌ [get-auth-data] No auth data found');
  return null;
});

function inferProfileLoader(profile = {}) {
  const raw = String(profile.loader || profile.name || '').toLowerCase();
  if (raw.includes('neoforge')) return 'neoforge';
  if (raw.includes('forge')) return 'forge';
  if (raw.includes('fabric')) return 'fabric';
  if (raw.includes('quilt')) return 'quilt';
  return 'vanilla';
}

function normalizeProfiles(profiles = []) {
  return profiles.map(profile => ({
    ...profile,
    loader: profile.loader || inferProfileLoader(profile)
  }));
}

function findMatchingModdedProfile(profiles = [], version, excludedProfileId = null) {
  const targetVersion = String(version || '').trim();
  if (!targetVersion) {
    return null;
  }

  return profiles.find(profile => {
    if (!profile) return false;
    if (excludedProfileId !== null && parseInt(profile.id, 10) === parseInt(excludedProfileId, 10)) {
      return false;
    }

    const profileVersion = String(profile.version || '').trim();
    const profileLoader = String(profile.loader || inferProfileLoader(profile)).toLowerCase();

    return profileVersion === targetVersion && profileLoader !== 'vanilla';
  }) || null;
}

function formatLoaderLabel(loader) {
  const labels = {
    fabric: 'Fabric',
    forge: 'Forge',
    neoforge: 'NeoForge',
    quilt: 'Quilt'
  };

  return labels[String(loader || '').toLowerCase()] || 'Modde';
}

function detectInstalledModdedVersions(gameDirectory) {
  const versionsDir = path.join(gameDirectory, 'versions');
  if (!fs.existsSync(versionsDir)) {
    return [];
  }

  const inspector = new MinecraftLauncher();
  const detectedVersions = [];

  for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const versionId = entry.name;
    const jsonPath = path.join(versionsDir, versionId, `${versionId}.json`);
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const loader = inspector.inferVersionLoader(versionId, versionJson);
      if (loader === 'vanilla') continue;

      const baseVersion = inspector.extractBaseMinecraftVersion(versionId, versionJson);
      if (!baseVersion) continue;

      const stats = fs.statSync(jsonPath);
      detectedVersions.push({
        versionId,
        version: baseVersion,
        loader,
        mtimeMs: stats.mtimeMs
      });
    } catch (error) {
      console.warn(`⚠️ Impossible d'analyser la version moddee ${versionId}: ${error.message}`);
    }
  }

  detectedVersions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return detectedVersions;
}

function syncProfilesWithInstalledVersions(profiles = []) {
  const normalizedProfiles = normalizeProfiles(profiles);
  const installedModdedVersions = detectInstalledModdedVersions(getGameDir());
  const mergedProfiles = [...normalizedProfiles];
  let nextId = mergedProfiles.length > 0
    ? Math.max(...mergedProfiles.map(profile => parseInt(profile.id, 10) || 0)) + 1
    : 1;

  for (const installedVersion of installedModdedVersions) {
    const alreadyExists = mergedProfiles.some(profile => {
      const profileVersion = String(profile.version || '').trim();
      const profileLoader = String(profile.loader || inferProfileLoader(profile)).toLowerCase();
      return profileVersion === installedVersion.version && profileLoader === installedVersion.loader;
    });

    if (alreadyExists) {
      continue;
    }

    mergedProfiles.push({
      id: nextId++,
      name: `${formatLoaderLabel(installedVersion.loader)} ${installedVersion.version}`,
      version: installedVersion.version,
      loader: installedVersion.loader,
      lastPlayed: null,
      createdAt: new Date(installedVersion.mtimeMs || Date.now()).toISOString(),
      source: 'installed-loader',
      versionId: installedVersion.versionId
    });
  }

  return mergedProfiles;
}

// ✅ GESTION COMPLÈTE DES PROFILS
ipcMain.handle('get-profiles', async () => {
  const defaultProfile = {
    id: 1,
    name: 'Principal',
    version: '26.1.2',
    loader: 'vanilla',
    lastPlayed: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  const profiles = syncProfilesWithInstalledVersions(store.get('profiles', [defaultProfile]));
  store.set('profiles', profiles);
  return profiles;
});

// ✅ OBTENIR UN PROFIL PAR ID
ipcMain.handle('get-profile', async (event, profileId) => {
  const profiles = store.get('profiles', [
    {
      id: 1,
      name: 'Principal',
      version: '26.1.2',
      loader: 'vanilla',
      lastPlayed: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }
  ]);
  const normalizedProfiles = syncProfilesWithInstalledVersions(profiles);
  const profile = normalizedProfiles.find(p => p.id === parseInt(profileId));
  
  if (!profile) {
    return null;
  }
  
  store.set('profiles', normalizedProfiles);
  console.log(`✅ Profil obtenu: ${profile.name}`);
  return profile;
});

// ✅ CRÉER UN NOUVEAU PROFIL
ipcMain.handle('create-profile', async (event, profileData) => {
  const profiles = store.get('profiles', []);
  const newId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
  
  const newProfile = {
    id: newId,
    name: profileData.name || `Profil ${newId}`,
    version: profileData.version || '26.1.2',
    loader: profileData.loader || 'vanilla',
    lastPlayed: null,
    createdAt: new Date().toISOString()
  };
  
  profiles.push(newProfile);
  store.set('profiles', profiles);
  console.log(`✅ Profile created: ${newProfile.name}`);
  
  return { success: true, profile: newProfile };
});

// ✅ SUPPRIMER UN PROFIL
ipcMain.handle('delete-profile', async (event, profileId) => {
  const profiles = store.get('profiles', []);
  
  if (profileId === 1) {
    return { success: false, error: 'Impossible de supprimer le profil principal' };
  }
  
  const filtered = profiles.filter(p => p.id !== profileId);
  store.set('profiles', filtered);
  console.log(`✅ Profile deleted: ${profileId}`);
  
  return { success: true };
});

// ✅ DUPLIQUER UN PROFIL
ipcMain.handle('duplicate-profile', async (event, profileId) => {
  const profiles = store.get('profiles', []);
  const profileToDuplicate = profiles.find(p => p.id === profileId);
  
  if (!profileToDuplicate) {
    return { success: false, error: 'Profil non trouvé' };
  }
  
  const newId = Math.max(...profiles.map(p => p.id)) + 1;
  const duplicated = {
    ...profileToDuplicate,
    id: newId,
    name: `${profileToDuplicate.name} (copie)`,
    createdAt: new Date().toISOString()
  };
  
  profiles.push(duplicated);
  store.set('profiles', profiles);
  console.log(`✅ Profile duplicated: ${duplicated.name}`);
  
  return { success: true, profile: duplicated };
});

// ✅ RENOMMER UN PROFIL
ipcMain.handle('rename-profile', async (event, profileId, newName) => {
  const profiles = store.get('profiles', []);
  const profile = profiles.find(p => p.id === profileId);
  
  if (!profile) {
    return { success: false, error: 'Profil non trouvé' };
  }
  
  profile.name = newName;
  store.set('profiles', profiles);
  console.log(`✅ Profile renamed: ${newName}`);
  
  return { success: true, profile };
});

// ✅ MODIFIER JUSTE LA VERSION DU PROFIL
ipcMain.handle('update-profile-version', async (event, version, profileId = 1) => {
  const profiles = store.get('profiles', [
    {
      id: 1,
      name: 'Principal',
      version: '26.1.2',
      loader: 'vanilla',
      ram: 4,
      lastPlayed: new Date().toISOString().split('T')[0]
    }
  ]);
  
  const normalizedProfiles = syncProfilesWithInstalledVersions(profiles);
  const profile = normalizedProfiles.find(p => p.id === parseInt(profileId)) || normalizedProfiles[0];
  profile.version = version;
  const linkedModdedProfile = findMatchingModdedProfile(normalizedProfiles, version, profile.id);
  profile.loader = linkedModdedProfile?.loader || 'vanilla';
  profile.lastPlayed = new Date().toISOString().split('T')[0];
  
  store.set('profiles', normalizedProfiles);
  console.log(`✅ Version updated: ${version}`);
  if (linkedModdedProfile) {
    console.log(`🧩 Profil modde associe au profil principal: ${linkedModdedProfile.name} (${linkedModdedProfile.loader})`);
  } else {
    console.log('ℹ️ Aucun profil modde associe pour cette version, retour en vanilla');
  }
  
  return { success: true, profile };
});

ipcMain.handle('update-profile-loader', async (event, profileId, loader) => {
  const profiles = syncProfilesWithInstalledVersions(store.get('profiles', []));
  const profile = profiles.find(p => p.id === parseInt(profileId));

  if (!profile) {
    return { success: false, error: 'Profil non trouvé' };
  }

  profile.loader = loader || 'vanilla';
  store.set('profiles', profiles);
  console.log(`✅ Loader mis à jour pour ${profile.name}: ${profile.loader}`);

  return { success: true, profile };
});

// Paramètres
ipcMain.handle('get-settings', async () => {
  const defaultGameDir = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
  return store.get('settings', {
    ramAllocation: 4,
    javaPath: 'C:\\Program Files\\Java\\jdk-21.0.10\\bin\\javaw.exe',
    gameDirectory: defaultGameDir,
    discordRPC: false,
    defaultServer: '',
    closeLauncherOnLaunch: false,
    showLogsWindow: true,
    useProtocolConnect: true,
    mcWidth: 1280,
    mcHeight: 720,
    startupOnBoot: false,
    autoUpdate: true,
    checkUpdateOnStartup: true
  });
});

ipcMain.handle('save-settings', async (event, settings) => {
  store.set('settings', settings);
  // Keep discord.rpcEnabled in sync for legacy/other modules
  try {
    if (typeof settings.discordRPC !== 'undefined') {
      store.set('discord.rpcEnabled', !!settings.discordRPC);
    }
  } catch (_) {}
  
  try {
    if (settings.discordRPC !== undefined && discordRPC) {
      await discordRPC.setEnabled(settings.discordRPC);
      if (settings.discordRPC && !discordRPC.isConnected) {
        await discordRPC.connect();
        const authData = store.get('authData');
        if (authData) {
          await discordRPC.setInLauncher(authData.username);
        }
      }
    }
  } catch (e) {
    console.warn('Discord RPC update skipped:', e?.message || e);
  }
  
  // Démarrage automatique Windows
  if (settings.startupOnBoot !== undefined) {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!settings.startupOnBoot,
        path: process.execPath,
      });
    } catch (e) {
      console.warn('Startup setting failed:', e?.message || e);
    }
  }
  
  // ✅ NOTIFIER LA FENÊTRE PRINCIPALE DE LA MISE À JOUR DES SETTINGS
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settings);
  }
  
  return { success: true };
});

// ✅ GET REQUIRED JAVA VERSION FOR MINECRAFT VERSION
ipcMain.handle('get-required-java-version', async (event, mcVersion) => {
  if (!launcher) launcher = new MinecraftLauncher();
  const required = launcher.getRequiredJavaMajor(mcVersion);
  return { requiredVersion: required, mcVersion };
});

// ✅ GET DETECTED JAVA PATH FOR SPECIFIC JAVA VERSION
ipcMain.handle('get-detected-java-path', async (event, javaVersion) => {
  if (!launcher) launcher = new MinecraftLauncher();
  try {
    const javaPath = await launcher.findJavaPath(javaVersion);
    return { path: javaPath, version: javaVersion, found: !!javaPath };
  } catch (error) {
    return { path: null, version: javaVersion, found: false, error: error.message };
  }
});

// ✅ HANDLER LANCER MINECRAFT AVEC VÉRIFICATION AUTH
ipcMain.handle('launch-minecraft', async (event, profile, serverIP) => {
  try {
    console.log('='.repeat(60));
    console.log('🚀 LANCEMENT MINECRAFT');
    console.log('='.repeat(60));
    console.log('Profile:', profile);
    console.log('Server:', serverIP);
    console.log('LauncherVersion:', typeof LauncherVersion !== 'undefined' ? LauncherVersion.version : 'UNDEFINED');
    
    // ✅ VÉRIFICATION 1: LauncherVersion existe
    if (typeof LauncherVersion === 'undefined') {
      console.error('❌ ERREUR CRITIQUE: LauncherVersion non défini');
      return {
        success: false,
        error: 'Erreur de configuration du launcher. Veuillez redémarrer.'
      };
    }

    // ✅ VÉRIFICATION 2: Cooldown entre lancements
    const now = Date.now();
    if (now - lastLaunchAttempt < LAUNCH_COOLDOWN) {
      console.warn('⚠️ Cooldown actif');
      return {
        success: false,
        error: 'Veuillez attendre avant de relancer'
      };
    }
    lastLaunchAttempt = now;

    // ✅ VÉRIFICATION 2b: Empêcher un relancement immédiat juste après la fermeture
    if (lastGameClosedAt && (now - lastGameClosedAt) < 10000) {
      console.warn('⚠️ Lancement empêché: le jeu a été fermé récemment');
      return { success: false, error: 'Le jeu vient d\'être fermé, attendez avant de relancer.' };
    }
    // ✅ VÉRIFICATION 3: Minecraft déjà en cours
    if (minecraftRunning) {
      console.warn('⚠️ Minecraft déjà en cours');
      return {
        success: false,
        error: 'Minecraft est déjà en cours d\'exécution !'
      };
    }

    // ✅ VÉRIFICATION 4: Authentification
    let authData = store.get('authData', null);
    if (!authData) {
      console.error('❌ Pas de données d\'authentification');
      return {
        success: false,
        error: 'Veuillez vous connecter d\'abord'
      };
    }

    if (authData.type !== 'microsoft') {
      store.delete('authData');
      return {
        success: false,
        error: 'Connexion premium requise. Connectez-vous avec Microsoft.'
      };
    }

    // Raffraîchir le token Microsoft si nécessaire
    if (authData.type === 'microsoft') {
      if (!_msAuthInstance) {
        _msAuthInstance = new MicrosoftAuth(store);
      }
      _msAuthInstance.tokenCache = authData;
      const validToken = await _msAuthInstance.ensureValidToken();
      if (!validToken) {
        store.delete('authData');
        console.error('❌ Token Microsoft invalide, reconnectez-vous');
        return {
          success: false,
          error: 'Session expirée, veuillez vous reconnecter.'
        };
      }
      if (authData.accessToken !== validToken) {
        authData.accessToken = validToken;
        store.set('authData', authData);
      }
      authData = store.get('authData', authData);
    }

    console.log('✅ Auth:', authData.type, '-', authData.username);

    const settings = store.get('settings', {});
    const gameDir = getGameDir();

    // ✅ MARQUER COMME EN COURS
    minecraftRunning = true;
    console.log('🎮 Minecraft marqué comme en cours de lancement');

    // ✅ OUVRIR LA FENÊTRE DE LOGS (selon paramètre)
    try {
      const sLogs = settings.showLogsWindow;
      if (sLogs !== false) {
        createLogsWindow();
        currentLogs = [];
        console.log('📋 Fenêtre de logs ouverte');
      } else {
        console.log('ℹ️ Fenêtre de logs désactivée par les paramètres');
      }
    } catch (error) {
      console.warn('⚠️ Impossible d\'ouvrir la fenêtre de logs:', error.message);
    }

    // ✅ INITIALISER LE LAUNCHER
    launcher = new MinecraftLauncher();
    console.log('✅ Launcher initialisé');

    try {
      // ✅ LANCER MINECRAFT
      console.log('🚀 Lancement en cours...');
      
    const sendLog = (type, message) => {
      try {
        if (logsWindow && !logsWindow.isDestroyed()) {
          logsWindow.webContents.send('add-log', { type, message });
        }
      } catch (_) {}
    };
    
      // Notification de connexion en cours si un serveur est ciblé
      try {
        if (serverIP) {
          showNotification('launch', 'Connexion en cours', `Connexion au serveur ${serverIP}…`);
        }
      } catch (_) {}
      
      // Java effectif: si 'java' ou 'java.exe', utiliser javaw par défaut (ou chemin système configuré)
      const DEFAULT_JAVA = 'C:\\Program Files\\Java\\jdk-21.0.10\\bin\\javaw.exe';
      const fs = require('fs');
      let effectiveJava = settings.javaPath;
      if (!effectiveJava || /^java(\.exe)?$/i.test(effectiveJava) || /\\bin\\java\.exe$/i.test(effectiveJava)) {
        if (fs.existsSync(DEFAULT_JAVA)) {
          effectiveJava = DEFAULT_JAVA;
        } else {
          effectiveJava = (effectiveJava || 'javaw').replace(/java\.exe$/i, 'javaw.exe');
        }
        // Force use of javaw to avoid opening a console on Windows
        try {
          effectiveJava = String(effectiveJava).replace(/java\.exe$/i, 'javaw.exe');
          if (/^java$/i.test(effectiveJava)) effectiveJava = 'javaw';
        } catch (_) {}
        console.log('🔧 Effective Java binary for launch:', effectiveJava);
      }
      
      const normalizedProfiles = syncProfilesWithInstalledVersions(store.get('profiles', []));
      const linkedModdedProfile = findMatchingModdedProfile(
        normalizedProfiles,
        profile?.version,
        profile?.id
      );
      const explicitLoader = String(profile?.loader || '').toLowerCase();
      const forceVanillaLaunch = profile?.forceVanillaLaunch === true;
      const effectiveProfile = {
        ...profile,
        loader: forceVanillaLaunch
          ? 'vanilla'
          : (explicitLoader && explicitLoader !== 'vanilla'
            ? explicitLoader
            : (linkedModdedProfile?.loader || 'vanilla'))
      };

      if (linkedModdedProfile && effectiveProfile.loader !== 'vanilla') {
        console.log(`🧩 Profil modde detecte pour le lancement: ${linkedModdedProfile.name} (${effectiveProfile.loader})`);
      }

      const result = await launcher.launch({
        authData: authData,
        version: effectiveProfile.version,
        loader: effectiveProfile.loader || 'vanilla',
        ram: settings.ramAllocation || 4,
        gameDirectory: gameDir,
        javaPath: effectiveJava,
        serverIP: serverIP,
        windowWidth: settings.mcWidth || 1280,
        windowHeight: settings.mcHeight || 720,
        onLog: (type, msg) => {
          const t = (type || 'info').toString();
          sendLog(t, msg);
        },
        onClose: (code) => {
          try {
            // Envoyer un signal au renderer pour indiquer que le jeu a fermé
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('game-closed', { code });
            }
            // Marquer le moment de la fermeture pour éviter un relancement immédiat
            try { lastGameClosedAt = Date.now(); setTimeout(() => { lastGameClosedAt = 0; }, 15000); } catch(_) {}
            if (settings.closeLauncherOnLaunch && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            }
          } catch (_) {}
        },
        onProgress: (progress) => {
          // Envoyer la progression au renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launch-progress', {
              type: progress.type,
              percent: progress.percent,
              message: progress.message
            });
          }
          
          // Log de progression
          console.log(`📊 ${progress.type}: ${progress.percent}%`);
          try {
            // Envoyer aussi dans la fenêtre de logs
            const msg = progress.message || (`[${progress.type}] ${progress.percent}% (${progress.task || ''}/${progress.total || ''})`);
            sendLog('info', msg);
          } catch (_) {}
        }
      });

      if (result.downloadedVersion) {
        showNotification('download', 'Téléchargement terminé', `Minecraft ${result.downloadedVersion} a été téléchargé et va se lancer.`);
      }
      console.log('✅ Résultat lancement:', result);
      
      // Si le client s'est fermé immédiatement avec code non nul, notifier
      if (typeof result.code === 'number' && result.code !== 0) {
        try {
          const { Notification } = require('electron');
          const notif = new Notification({
            title: 'Minecraft s’est fermé',
            body: `Code de sortie: ${result.code}`,
            icon: getIconPath()
          });
          notif.show();
        } catch (_) {}
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('launch-error', `Fermeture immédiate (code ${result.code})`);
        }
      }

      // ✅ METTRE À JOUR DISCORD RPC (avec vérification)
      if (discordRPC && discordRPC.isConnected) {
        try {
          console.log('📡 Mise à jour Discord RPC...');
          await discordRPC.setPlaying(profile.version);
          console.log('✅ Discord RPC mis à jour');
        } catch (error) {
          console.error('⚠️ Erreur Discord RPC:', error.message);
          // Ne pas bloquer le lancement si Discord échoue
        }
      } else {
        console.log('⚠️ Discord RPC non disponible (normal si Discord fermé)');
      }
      
      // ✅ NOTIFICATION: Lancement réussi
      showNotification('launch', 'Minecraft lancé', serverIP ? `Connexion à ${serverIP}` : 'Bon jeu !');
      
      console.log('='.repeat(60));
      console.log('✅ LANCEMENT TERMINÉ');
      console.log('='.repeat(60));
      
      // Fermer/masquer le launcher si choisi
      try {
        if (settings.closeLauncherOnLaunch && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
          console.log('🪟 Launcher masqué (paramètre activé)');
        }
      } catch (_) {}
      
      return {
        success: result.success !== false,
        message: result.error ? `Erreur: ${result.error}` : 'Minecraft lancé avec succès !'
      };

    } catch (launchError) {
      console.error('❌ Erreur lors du lancement:', launchError);
      console.error('Stack:', launchError.stack);
      
      // ❌ NOTIFICATION: Erreur de lancement
      showNotification('error', 'Erreur de lancement', launchError.message || 'Une erreur est survenue');
      
      // ✅ Réinitialiser l'état
      minecraftRunning = false;
      
      return {
        success: false,
        error: `Erreur de lancement: ${launchError.message}`
      };
      
    } finally {
      // ✅ Réinitialiser après un délai
      setTimeout(() => {
        console.log('🧹 Nettoyage après lancement');
        minecraftRunning = false;
        
        // Discord RPC: remettre en idle
        if (discordRPC && discordRPC.isConnected) {
          discordRPC.setIdle().catch(err => {
            console.warn('⚠️ Erreur Discord setIdle:', err.message);
          });
        }
        
        // Garbage collection si disponible
        if (global.gc) {
          global.gc();
        }
      }, 5000);
    }

  } catch (error) {
    console.error('='.repeat(60));
    console.error('❌ ERREUR CRITIQUE HANDLER LAUNCH');
    console.error('='.repeat(60));
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(60));
    
    minecraftRunning = false;
    
    return {
      success: false,
      error: `Erreur critique: ${error.message}`
    };
  }
});

// Sélectionner le répertoire du jeu
ipcMain.handle('select-game-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Sélectionner le répertoire Minecraft',
      defaultPath: os.homedir(),
      properties: ['openDirectory']
    });

    if (!result.canceled) {
      const settings = store.get('settings', {});
      settings.gameDirectory = result.filePaths[0];
      store.set('settings', settings);
      console.log('📁 Minecraft directory set:', result.filePaths[0]);
      return { success: true, path: result.filePaths[0] };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error selecting directory:', error);
    return { success: false, error: error.message };
  }
});

// Obtenir les versions
ipcMain.handle('get-versions', async () => {
  if (!launcher) launcher = new MinecraftLauncher();
  return await launcher.getAvailableVersions();
});

// Amis
ipcMain.handle('get-friends', async () => {
  return store.get('friends', []);
});

ipcMain.handle('add-friend', async (event, friend) => {
  const friends = store.get('friends', []);
  
  const exists = friends.find(f => f.username.toLowerCase() === friend.username.toLowerCase());
  if (exists) {
    return { success: false, error: 'Cet ami existe déjà' };
  }
  
  const newFriend = {
    id: Date.now(),
    username: friend.username,
    online: false,
    server: null,
    addedAt: new Date().toISOString()
  };
  
  friends.push(newFriend);
  store.set('friends', friends);
  return { success: true, friends };
});

ipcMain.handle('remove-friend', async (event, friendId) => {
  const friends = store.get('friends', []);
  const filtered = friends.filter(f => f.id !== friendId);
  store.set('friends', filtered);
  return { success: true, friends: filtered };
});

ipcMain.handle('update-friend-status', async (event, friendId, status) => {
  const friends = store.get('friends', []);
  const friend = friends.find(f => f.id === friendId);
  
  if (friend) {
    friend.online = status.online;
    friend.server = status.server || null;
    friend.lastSeen = new Date().toISOString();
    store.set('friends', friends);
  }
  
  return { success: true, friends };
});

ipcMain.handle('check-friends-status', async () => {
  const friends = store.get('friends', []);
  
  const updatedFriends = friends.map(friend => ({
    ...friend,
    online: Math.random() > 0.5,
    lastChecked: new Date().toISOString()
  }));
  
  store.set('friends', updatedFriends);
  return updatedFriends;
});

// Ping serveur
ipcMain.handle('ping-server', async (event, serverAddress) => {
  try {
    const [host, portStr] = serverAddress.split(':');
    const port = parseInt(portStr) || 25565;

    return new Promise((resolve) => {
      mc.ping({ host, port }, (err, result) => {
        if (err) {
          resolve({ online: false, error: err.message });
        } else {
          resolve({
            online: true,
            players: result.players,
            version: result.version,
            description: result.description
          });
        }
      });
    });
  } catch (error) {
    return { online: false, error: error.message };
  }
});

// Tête du joueur
ipcMain.handle('get-player-head', async (event, username) => {
  try {
    const authData = store.get('authData', null);
    const uuid = authData?.uuid;
    
    // Crafatar peut aussi renvoyer une erreur 521 selon le moment, on reste sur Minotar.
    if (uuid && String(uuid).length >= 32) {
      return { success: true, url: `https://minotar.net/avatar/${uuid}/128` };
    }

    if (username) {
      const u = encodeURIComponent(username);
      return { success: true, url: `https://minotar.net/avatar/${u}/128` };
    }
    
    // Fallback: avatar générique
    return { success: true, url: `https://minotar.net/avatar/Steve/128` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ✅ FENÊTRES - OUVRIR PARAMÈTRES AVEC UN ONGLET SPÉCIFIQUE
ipcMain.on('open-settings', (event, options = {}) => {
  createSettingsWindow();
  
  // ✅ ENVOYER L'ONGLET À AFFICHER SI SPÉCIFIÉ
  if (options && options.tab) {
    setTimeout(() => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('navigate-to-tab', options.tab);
      }
    }, 500);
  }
});

// ✅ HANDLER FOR DISCONNECTION FROM SETTINGS
ipcMain.on('logout-from-settings', (event) => {
  console.log('📡 Logout signal received from settings');
  
  // Close settings immediately
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
  
  // Verify that the main window exists and is visible
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    // Send the signal to the main window
    mainWindow.webContents.send('logout-from-settings');
    console.log('✅ Signal sent to main window');
  } else {
    console.error('❌ Main window not found');
  }
});

// ✅ HANDLER LOGOUT - NETTOYER LES DONNÉES
ipcMain.handle('logout-account', async () => {
  try {
    // Delete authentication data
    store.delete('authData');
    store.delete('authToken');
    store.delete('profiles');
    
    // Disconnect Discord RPC if active
    if (discordRPC && discordRPC.isConnected) {
      try {
        await discordRPC.disconnect();
      } catch (e) {
        console.log('[i] Discord already disconnected');
      }
    }
    
    // Fermer la fenêtre des paramètres si elle est ouverte
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
      settingsWindow = null;
    }
    
    // Forcer la fenêtre principale à afficher la page de login
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.webContents.send('logout-from-settings');
    }
    
    console.log('✅ Account disconnected');
    return { success: true };
  } catch (error) {
    console.error('Erreur logout:', error);
    return { success: false, error: error.message };
  }
});

// ✅ REPLACE OLD HANDLER
ipcMain.on('return-to-login', (event) => {
  console.log('📡 Return to login signal received');
  
  // Close settings if they are open
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
  
  // Show and focus the main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('return-to-login');
  }
});

ipcMain.on('minimize-settings-window', () => {
  if (settingsWindow) settingsWindow.minimize();
});

ipcMain.on('maximize-settings-window', () => {
  if (settingsWindow) {
    settingsWindow.isMaximized() ? settingsWindow.unmaximize() : settingsWindow.maximize();
  }
});

ipcMain.on('close-settings-window', () => {
  if (settingsWindow) settingsWindow.close();
});

// ✅ TOGGLE FULLSCREEN
ipcMain.on('toggle-fullscreen', (event, isFullscreen) => {
  if (mainWindow) {
    if (isFullscreen) {
      mainWindow.maximize();
    } else {
      mainWindow.unmaximize();
    }
  }
});

ipcMain.on('theme-updated', (event, themeData = {}) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme-updated', themeData);
  }
});

// ✅ HANDLERS POUR LA FENÊTRE DE LOGS
ipcMain.on('minimize-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) logsWindow.minimize();
});

ipcMain.on('maximize-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.isMaximized() ? logsWindow.unmaximize() : logsWindow.maximize();
  }
});

ipcMain.on('close-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) logsWindow.close();
});

ipcMain.on('open-folder', (event, folderPath) => {
  shell.openPath(folderPath);
});

// ✅ ACTUALITÉS - CHARGER LES NOUVELLES DEPUIS LE FICHIER JSON
ipcMain.handle('get-news', async () => {
  try {
    const newsPath = path.join(__dirname, '../../assets/news.json');
    
    if (!fs.existsSync(newsPath)) {
      console.warn('⚠️ Fichier news.json non trouvé');
      return { success: true, news: [] };
    }
    
    const newsData = fs.readFileSync(newsPath, 'utf-8');
    const news = JSON.parse(newsData);
    
    console.log(`✅ ${news.length} actualités chargées`);
    return { success: true, news };
  } catch (error) {
    console.error('❌ Erreur chargement actualités:', error);
    return { success: false, news: [], error: error.message };
  }
});

// ✅ ACTUALITÉS - OBTENIR LES ACTUALITÉS EN VEDETTE (FEATURED)
ipcMain.handle('get-featured-news', async () => {
  try {
    const newsPath = path.join(__dirname, '../../assets/news.json');
    
    if (!fs.existsSync(newsPath)) {
      return { success: true, news: [] };
    }
    
    const newsData = fs.readFileSync(newsPath, 'utf-8');
    const allNews = JSON.parse(newsData);
    
    // Filtrer les actualités en vedette et limiter à 3
    const featuredNews = allNews
      .filter(n => n.featured)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    
    console.log(`✅ ${featuredNews.length} actualités en vedette trouvées`);
    return { success: true, news: featuredNews };
  } catch (error) {
    console.error('❌ Erreur chargement actualités vedettes:', error);
    return { success: false, news: [], error: error.message };
  }
});

// ✅ ACTUALITÉS - OBTENIR UNE ACTUALITÉ PAR ID
ipcMain.handle('get-news-by-id', async (event, newsId) => {
  try {
    const newsPath = path.join(__dirname, '../../assets/news.json');
    
    if (!fs.existsSync(newsPath)) {
      return { success: false, news: null, error: 'Fichier news non trouvé' };
    }
    
    const newsData = fs.readFileSync(newsPath, 'utf-8');
    const allNews = JSON.parse(newsData);
    
    const news = allNews.find(n => n.id === parseInt(newsId));
    
    if (!news) {
      return { success: false, news: null, error: 'Actualité non trouvée' };
    }
    
    console.log(`✅ Actualité trouvée: ${news.title}`);
    return { success: true, news };
  } catch (error) {
    console.error('❌ Erreur chargement actualité:', error);
    return { success: false, news: null, error: error.message };
  }
});

// ✅ ACTUALITÉS - FILTRER PAR CATÉGORIE
ipcMain.handle('get-news-by-category', async (event, category) => {
  try {
    const newsPath = path.join(__dirname, '../../assets/news.json');
    
    if (!fs.existsSync(newsPath)) {
      return { success: true, news: [] };
    }
    
    const newsData = fs.readFileSync(newsPath, 'utf-8');
    const allNews = JSON.parse(newsData);
    
    const filteredNews = allNews
      .filter(n => n.category === category)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`✅ ${filteredNews.length} actualités trouvées pour la catégorie: ${category}`);
    return { success: true, news: filteredNews };
  } catch (error) {
    console.error('❌ Erreur filtrage actualités:', error);
    return { success: false, news: [], error: error.message };
  }
});

// ✅ ACTUALITÉS - AJOUTER UNE NOUVELLE ACTUALITÉ
ipcMain.handle('add-news', async (event, newsItem) => {
  try {
    const newsPath = path.join(__dirname, '../../assets/news.json');
    
    let news = [];
    if (fs.existsSync(newsPath)) {
      const newsData = fs.readFileSync(newsPath, 'utf-8');
      news = JSON.parse(newsData);
    }
    
    // Créer la nouvelle actualité avec un ID unique
    const newId = news.length > 0 ? Math.max(...news.map(n => n.id)) + 1 : 1;
    const newNews = {
      id: newId,
      title: newsItem.title,
      excerpt: newsItem.excerpt,
      content: newsItem.content,
      date: new Date().toISOString(),
      category: newsItem.category || 'general',
      image: newsItem.image || '',
      featured: newsItem.featured || false
    };
    
    news.unshift(newNews);
    
    // Limiter à 50 actualités max
    if (news.length > 50) {
      news = news.slice(0, 50);
    }
    
    fs.writeFileSync(newsPath, JSON.stringify(news, null, 2));
    
    console.log(`✅ Nouvelle actualité ajoutée: ${newNews.title}`);
    return { success: true, news: newNews };
  } catch (error) {
    console.error('❌ Erreur ajout actualité:', error);
    return { success: false, error: error.message };
  }
});

// ✅ UPDATES - FONCTION POUR EXTRAIRE LA VERSION DU NOM DE RELEASE
function extractVersionFromReleaseName(releaseName) {
  // Cherche un pattern comme "v3.1.57" ou "3.1.57" dans le nom
  const versionRegex = /v?(\d+\.\d+\.\d+)/i;
  const match = releaseName.match(versionRegex);
  return match ? match[1] : null;
}

// ✅ UPDATES - VÉRIFIER ET INSTALLER AUTOMATIQUEMENT
async function checkUpdatesAndInstall() {
  try {
    const pkg = require('../../package.json');
    const currentVersion = pkg.version;
    
    // Récupérer les releases
    const response = await fetch('https://api.github.com/repos/pharos-off/Velkora/releases/', {
      headers: { 'User-Agent': `${LAUNCHER_NAME}/${LAUNCHER_VERSION}` }
    });
    
    if (!response.ok) {
      return { hasUpdate: false, error: 'GitHub API unavailable' };
    }
    
    const releases = await response.json();
    
    // Chercher la dernière release stable
    let latestRelease = null;
    let latestVersion = null;
    
    for (const release of releases) {
      if (!release.draft && !release.prerelease && release.assets && release.assets.length > 0) {
        const version = extractVersionFromReleaseName(release.name);
        if (version) {
          latestRelease = release;
          latestVersion = version;
          break;
        }
      }
    }
    
    if (!latestRelease || !latestVersion) {
      return { hasUpdate: false, error: 'No release found' };
    }
    
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    
    if (!hasUpdate) {
      return { hasUpdate: false };
    }
    
    // New version found! Download and install
    console.log(`\n🎉 New version available: v${latestVersion}`);
    
    const exeAsset = latestRelease.assets.find(a => a.name.endsWith('.exe'));
    if (!exeAsset) {
      return { hasUpdate: true, error: 'No .exe file found' };
    }
    
    const downloadUrl = exeAsset.browser_download_url;
    const fileName = exeAsset.name;
    const updatePath = path.join(os.tmpdir(), fileName);
    
    console.log(`📥 Downloading v${latestVersion}...`);
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      return { hasUpdate: true, error: 'Download failed' };
    }
    
    const buffer = await downloadResponse.buffer();
    fs.writeFileSync(updatePath, buffer);
    
    console.log(`✓ ${fileName} downloaded (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    console.log('🚀 Automatic installation in progress...\n');
    
    // Launch the installer using shell.openPath (proper way on Windows)
    await shell.openPath(updatePath);
    
    // Quit the app after a delay to ensure installer launches
    setTimeout(() => {
      app.quit();
    }, 1000);
    
    return { hasUpdate: true, installed: true };
  } catch (error) {
    console.error('❌ Auto-update error:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

// ✅ UPDATES - CHECK WITH SETTINGS (autoUpdate parameter handling)
async function checkUpdatesWithSettings(autoUpdate = true) {
  try {
    const pkg = require('../../package.json');
    const currentVersion = pkg.version;
    
    // Récupérer les releases
    const response = await fetch('https://api.github.com/repos/pharos-off/Velkora/releases/', {
      headers: { 'User-Agent': `${LAUNCHER_NAME}/${LAUNCHER_VERSION}` }
    });
    
    if (!response.ok) {
      return { hasUpdate: false, error: 'GitHub API unavailable' };
    }
    
    const releases = await response.json();
    
    // Chercher la dernière release stable
    let latestRelease = null;
    let latestVersion = null;
    
    for (const release of releases) {
      if (!release.draft && !release.prerelease && release.assets && release.assets.length > 0) {
        const version = extractVersionFromReleaseName(release.name);
        if (version) {
          latestRelease = release;
          latestVersion = version;
          break;
        }
      }
    }
    
    if (!latestRelease || !latestVersion) {
      return { hasUpdate: false, error: 'No release found' };
    }
    
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    
    if (!hasUpdate) {
      return { hasUpdate: false };
    }
    
    // New version found!
    console.log(`\n🎉 New version available: v${latestVersion}`);
    
    const exeAsset = latestRelease.assets.find(a => a.name.endsWith('.exe'));
    if (!exeAsset) {
      return { hasUpdate: true, error: 'No .exe file found' };
    }
    
    // Si autoUpdate est activé, télécharger et installer
    if (autoUpdate) {
      const downloadUrl = exeAsset.browser_download_url;
      const fileName = exeAsset.name;
      const updatePath = path.join(os.tmpdir(), fileName);
      
      console.log(`📥 Downloading v${latestVersion}...`);
      const downloadResponse = await fetch(downloadUrl);
      
      if (!downloadResponse.ok) {
        return { hasUpdate: true, error: 'Download failed', needsManualInstall: true };
      }
      
      const buffer = await downloadResponse.buffer();
      fs.writeFileSync(updatePath, buffer);
      
      console.log(`✓ ${fileName} downloaded (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
      console.log('🚀 Automatic installation in progress...\n');
      
      // Launch the installer
      await shell.openPath(updatePath);
      
      // Quit the app after a delay
      setTimeout(() => {
        app.quit();
      }, 1000);
      
      return { hasUpdate: true, installed: true };
    } else {
      // Si autoUpdate est désactivé, juste envoyer une notification
      showNotification('update', 'Mise à jour disponible', `Velkora v${latestVersion} est disponible ! Rendez-vous dans les paramètres pour l'installer.`);
      return { hasUpdate: true, installed: false };
    }
  } catch (error) {
    console.error('❌ Check-update error:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

// ✅ UPDATES - STOCKAGE DES DONNÉES DE MISE À JOUR
let latestUpdateData = null;

// ✅ UPDATES - CHECK FOR UPDATES
ipcMain.handle('check-updates', async () => {
  try {
    const pkg = require('../../package.json');
    const currentVersion = pkg.version;
    
    console.log(`[o] Checking for updates (Current: v${currentVersion})...`);
    
    // Récupérer les 5 dernières releases
    const response = await fetch('https://api.github.com/repos/pharos-off/Velkora/releases', {
      headers: { 'User-Agent': LAUNCHER_NAME }
    });
    
    if (!response.ok) {
      console.log('⚠️ Unable to check for updates (GitHub API)');
      return { 
        hasUpdate: false, 
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        error: 'Impossible de contacter GitHub'
      };
    }
    
    const releases = await response.json();
    
    // Chercher la dernière release stable (pas prerelease)
    let latestRelease = null;
    let latestVersion = null;
    
    for (const release of releases) {
      if (!release.draft && !release.prerelease && release.assets && release.assets.length > 0) {
        const version = extractVersionFromReleaseName(release.name);
        if (version) {
          latestRelease = release;
          latestVersion = version;
          break;
        }
      }
    }
    
    if (!latestRelease || !latestVersion) {
      console.log('⚠️ No stable release found');
      return { 
        hasUpdate: false, 
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        error: 'Aucune release trouvée'
      };
    }
    
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    
    // Chercher le fichier .exe
    const exeAsset = latestRelease.assets.find(a => a.name.endsWith('.exe'));
    
    if (!exeAsset) {
      console.log('⚠️ No .exe file found');
      return { 
        hasUpdate: false, 
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        error: 'Fichier d\'installation non trouvé'
      };
    }
    
    // Stocker les données pour l'installation
    latestUpdateData = {
      hasUpdate: hasUpdate,
      currentVersion: currentVersion,
      latestVersion: latestVersion,
      downloadUrl: exeAsset.browser_download_url,
      fileName: exeAsset.name,
      releaseNotes: latestRelease.body,
      releaseName: latestRelease.name
    };
    
    if (hasUpdate) {
      console.log(`✅ New version available: v${latestVersion}`);
      showNotification('update', 'Mise à jour disponible', `Velkora v${latestVersion} est disponible !`);
    } else {
      console.log('[v] You are using the latest version');
    }
    
    return latestUpdateData;
  } catch (error) {
    console.error('❌ Check-updates error:', error);
    return { 
      hasUpdate: false, 
      currentVersion: 'unknown',
      latestVersion: 'unknown',
      error: `Erreur: ${error.message}`
    };
  }
});

// ✅ UPDATES - INSTALL UPDATE
ipcMain.handle('install-update', async () => {
  try {
    if (!latestUpdateData || !latestUpdateData.downloadUrl) {
      console.log('⚠️ No update available');
      return { success: false, error: 'No update found. Check first.' };
    }
    
    console.log(`📥 Downloading v${latestUpdateData.latestVersion}...`);
    const updatePath = path.join(os.tmpdir(), latestUpdateData.fileName);
    
    // Download the update
    const response = await fetch(latestUpdateData.downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    fs.writeFileSync(updatePath, buffer);
    
    console.log(`✓ ${latestUpdateData.fileName} downloaded (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    console.log('🚀 Launching the installer...');
    
    // Launch the installer using shell.openPath (proper way on Windows)
    await shell.openPath(updatePath);
    showNotification('download', 'Téléchargement terminé', `Velkora v${latestUpdateData.latestVersion} a été téléchargé.`);
    
    // Close the app after a delay to ensure installer launches
    setTimeout(() => {
      console.log('🔄 Closing application...');
      app.quit();
    }, 1000);
    
    return { success: true, message: `Installation of v${latestUpdateData.latestVersion} in progress...` };
  } catch (error) {
    console.error('❌ Install-update error:', error);
    latestUpdateData = null;
    return { success: false, error: error.message };
  }
});

// ✅ COMPARE VERSIONS (simple version comparison)
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

ipcMain.on('minimize-window', () => mainWindow.minimize());

// Charger la base de données des mods
function loadModsDB() {
  try {
    const modsDbFile = getModsDbFile();
    if (fs.existsSync(modsDbFile)) {
      const mods = JSON.parse(fs.readFileSync(modsDbFile, 'utf8'));
      return synchronizeModsDB(Array.isArray(mods) ? mods : []);
    } else {
      // Si le fichier DB n'existe pas, scanner le disque pour découvrir les mods
      console.log('📦 Fichier DB n\'existe pas, scan du disque pour découvrir les mods...');
      return synchronizeModsDB([]);
    }
  } catch (error) {
    console.error('Erreur lecture mods DB:', error);
  }
  return synchronizeModsDB([]);
}

// Sauvegarder la base de données des mods
function saveModsDB(mods) {
  try {
    const modsDbFile = getModsDbFile();
    fs.writeFileSync(modsDbFile, JSON.stringify(mods, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde mods DB:', error);
    return false;
  }
}

function normalizeStoredModFileName(fileName) {
  const rawName = String(fileName || '').trim();
  if (!rawName) return '';
  return rawName.endsWith('.disabled')
    ? rawName.slice(0, -'.disabled'.length)
    : rawName;
}

/**
 * ✅ EXTRAIRE L'IMAGE D'UN MOD
 * Cherche le logo du mod dans le JAR et le retourne en base64
 */
async function extractModImage(modPath) {
  try {
    // Vérifier que le fichier existe
    if (!fs.existsSync(modPath)) {
      return null;
    }

    // Si c'est un fichier RAR, on peut pas l'extraire facilement sans dépendance externe
    if (modPath.toLowerCase().endsWith('.rar')) {
      console.log(`[IMG] RAR file detected: ${modPath}, skipping image extraction`);
      return null;
    }

    const zip = new AdmZip(modPath);
    const entries = zip.getEntries();

    // Chercher les fichiers images courants - patterns spécifiques d'abord
    const imagePatterns = [
      /^assets\/.+\/textures\/gui\/icon\.(png|jpg|jpeg)$/i,
      /^assets\/.+\/icon\.(png|jpg|jpeg)$/i,
      /^icon\.(png|jpg|jpeg)$/i,
      /^assets\/icon\.(png|jpg|jpeg)$/i,
      /^logo\.(png|jpg|jpeg)$/i,
      /^modicon\.(png|jpg|jpeg)$/i,
      /^thumbnail\.(png|jpg|jpeg)$/i,
      /^pack\.png$/i,
      /^pack\.jpg$/i,
      /^shaders\/.+\.png$/i,  // Pour les shaders
      /^shaders\/.+\.jpg$/i
    ];

    // Chercher une image correspondant aux patterns
    for (const pattern of imagePatterns) {
      const imageEntry = entries.find(entry => pattern.test(entry.entryName));
      if (imageEntry) {
        const imageBuffer = zip.readFile(imageEntry);
        const ext = imageEntry.entryName.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        console.log(`[IMG] Found image at: ${imageEntry.entryName}`);
        return `data:image/${ext};base64,` + imageBuffer.toString('base64');
      }
    }

    // Fallback: prendre la première image PNG/JPG trouvée n'importe où dans le ZIP
    // Priorité aux images qui ne sont pas trop profondément imbriquées
    const imagesByDepth = entries
      .filter(entry => !entry.isDirectory && /\.(png|jpg|jpeg)$/i.test(entry.entryName.toLowerCase()))
      .sort((a, b) => {
        const depthA = a.entryName.split('/').length;
        const depthB = b.entryName.split('/').length;
        return depthA - depthB;
      });

    if (imagesByDepth.length > 0) {
      const firstImage = imagesByDepth[0];
      const imageBuffer = zip.readFile(firstImage);
      const ext = firstImage.entryName.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      console.log(`[IMG] Found image at (fallback): ${firstImage.entryName}`);
      return `data:image/${ext};base64,` + imageBuffer.toString('base64');
    }

    return null;
  } catch (error) {
    console.warn(`[IMG] Error extracting image from ${modPath}:`, error.message);
    return null;
  }
}

function listModsFromDirectory() {
  const modsDir = getModsDir();
  console.log(`📁 Dossier des mods scannée: ${modsDir}`);
  
  if (!fs.existsSync(modsDir)) {
    console.log(`📁 Dossier n'existe pas, création...`);
    fs.mkdirSync(modsDir, { recursive: true });
  }

  const files = fs.readdirSync(modsDir, { withFileTypes: true });
  const jarFiles = files.filter((entry) => entry.isFile() && /\.(jar|jar\.disabled)$/i.test(entry.name));
  console.log(`📦 Fichiers JAR trouvés: ${jarFiles.length}`);
  
  if (jarFiles.length === 0) {
    console.log(`⚠️ Aucun mod trouvé dans ${modsDir}`);
  }

  return jarFiles
    .map((entry, index) => {
      const actualName = entry.name;
      const fileName = normalizeStoredModFileName(actualName);
      const filePath = path.join(modsDir, actualName);
      const stat = fs.statSync(filePath);

      return {
        id: `fs-${stat.mtimeMs}-${index}-${fileName}`,
        name: fileName.replace(/\.jar$/i, '').replace(/\s*\(\d+\)$/, ''),
        fileName,
        actualFileName: actualName,
        path: filePath,
        size: formatFileSize(stat.size),
        sizeBytes: stat.size,
        enabled: !actualName.endsWith('.disabled'),
        importedAt: stat.mtime.toISOString(),
        image: null // Sera rempli de manière asynchrone
      };
    })
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

function synchronizeModsDB(mods) {
  try {
    const diskMods = listModsFromDirectory();
    const diskModsByFileName = new Map(
      diskMods.map((mod) => [String(mod.fileName || '').toLowerCase(), mod])
    );
    let changed = false;
    const seenFileNames = new Set();
    const normalizedMods = [];

    for (const mod of mods) {
      if (!mod || typeof mod !== 'object') {
        changed = true;
        continue;
      }

      const fallbackName = normalizeStoredModFileName(mod.fileName || path.basename(String(mod.path || '').trim()));
      if (!fallbackName) {
        changed = true;
        continue;
      }

      const fileKey = fallbackName.toLowerCase();
      if (seenFileNames.has(fileKey)) {
        changed = true;
        continue;
      }

      const diskMod = diskModsByFileName.get(fileKey);
      if (!diskMod) {
        changed = true;
        continue;
      }

      seenFileNames.add(fileKey);
      diskModsByFileName.delete(fileKey);

      const nextMod = {
        ...mod,
        fileName: diskMod.fileName,
        path: diskMod.path,
        size: diskMod.size,
        enabled: diskMod.enabled,
        importedAt: mod.importedAt || diskMod.importedAt
      };

      if (!nextMod.name) {
        nextMod.name = diskMod.name;
      }

      const changedFields =
        nextMod.fileName !== mod.fileName ||
        nextMod.path !== mod.path ||
        nextMod.size !== mod.size ||
        nextMod.enabled !== mod.enabled;

      if (changedFields) {
        changed = true;
      }

      normalizedMods.push(nextMod);
    }

    for (const diskMod of diskModsByFileName.values()) {
      changed = true;
      normalizedMods.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: diskMod.name,
        fileName: diskMod.fileName,
        version: 'Detecte automatiquement',
        size: diskMod.size,
        enabled: diskMod.enabled,
        importedAt: diskMod.importedAt,
        path: diskMod.path,
        detectedAutomatically: true
      });
    }

    if (changed) {
      saveModsDB(normalizedMods);
    }

    return normalizedMods;
  } catch (error) {
    console.error('Erreur synchronisation mods DB:', error);
    return mods;
  }
}

// Formater la taille du fichier
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 📥 Récupérer tous les mods installés
ipcMain.handle('get-installed-mods', async () => {
  try {
    const mods = loadModsDB();
    
    // Extraire les images des mods de manière asynchrone
    const modsWithImages = await Promise.all(mods.map(async (mod) => {
      if (!mod.image && mod.path && fs.existsSync(mod.path)) {
        try {
          const image = await extractModImage(mod.path);
          if (image) {
            mod.image = image;
          }
        } catch (error) {
          console.warn(`Erreur extraction image pour ${mod.name}:`, error.message);
        }
      }
      return mod;
    }));
    
    return modsWithImages;
  } catch (error) {
    console.error('Erreur get-installed-mods:', error);
    return [];
  }
});

ipcMain.handle('get-mods-folder', async () => {
  initModsDirectory();
  return getModsDir();
});

ipcMain.handle('get-resourcepacks-folder', async () => {
  initResourcePacksDirectory();
  return getResourcePacksDir();
});

// ✅ SCREENSHOTS & SAVES HANDLERS
ipcMain.handle('get-screenshots-folder', async () => {
  const folder = path.join(getGameDir(), 'screenshots');
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    return folder;
  } catch (error) {
    console.error('Erreur get-screenshots-folder:', error);
    return '';
  }
});

ipcMain.handle('get-screenshots-count', async () => {
  try {
    const folder = path.join(getGameDir(), 'screenshots');
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      return { count: 0, folder };
    }
    const files = fs.readdirSync(folder).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    return { count: files.length, folder };
  } catch (error) {
    console.error('Erreur get-screenshots-count:', error);
    return { count: 0, folder: '' };
  }
});

ipcMain.handle('get-saves-folder', async () => {
  const folder = path.join(getGameDir(), 'saves');
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    return folder;
  } catch (error) {
    console.error('Erreur get-saves-folder:', error);
    return '';
  }
});

ipcMain.handle('get-saves-count', async () => {
  try {
    const folder = path.join(getGameDir(), 'saves');
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      return { count: 0, folder };
    }
    const worlds = fs.readdirSync(folder).filter(f => {
      const stat = fs.statSync(path.join(folder, f));
      return stat.isDirectory();
    });
    return { count: worlds.length, folder };
  } catch (error) {
    console.error('Erreur get-saves-count:', error);
    return { count: 0, folder: '' };
  }
});

ipcMain.handle('get-screenshots-list', async () => {
  try {
    const folder = path.join(getGameDir(), 'screenshots');
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      return [];
    }
    const files = fs.readdirSync(folder)
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(folder, a));
        const statB = fs.statSync(path.join(folder, b));
        return statB.mtime - statA.mtime; // Most recent first
      })
      .map(f => ({
        name: f,
        path: path.join(folder, f),
        url: `file://${path.join(folder, f).replace(/\\/g, '/')}`
      }));
    return files;
  } catch (error) {
    console.error('Erreur get-screenshots-list:', error);
    return [];
  }
});

function getDirectorySize(targetPath) {
  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return stat.size;
    }

    return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((total, entry) => {
      const entryPath = path.join(targetPath, entry.name);
      return total + getDirectorySize(entryPath);
    }, 0);
  } catch (error) {
    return 0;
  }
}

function listInstalledResourcePacks() {
  initResourcePacksDirectory();
  const resourcePacksDir = getResourcePacksDir();
  const supportedExtensions = new Set(['.zip', '.mcpack']);

  return fs.readdirSync(resourcePacksDir, { withFileTypes: true })
    .filter((entry) => {
      if (entry.name.startsWith('.')) return false;
      if (entry.isDirectory()) return true;
      return supportedExtensions.has(path.extname(entry.name).toLowerCase());
    })
    .map((entry, index) => {
      const filePath = path.join(resourcePacksDir, entry.name);
      const stat = fs.statSync(filePath);
      const sizeBytes = entry.isDirectory() ? getDirectorySize(filePath) : stat.size;
      const fileName = entry.name;

      return {
        id: `${stat.mtimeMs}-${index}-${fileName}`,
        name: entry.isDirectory() ? fileName : fileName.replace(path.extname(fileName), ''),
        fileName,
        path: filePath,
        size: formatFileSize(sizeBytes),
        sizeBytes,
        importedAt: stat.mtime.toISOString(),
        type: entry.isDirectory() ? 'folder' : 'archive'
      };
    })
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

ipcMain.handle('get-installed-resourcepacks', async () => {
  try {
    initResourcePacksDirectory();
    const resourcePacksDir = getResourcePacksDir();
    const supportedExtensions = new Set(['.zip', '.mcpack']);

    const entries = fs.readdirSync(resourcePacksDir, { withFileTypes: true })
      .filter((entry) => {
        if (entry.name.startsWith('.')) return false;
        if (entry.isDirectory()) return true;
        return supportedExtensions.has(path.extname(entry.name).toLowerCase());
      })
      .map((entry, index) => {
        const filePath = path.join(resourcePacksDir, entry.name);
        const stat = fs.statSync(filePath);
        const sizeBytes = entry.isDirectory() ? getDirectorySize(filePath) : stat.size;
        const fileName = entry.name;

        return {
          id: `${stat.mtimeMs}-${index}-${fileName}`,
          name: entry.isDirectory() ? fileName : fileName.replace(path.extname(fileName), ''),
          fileName,
          path: filePath,
          size: formatFileSize(sizeBytes),
          sizeBytes,
          importedAt: stat.mtime.toISOString(),
          type: entry.isDirectory() ? 'folder' : 'archive'
        };
      })
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());

    // Extraire les images asynchronement (seulement pour les archives, pas les dossiers)
    const packsWithImages = await Promise.all(entries.map(async (pack) => {
      try {
        // Ignorer l'extraction d'image pour les dossiers
        if (pack.type === 'folder') {
          return { ...pack, image: null };
        }
        const image = await extractModImage(pack.path);
        console.log(`[IMG] Resourcepack ${pack.name}: ${image ? 'trouvée' : 'non trouvée'}`);
        return { ...pack, image };
      } catch (error) {
        console.warn(`[IMG] Erreur extraction resourcepack ${pack.name}:`, error.message);
        return { ...pack, image: null };
      }
    }));

    return packsWithImages;
  } catch (error) {
    console.error('Erreur get-installed-resourcepacks:', error);
    return [];
  }
});

function listInstalledShaders() {
  initShadersDirectory();
  const shadersDir = getShadersDir();
  const supportedExtensions = new Set(['.zip', '.rar']);

  return fs.readdirSync(shadersDir, { withFileTypes: true })
    .filter((entry) => {
      if (entry.name.startsWith('.')) return false;
      if (entry.isDirectory()) return true;
      return supportedExtensions.has(path.extname(entry.name).toLowerCase());
    })
    .map((entry, index) => {
      const filePath = path.join(shadersDir, entry.name);
      const stat = fs.statSync(filePath);
      const sizeBytes = entry.isDirectory() ? getDirectorySize(filePath) : stat.size;
      const fileName = entry.name;

      return {
        id: `${stat.mtimeMs}-${index}-${fileName}`,
        name: entry.isDirectory() ? fileName : fileName.replace(path.extname(fileName), ''),
        fileName,
        path: filePath,
        size: formatFileSize(sizeBytes),
        sizeBytes,
        importedAt: stat.mtime.toISOString(),
        type: entry.isDirectory() ? 'folder' : 'archive'
      };
    })
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

ipcMain.handle('delete-resourcepack', async (event, packPath) => {
  try {
    const resourcePacksDir = path.normalize(getResourcePacksDir());
    const normalizedPackPath = path.normalize(String(packPath || '').trim());

    if (!normalizedPackPath || !normalizedPackPath.startsWith(resourcePacksDir)) {
      return { success: false, message: 'Chemin de texture pack invalide' };
    }

    if (!fs.existsSync(normalizedPackPath)) {
      return { success: false, message: 'Texture pack introuvable' };
    }

    const stat = fs.statSync(normalizedPackPath);
    if (stat.isDirectory()) {
      fs.rmSync(normalizedPackPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(normalizedPackPath);
    }

    return { success: true, message: 'Texture pack supprime avec succes' };
  } catch (error) {
    console.error('Erreur delete-resourcepack:', error);
    return { success: false, message: error.message };
  }
});

// Variable globale pour éviter les imports multiples
let importInProgress = false;

// ➕ Import mods (KEEP NAME import-mod)
ipcMain.handle('import-mod', async () => {
  // Avoid multiple calls
  if (importInProgress) {
    console.log('⚠️ Import already in progress, ignored');
    return { success: false, message: 'Un import est déjà en cours' };
  }

  try {
    importInProgress = true;
    const { dialog } = require('electron');
    
    // Create mods folder
    const modsDir = getModsDir();
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner un mod (.jar)',
      filters: [
        { name: 'JAR Files', extensions: ['jar'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Import annulé' };
    }

    const mods = loadModsDB();
    let importedCount = 0;
    const errors = [];

    for (const sourcePath of result.filePaths) {
      const fileName = path.basename(sourcePath);
      console.log(`\n📦 Import: ${fileName}`);

      try {
        const targetPath = path.join(modsDir, fileName);

        // Check if already exists
        if (mods.find(m => m.fileName === fileName)) {
          console.log(`   ⚠ Already exists`);
          continue;
        }

        // Copy the file
        console.log(`   → Copying...`);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`   ✅ Copy successful`);

        // Vérifier que la copie a réussi
        if (!fs.existsSync(targetPath)) {
          errors.push(`${fileName}: Copie échouée`);
          continue;
        }

        // Get the stats of the copied file
        const fileStats = fs.statSync(targetPath);

        // Add to database
        const newMod = {
          id: Date.now() + importedCount,
          name: fileName.replace('.jar', '').replace(/\s*\(\d+\)$/, ''),
          fileName: fileName,
          version: 'N/A',
          size: formatFileSize(fileStats.size),
          enabled: true,
          importedAt: new Date().toISOString(),
          path: targetPath
        };

        mods.push(newMod);
        importedCount++;
        console.log(`   ✅ Mod added to database`);

      } catch (error) {
        console.error(`   ✗ Error:`, error);
        errors.push(`${fileName}: ${error.message}`);
      }
    }

    if (importedCount > 0) {
      saveModsDB(mods);
    }

    let message = importedCount > 0 
      ? `${importedCount} mod(s) importé(s)` 
      : 'Aucun mod importé';
    
    if (errors.length > 0) {
      message += `\n\nErreurs :\n${errors.join('\n')}`;
    }

    return {
      success: importedCount > 0,
      message: message,
      count: importedCount,
      errors
    };

  } catch (error) {
    console.error('❌ Import-mod error:', error);
    return { success: false, message: error.message };
  } finally {
    // Reset the flag after a short delay
    setTimeout(() => {
      importInProgress = false;
      console.log('✅ Import completed, flag reset');
    }, 1000);
  }
});

// 🗑️ Delete a mod
ipcMain.handle('delete-mod', async (event, modId) => {
  try {
    console.log('🗑️ Deleting mod backend, ID:', modId);
    
    const mods = loadModsDB();
    const modIndex = mods.findIndex(m => m.id === modId);

    if (modIndex === -1) {
      console.error('❌ Mod not found, ID:', modId);
      return { success: false, message: 'Mod introuvable' };
    }

    const mod = mods[modIndex];
    console.log('📦 Mod found:', mod.name);

    // Delete the physical file
    if (fs.existsSync(mod.path)) {
      fs.unlinkSync(mod.path);
      console.log('✅ File deleted:', mod.path);
    } else {
      console.warn('⚠️ File already absent:', mod.path);
    }

    // Remove from database
    mods.splice(modIndex, 1);
    saveModsDB(mods);
    console.log('✅ Mod removed from database');

    return { success: true, message: 'Mod supprimé avec succès' };

  } catch (error) {
    console.error('❌ Delete-mod error:', error);
    return { success: false, message: error.message };
  }
});

function getModrinthHeaders() {
  return {
    'User-Agent': 'Velkora Client/1.0 (contact@velkora.com)',
    'Accept': 'application/json'
  };
}

function normalizeProfileContext(profileContext = {}) {
  const loader = String(profileContext.loader || 'vanilla').toLowerCase();
  const gameVersion = String(profileContext.gameVersion || '').trim();
  return {
    ...profileContext,
    loader,
    gameVersion
  };
}

function buildModrinthVersionsUrl(projectId, profileContext = {}, includeLoader = true, includeGameVersion = true) {
  const params = new URLSearchParams();
  params.append('include_changelog', 'false');

  if (includeLoader && profileContext.loader && profileContext.loader !== 'vanilla') {
    params.append('loaders', profileContext.loader);
  }

  if (includeGameVersion && profileContext.gameVersion) {
    params.append('game_versions', profileContext.gameVersion);
  }

  return `https://api.modrinth.com/v2/project/${projectId}/version?${params.toString()}`;
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values.map(value => String(value).toLowerCase())
    : [];
}

function isVersionCompatibleWithProfile(versionData, profileContext = {}) {
  const requestedLoader = String(profileContext.loader || 'vanilla').toLowerCase();
  const requestedGameVersion = String(profileContext.gameVersion || '').trim().toLowerCase();
  const versionLoaders = normalizeStringArray(versionData?.loaders);
  const versionGameVersions = normalizeStringArray(versionData?.game_versions);

  const loaderMatches = requestedLoader === 'vanilla'
    ? true
    : versionLoaders.includes(requestedLoader);
  const gameVersionMatches = !requestedGameVersion
    ? true
    : versionGameVersions.includes(requestedGameVersion);

  return loaderMatches && gameVersionMatches;
}

async function fetchJsonOrThrow(url, headers, label) {
  const response = await fetch(url, { headers });
  console.log(`📊 ${label}: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ ${label} (${response.status}):`, errorText);
    throw new Error(`${label} HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchProjectVersions(projectId, headers, profileContext) {
  const attempts = [
    { includeLoader: true, includeGameVersion: true, label: 'Réponse versions 1' },
    { includeLoader: true, includeGameVersion: false, label: 'Réponse versions 2' },
    { includeLoader: false, includeGameVersion: true, label: 'Réponse versions 3' },
    { includeLoader: false, includeGameVersion: false, label: 'Réponse versions 4' }
  ];

  for (const attempt of attempts) {
    const url = buildModrinthVersionsUrl(
      projectId,
      profileContext,
      attempt.includeLoader,
      attempt.includeGameVersion
    );

    try {
      const versions = await fetchJsonOrThrow(url, headers, `${attempt.label} (${url})`);
      if (Array.isArray(versions) && versions.length > 0) {
        const compatibleVersions = versions.filter(version => isVersionCompatibleWithProfile(version, profileContext));
        if (compatibleVersions.length > 0) {
          return compatibleVersions;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Tentative versions échouée: ${error.message}`);
    }
  }

  const profileVersion = profileContext?.gameVersion || 'inconnue';
  const profileLoader = profileContext?.loader || 'vanilla';
  throw new Error(`Aucune version compatible disponible pour ${profileVersion} avec ${profileLoader}`);
}

function selectPrimaryJar(version) {
  if (!version?.files?.length) {
    return null;
  }

  return version.files.find(file => file.primary && file.filename.endsWith('.jar'))
    || version.files.find(file => file.filename.endsWith('.jar'))
    || null;
}

function selectPrimaryResourcePackFile(version) {
  if (!version?.files?.length) {
    return null;
  }

  return version.files.find(file => file.primary && file.filename.endsWith('.zip'))
    || version.files.find(file => file.filename.endsWith('.zip'))
    || version.files.find(file => file.primary)
    || version.files[0]
    || null;
}

function isProjectAlreadyInstalled(mods, projectId) {
  return mods.some(mod => mod.modrinthProjectId === projectId);
}

function isFileAlreadyInstalled(mods, fileName) {
  return mods.some(mod => mod.fileName === fileName);
}

function getAutomaticLoaderDependencies(profileContext, projectData, versionData, requiredDependencies = []) {
  const dependencyIds = new Set(
    requiredDependencies
      .map(dep => dep.project_id)
      .filter(Boolean)
  );

  const loader = String(profileContext?.loader || '').toLowerCase();
  const projectSlug = String(projectData?.slug || '').toLowerCase();
  const versionLoaders = Array.isArray(versionData?.loaders)
    ? versionData.loaders.map(item => String(item).toLowerCase())
    : [];

  const automaticDependencies = [];

  if (loader === 'fabric' && versionLoaders.includes('fabric') && projectSlug !== 'fabric-api' && !dependencyIds.has('P7dR8mSH')) {
    automaticDependencies.push({
      project_id: 'P7dR8mSH',
      dependency_type: 'required',
      source: 'auto-loader'
    });
  }

  if (loader === 'quilt' && versionLoaders.includes('quilt') && projectSlug !== 'qsl' && !dependencyIds.has('qsl')) {
    automaticDependencies.push({
      project_id: 'qsl',
      dependency_type: 'required',
      source: 'auto-loader'
    });
  }

  return automaticDependencies;
}

async function downloadJarToModsFolder(projectData, versionData, jarFile, headers, metadata = {}) {
  initModsDirectory();

  const mods = loadModsDB();
  if (isProjectAlreadyInstalled(mods, projectData.id) || isFileAlreadyInstalled(mods, jarFile.filename)) {
    console.log(`⚠️ Déjà installé: ${projectData.title}`);
    return { installed: false, skipped: true, modName: projectData.title };
  }

  const modsDir = getModsDir();
  const filePath = path.join(modsDir, jarFile.filename);
  console.log(`📥 Téléchargement: ${jarFile.url}`);

  const fileResponse = await fetch(jarFile.url, { headers });
  if (!fileResponse.ok) {
    throw new Error(`Téléchargement échoué (HTTP ${fileResponse.status})`);
  }

  const buffer = await fileResponse.buffer();
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Fichier sauvegardé: ${filePath}`);

  mods.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: projectData.title,
    fileName: jarFile.filename,
    version: versionData.version_number,
    path: filePath,
    enabled: true,
    size: formatFileSize(buffer.length),
    importedAt: new Date().toISOString(),
    modrinthProjectId: projectData.id,
    modrinthVersionId: versionData.id,
    loader: metadata.loader || null,
    gameVersion: metadata.gameVersion || null,
    isDependency: Boolean(metadata.isDependency)
  });
  saveModsDB(mods);

  return { installed: true, skipped: false, modName: projectData.title };
}

async function downloadResourcePackToFolder(projectData, versionData, packFile, headers, metadata = {}) {
  initResourcePacksDirectory();

  const resourcePacksDir = getResourcePacksDir();
  const filePath = path.join(resourcePacksDir, packFile.filename);
  console.log(`📥 Téléchargement texture pack: ${packFile.url}`);

  const fileResponse = await fetch(packFile.url, { headers });
  if (!fileResponse.ok) {
    throw new Error(`Téléchargement échoué (HTTP ${fileResponse.status})`);
  }

  const buffer = await fileResponse.buffer();
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Texture pack sauvegardé: ${filePath}`);

  return {
    installed: true,
    skipped: false,
    packName: projectData.title,
    filePath,
    version: versionData.version_number,
    gameVersion: metadata.gameVersion || null
  };
}

async function downloadShaderToFolder(projectData, versionData, shaderFile, headers, metadata = {}) {
  initShadersDirectory();

  const shadersDir = getShadersDir();
  const filePath = path.join(shadersDir, shaderFile.filename);
  console.log(`📥 Téléchargement shader: ${shaderFile.url}`);

  const fileResponse = await fetch(shaderFile.url, { headers });
  if (!fileResponse.ok) {
    throw new Error(`Téléchargement échoué (HTTP ${fileResponse.status})`);
  }

  const buffer = await fileResponse.buffer();
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Shader sauvegardé: ${filePath}`);

  return {
    installed: true,
    skipped: false,
    shaderName: projectData.title,
    filePath,
    version: versionData.version_number,
    gameVersion: metadata.gameVersion || null
  };
}

async function installModrinthProject(projectId, profileContext, visitedProjects = new Set(), installState = null) {
  const state = installState || {
    installed: [],
    skipped: [],
    installedDetails: [],
    skippedDetails: [],
    headers: getModrinthHeaders()
  };

  if (visitedProjects.has(projectId)) {
    return state;
  }
  visitedProjects.add(projectId);

  const headers = state.headers;
  const normalizedContext = normalizeProfileContext(profileContext);

  console.log(`🔍 Récupération du projet: ${projectId}`);
  const projectData = await fetchJsonOrThrow(
    `https://api.modrinth.com/v2/project/${projectId}`,
    headers,
    `Réponse projet ${projectId}`
  );
  console.log('✅ Projet trouvé:', projectData.title);

  console.log(`🔍 Récupération des versions pour ${projectData.title}...`);
  const versions = await fetchProjectVersions(projectId, headers, normalizedContext);
  console.log(`✅ ${versions.length} versions trouvées pour ${projectData.title}`);

  let selectedVersion = null;
  let selectedFile = null;
  for (const version of versions) {
    const jar = selectPrimaryJar(version);
    if (jar?.url) {
      selectedVersion = version;
      selectedFile = jar;
      break;
    }
  }

  if (!selectedVersion || !selectedFile) {
    throw new Error(`Aucun fichier JAR compatible trouvé pour ${projectData.title}`);
  }

  const requiredDependencies = (selectedVersion.dependencies || []).filter(dep =>
    dep.dependency_type === 'required' && dep.project_id
  );
  const automaticDependencies = getAutomaticLoaderDependencies(
    normalizedContext,
    projectData,
    selectedVersion,
    requiredDependencies
  );
  const allDependencies = [...requiredDependencies, ...automaticDependencies];

  if (automaticDependencies.length > 0) {
    console.log(
      `🔗 Dépendances automatiques ajoutées pour ${projectData.title}: ${automaticDependencies.map(dep => dep.project_id).join(', ')}`
    );
  }

  for (const dependency of allDependencies) {
    await installModrinthProject(dependency.project_id, normalizedContext, visitedProjects, state);
  }

  const downloadResult = await downloadJarToModsFolder(
    projectData,
    selectedVersion,
    selectedFile,
    headers,
    {
      loader: normalizedContext.loader,
      gameVersion: normalizedContext.gameVersion,
      isDependency: projectId !== state.rootProjectId
    }
  );

  if (downloadResult.installed) {
    state.installed.push(downloadResult.modName);
    state.installedDetails.push({
      name: downloadResult.modName,
      projectId,
      isDependency: projectId !== state.rootProjectId
    });
  } else if (downloadResult.skipped) {
    state.skipped.push(downloadResult.modName);
    state.skippedDetails.push({
      name: downloadResult.modName,
      projectId,
      isDependency: projectId !== state.rootProjectId
    });
  }

  return state;
}

// ✅ TÉLÉCHARGER UN MOD DEPUIS MODRINTH
ipcMain.handle('download-modrinth-mod', async (event, projectId, modName, profileContext = {}) => {
  try {
    console.log(`📥 Téléchargement Modrinth: ${modName} (ID: ${projectId})`);
    console.log(`🔎 Type de projectId: ${typeof projectId}, Valeur: "${projectId}"`);

    // Vérifier si projectId est vide ou invalide
    if (!projectId || projectId === 'undefined' || projectId === '') {
      throw new Error('ID du projet invalide');
    }

    const normalizedContext = normalizeProfileContext(profileContext);
    const installState = {
      installed: [],
      skipped: [],
      installedDetails: [],
      skippedDetails: [],
      headers: getModrinthHeaders(),
      rootProjectId: projectId
    };

    const result = await installModrinthProject(
      projectId,
      normalizedContext,
      new Set(),
      installState
    );

    const installedCount = result.installed.length;
    const skippedCount = result.skipped.length;
    const installedNames = result.installed.join(', ');
    const dependenciesInstalled = result.installedDetails
      .filter(item => item.isDependency)
      .map(item => item.name);

    console.log(`✅ Téléchargement terminé: ${installedNames || modName}`);
    return {
      success: installedCount > 0,
      message: installedCount > 0
        ? `${installedNames || modName} téléchargé(s) avec succès${skippedCount > 0 ? ` (${skippedCount} déjà installé(s))` : ''}`
        : `${modName} est déjà installé`,
      installedMods: result.installed,
      skippedMods: result.skipped,
      dependenciesInstalled,
      installedCount,
      skippedCount
    };

  } catch (error) {
    console.error('❌ Erreur Modrinth:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('download-modrinth-resourcepack', async (event, projectId, packName, profileContext = {}) => {
  try {
    console.log(`📥 Téléchargement texture pack Modrinth: ${packName} (ID: ${projectId})`);

    if (!projectId || projectId === 'undefined' || projectId === '') {
      throw new Error('ID du projet invalide');
    }

    const headers = getModrinthHeaders();
    const gameVersion = String(profileContext?.gameVersion || '').trim();
    const projectData = await fetchJsonOrThrow(
      `https://api.modrinth.com/v2/project/${projectId}`,
      headers,
      `Réponse texture pack ${projectId}`
    );

    const versionAttempts = [
      buildModrinthVersionsUrl(projectId, { gameVersion }, false, true),
      buildModrinthVersionsUrl(projectId, {}, false, false)
    ];

    let versions = [];
    for (const url of versionAttempts) {
      try {
        const response = await fetchJsonOrThrow(url, headers, `Versions texture pack (${url})`);
        if (Array.isArray(response) && response.length > 0) {
          versions = response;
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Tentative texture pack échouée: ${error.message}`);
      }
    }

    if (!versions.length) {
      throw new Error(`Aucune version compatible disponible pour ${packName}`);
    }

    const selectedVersion = versions[0];
    const selectedFile = selectPrimaryResourcePackFile(selectedVersion);
    if (!selectedFile?.url) {
      throw new Error(`Aucun fichier telechargeable trouve pour ${packName}`);
    }

    const result = await downloadResourcePackToFolder(
      projectData,
      selectedVersion,
      selectedFile,
      headers,
      { gameVersion }
    );

    return {
      success: true,
      message: `${packName} a ete telecharge dans le dossier resourcepacks.`,
      filePath: result.filePath,
      version: result.version
    };
  } catch (error) {
    console.error('❌ Erreur texture pack Modrinth:', error);
    return { success: false, message: error.message };
  }
});

// ✅ GESTIONNAIRE DES SHADERS

ipcMain.handle('get-shaders-folder', async () => {
  initShadersDirectory();
  return getShadersDir();
});

ipcMain.handle('get-installed-shaders', async () => {
  try {
    initShadersDirectory();
    const shadersDir = getShadersDir();
    const supportedExtensions = new Set(['.zip', '.rar']);

    const entries = fs.readdirSync(shadersDir, { withFileTypes: true })
      .filter((entry) => {
        if (entry.name.startsWith('.')) return false;
        if (entry.isDirectory()) return true;
        return supportedExtensions.has(path.extname(entry.name).toLowerCase());
      })
      .map((entry, index) => {
        const filePath = path.join(shadersDir, entry.name);
        const stat = fs.statSync(filePath);
        const sizeBytes = entry.isDirectory() ? getDirectorySize(filePath) : stat.size;
        const fileName = entry.name;

        return {
          id: `${stat.mtimeMs}-${index}-${fileName}`,
          name: entry.isDirectory() ? fileName : fileName.replace(path.extname(fileName), ''),
          fileName,
          path: filePath,
          size: formatFileSize(sizeBytes),
          sizeBytes,
          importedAt: stat.mtime.toISOString(),
          type: entry.isDirectory() ? 'folder' : 'archive'
        };
      })
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());

    // Extraire les images asynchronement (seulement pour les archives, pas les dossiers)
    const shadersWithImages = await Promise.all(entries.map(async (shader) => {
      try {
        // Ignorer l'extraction d'image pour les dossiers
        if (shader.type === 'folder') {
          return { ...shader, image: null };
        }
        const image = await extractModImage(shader.path);
        console.log(`[IMG] Shader ${shader.name}: ${image ? 'trouvée' : 'non trouvée'}`);
        return { ...shader, image };
      } catch (error) {
        console.warn(`[IMG] Erreur extraction shader ${shader.name}:`, error.message);
        return { ...shader, image: null };
      }
    }));

    return shadersWithImages;
  } catch (error) {
    console.error('Erreur get-installed-shaders:', error);
    return [];
  }
});

ipcMain.handle('delete-shader', async (event, shaderPath) => {
  try {
    const shadersDir = path.normalize(getShadersDir());
    const normalizedShaderPath = path.normalize(String(shaderPath || '').trim());

    if (!normalizedShaderPath || !normalizedShaderPath.startsWith(shadersDir)) {
      return { success: false, message: 'Chemin du shader invalide' };
    }

    if (!fs.existsSync(normalizedShaderPath)) {
      return { success: false, message: 'Shader introuvable' };
    }

    const stat = fs.statSync(normalizedShaderPath);

    if (stat.isDirectory()) {
      fs.rmSync(normalizedShaderPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(normalizedShaderPath);
    }

    console.log(`✅ Shader supprimé: ${normalizedShaderPath}`);
    return { success: true, message: 'Shader supprimé avec succès' };
  } catch (error) {
    console.error('Erreur delete-shader:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('download-modrinth-shader', async (event, projectId, shaderName, profileContext = {}) => {
  try {
    console.log(`📥 Téléchargement shader Modrinth: ${shaderName} (ID: ${projectId})`);

    if (!projectId || projectId === 'undefined' || projectId === '') {
      throw new Error('ID du projet invalide');
    }

    const headers = getModrinthHeaders();
    const gameVersion = String(profileContext?.gameVersion || '').trim();
    const projectData = await fetchJsonOrThrow(
      `https://api.modrinth.com/v2/project/${projectId}`,
      headers,
      `Réponse shader ${projectId}`
    );

    const versionAttempts = [
      buildModrinthVersionsUrl(projectId, { gameVersion }, false, true),
      buildModrinthVersionsUrl(projectId, {}, false, false)
    ];

    let versions = [];
    for (const url of versionAttempts) {
      try {
        const response = await fetchJsonOrThrow(url, headers, `Versions shader (${url})`);
        if (Array.isArray(response) && response.length > 0) {
          versions = response;
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Tentative shader échouée: ${error.message}`);
      }
    }

    if (!versions.length) {
      throw new Error(`Aucune version compatible disponible pour ${shaderName}`);
    }

    const selectedVersion = versions[0];
    const selectedFile = selectPrimaryResourcePackFile(selectedVersion);
    if (!selectedFile?.url) {
      throw new Error(`Aucun fichier telechargeable trouve pour ${shaderName}`);
    }

    const result = await downloadShaderToFolder(
      projectData,
      selectedVersion,
      selectedFile,
      headers,
      { gameVersion }
    );

    return {
      success: true,
      message: `${shaderName} a ete telecharge dans le dossier shaderpacks.`,
      filePath: result.filePath,
      version: result.version
    };
  } catch (error) {
    console.error('❌ Erreur shader Modrinth:', error);
    return { success: false, message: error.message };
  }
});

// 🔄 Enable/Disable a mod
ipcMain.handle('toggle-mod', async (event, params) => {
  try {
    const { modId, enabled } = params;
    const mods = loadModsDB();
    const mod = mods.find(m => m.id === modId);

    if (!mod) {
      return { success: false, message: 'Mod introuvable' };
    }

    mod.enabled = enabled;

    // Renommer le fichier pour le désactiver/activer
    const currentPath = mod.path;
    const newPath = enabled
      ? currentPath.replace('.disabled', '')
      : currentPath + '.disabled';

    if (fs.existsSync(currentPath)) {
      fs.renameSync(currentPath, newPath);
      mod.path = newPath;
    }

    saveModsDB(mods);

    return {
      success: true,
      message: enabled ? 'Mod activé' : 'Mod désactivé'
    };
  } catch (error) {
    console.error('Erreur toggle-mod:', error);
    return { success: false, message: error.message };
  }
});

// 🔍 Obtenir les détails d'un mod
ipcMain.handle('get-mod-details', async (event, modId) => {
  try {
    const mods = loadModsDB();
    const mod = mods.find(m => m.id === modId);

    if (!mod) {
      return { success: false, message: 'Mod introuvable' };
    }

    return { success: true, mod };

  } catch (error) {
    console.error('Erreur get-mod-details:', error);
    return { success: false, message: error.message };
  }
});

// 🧹 Nettoyer les mods orphelins (fichiers sans entrée DB)
ipcMain.handle('cleanup-mods', async () => {
  try {
    const modsDir = getModsDir();
    const mods = loadModsDB();
    const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
    
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(modsDir, file);
      const existsInDB = mods.some(m => m.fileName === file);

      if (!existsInDB) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    }

    return { 
      success: true, 
      message: `${cleanedCount} fichier(s) orphelin(s) supprimé(s)` 
    };

  } catch (error) {
    console.error('Erreur cleanup-mods:', error);
    return { success: false, message: error.message };
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

ipcMain.on('maximize-window', () => {
  if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

ipcMain.on('close-window', () => {
  try {
    if (discordRPC && typeof discordRPC.disconnect === 'function') {
      // disconnect may be async
      discordRPC.disconnect().catch(() => {});
    }
  } catch (_) {}

  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); } catch(_) {}
});

ipcMain.on('open-external', (event, url) => {
  require('electron').shell.openExternal(url);
});

// ✅ HANDLERS POUR LA FENÊTRE DE LOGS
ipcMain.on('minimize-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) logsWindow.minimize();
});

ipcMain.on('maximize-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.isMaximized() ? logsWindow.unmaximize() : logsWindow.maximize();
  }
});

ipcMain.on('close-logs-window', () => {
  if (logsWindow && !logsWindow.isDestroyed()) logsWindow.close();
});

ipcMain.on('clear-logs', () => {
  currentLogs = [];
});

ipcMain.on('settings-window-ready', () => {
  // Fenêtre paramètres prête
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings-loaded');
  }
});

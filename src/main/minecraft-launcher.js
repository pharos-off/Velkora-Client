const { Client, Authenticator } = require('minecraft-launcher-core');
const fetch = require('node-fetch').default || require('node-fetch');
const path = require('path');
const fs = require('fs');

class MinecraftLauncher {

  constructor() {
    this.launcher = new Client();
    this.versionsCache = null;
    this.versionsCacheTime = 0;
    this.CACHE_DURATION = 5 * 60 * 1000;
  }

  getRequiredJavaMajor(mcVersion) {
    const m = String(mcVersion).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!m) return 8;

    const major = parseInt(m[1]);
    const minor = parseInt(m[2]);

    // Minecraft 26+ nécessite Java 25+
    if (major >= 26) return 25;
    // Minecraft 25 nécessite Java 25+
    if (major >= 25) return 25;
    // Minecraft 21-24 nécessite Java 21+
    if (major >= 21) return 21;

    if (major > 1 || minor >= 20) return 21;
    if (minor >= 18) return 17;
    return 8;
  }

  async checkVersionInstalled(gameDirectory, version) {
    return fs.existsSync(
      path.join(gameDirectory, 'versions', version, `${version}.json`)
    );
  }

  inferVersionLoader(versionId, versionJson = {}) {
    const libraryNames = Array.isArray(versionJson.libraries)
      ? versionJson.libraries.map(library => library?.name).filter(Boolean)
      : [];
    const haystack = [
      versionId,
      versionJson.id,
      versionJson.inheritsFrom,
      versionJson.mainClass,
      ...libraryNames
    ].join(' ').toLowerCase();

    if (haystack.includes('neoforge') || haystack.includes('net.neoforged')) return 'neoforge';
    if (haystack.includes('quilt-loader') || haystack.includes('org.quiltmc')) return 'quilt';
    if (haystack.includes('fabric-loader') || haystack.includes('net.fabricmc')) return 'fabric';
    if (haystack.includes('forgewrapper') || haystack.includes('net.minecraftforge') || /\bforge\b/.test(haystack)) return 'forge';
    return 'vanilla';
  }

  extractBaseMinecraftVersion(versionId, versionJson = {}) {
    const inheritsFrom = String(versionJson?.inheritsFrom || '').trim();
    if (inheritsFrom) {
      return inheritsFrom;
    }

    const candidates = [versionJson?.id, versionId];
    for (const candidate of candidates) {
      const match = String(candidate || '').match(/\d+\.\d+(?:\.\d+)?/);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  resolveInstalledLoaderVersion(gameDirectory, minecraftVersion, loader) {
    const requestedLoader = String(loader || 'vanilla').toLowerCase();
    if (requestedLoader === 'vanilla') {
      return null;
    }

    const versionsDir = path.join(gameDirectory, 'versions');
    if (!fs.existsSync(versionsDir)) {
      return null;
    }

    const candidates = [];
    for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const versionId = entry.name;
      const jsonPath = path.join(versionsDir, versionId, `${versionId}.json`);
      if (!fs.existsSync(jsonPath)) continue;

      try {
        const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const detectedLoader = this.inferVersionLoader(versionId, versionJson);
        if (detectedLoader !== requestedLoader) continue;

        const baseVersion = this.extractBaseMinecraftVersion(versionId, versionJson);
        const exactMatch = baseVersion === minecraftVersion || String(versionId).includes(String(minecraftVersion));
        if (!exactMatch) continue;

        const stats = fs.statSync(jsonPath);
        candidates.push({
          id: versionId,
          loader: detectedLoader,
          baseVersion,
          jsonPath,
          mtimeMs: stats.mtimeMs
        });
      } catch (error) {
        console.warn(`⚠️ Impossible de lire la version ${versionId}: ${error.message}`);
      }
    }

    candidates.sort((a, b) => {
      const aExact = a.baseVersion === minecraftVersion ? 1 : 0;
      const bExact = b.baseVersion === minecraftVersion ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.mtimeMs - a.mtimeMs;
    });

    return candidates[0] || null;
  }

  async getJavaMajor(javaPathCandidate) {
    return new Promise((resolve) => {
      try {
        const { execFile } = require('child_process');
        let bin = 'java';
        if (javaPathCandidate && typeof javaPathCandidate === 'string') {
          // Prefer java.exe for version check
          bin = javaPathCandidate.replace(/javaw(\.exe)?$/i, 'java$1');
        }
        execFile(bin, ['-version'], { windowsHide: true }, (err, stdout, stderr) => {
          if (err && !stderr) return resolve(null);
          const text = String(stderr || stdout || '');
          const m = text.match(/version\s+"([^"]+)"/i);
          if (!m) return resolve(null);
          const ver = m[1]; // e.g., "1.8.0_312", "17.0.3", "21"
          let major = null;
          if (ver.startsWith('1.8')) major = 8;
          else {
            const n = ver.match(/^(\d+)(?:\.\d+)?/);
            major = n ? parseInt(n[1], 10) : null;
          }

          // Log de debug pour la version Java détectée
          console.log(`🔍 Version Java détectée: ${ver} (major: ${major})`);
          resolve(major);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  // ✅ TÉLÉCHARGER AVEC GESTION D'ERREUR AMÉLIORÉE
  async downloadVersion(version, gameDirectory, progressCallback) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`\n⏳ Preparing download for ${version}...`);

        // S'assurer que les dossiers existent
        const dirs = [
          path.join(gameDirectory, 'versions'),
          path.join(gameDirectory, 'libraries'),
          path.join(gameDirectory, 'assets')
        ];

        dirs.forEach(dir => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Folder created: ${dir}`);
          }
        });

        const launchOptions = {
          authorization: Authenticator.getAuth('Player'),
          root: gameDirectory,
          version: {
            number: version,
            type: "release"
          },
          memory: {
            max: "2G",
            min: "1G"
          },
          // 🔥 CONCURRENCE TRÈS RÉDUITE POUR ÉVITER "TOO MANY OPEN FILES"
          overrides: {
            maxSockets: 2,
            maxRetries: 3
          },
          timeout: 3600000  // 60 minutes
        };

        console.log(`📁 Directory: ${gameDirectory}`);
        console.log(`📥 Starting download for ${version}...\n`);

        let currentType = '';
        let progressByType = {};
        let errorCount = 0;

        this.launcher.removeAllListeners();

        this.launcher.on('progress', (progress) => {
          try {
            if (progress && progress.type) {
              currentType = progress.type;

              const percent = progress.total > 0
                ? Math.round((progress.task / progress.total) * 100)
                : 0;

              // Suivre la progression par type
              if (!progressByType[progress.type]) {
                progressByType[progress.type] = { last: 0, count: 0 };
              }

              progressByType[progress.type].count++;

              // Log tous les 5% ou changement de type
              if (percent % 5 === 0 && percent !== progressByType[progress.type].last) {
                console.log(`   [${progress.type}] ${percent}% (${progress.task}/${progress.total})`);
                progressByType[progress.type].last = percent;
              }

              if (progressCallback) {
                try {
                  progressCallback({
                    type: progress.type,
                    task: progress.task,
                    total: progress.total,
                    percent: percent
                  });
                } catch (cbErr) {
                  console.warn('Progress callback error:', cbErr && (cbErr.stack || cbErr.message || cbErr));
                }
              }
            }
          } catch (e) {
            console.error('Error in progress handler:', e && (e.stack || e.message || e));
          }
        });

        const onLog = progressCallback ? (level, msg) => {
          try {
            progressCallback({ level, message: msg });
          } catch (_) {}
        } : null;

        this.launcher.on('debug', (message) => {
          try {
            if (message && typeof message === 'string') {
              const msgLower = message.toLowerCase();

              if (msgLower.includes('error') || msgLower.includes('failed')) {
                console.error('[DEBUG ERROR]', message);
                errorCount++;
                if (typeof onLog === 'function') onLog('error', message);

                // Si trop d'erreurs sur les assets, on continue quand même
                if (msgLower.includes('asset') && errorCount > 50) {
                  console.warn('⚠️  Beaucoup d\'erreurs sur les assets, mais on continue...');
                  if (typeof onLog === 'function') onLog('warning', 'Beaucoup d\'erreurs sur les assets, mais on continue...');
                }
              } else if (msgLower.includes('downloading')) {
                // Afficher les téléchargements importants
                if (msgLower.includes('jar') || msgLower.includes('json')) {
                  console.log('[DOWNLOAD]', message.substring(0, 100));
                  if (typeof onLog === 'function') onLog('info', message.substring(0, 300));
                }
              } else {
                // Generic debug
                if (typeof onLog === 'function') onLog('debug', message);
              }
            }
          } catch (e) {
            console.error('Error in debug handler:', e && (e.stack || e.message || e));
          }
        });

        this.launcher.on('data', (data) => {
          try {
            if (data && typeof data === 'string') {
              // Logs importants seulement
              if (data.includes('Downloaded') && (data.includes('.jar') || data.includes('.json'))) {
                console.log('[DATA]', data.substring(0, 80));
                if (typeof onLog === 'function') onLog('info', data.substring(0, 300));
              } else if (typeof onLog === 'function') {
                // forward general data logs at debug level
                onLog('debug', data.substring(0, 300));
              }
            }
          } catch (e) {
            console.error('Error in data handler:', e && (e.stack || e.message || e));
          }
        });

        let closeTimeout;

        this.launcher.on('close', async (code) => {
          try {
            clearTimeout(closeTimeout);

            console.log(`\n[CLOSE] Process closed with code: ${code}`);
            console.log(`📊 Statistiques:`);
            Object.entries(progressByType).forEach(([type, stats]) => {
              console.log(`   - ${type}: ${stats.count} fichiers`);
            });

            // Vérifier si les fichiers critiques existent
            const versionJsonPath = path.join(gameDirectory, 'versions', version, `${version}.json`);
            const versionJarPath = path.join(gameDirectory, 'versions', version, `${version}.jar`);
            const librariesPath = path.join(gameDirectory, 'libraries');

            const criticalFilesExist = fs.existsSync(versionJsonPath) &&
              fs.existsSync(versionJarPath) &&
              fs.existsSync(librariesPath);

            if (criticalFilesExist) {
              // compter les fichiers de manière asynchrone pour ne pas bloquer l'UI
              let libCount = 0;
              try {
                libCount = await this.countFilesAsync(librariesPath);
              } catch (e) {
                console.warn('Error counting library files:', e && (e.stack || e.message || e));
                libCount = 0;
              }

              console.log(`✅ Download completed!`);
              console.log(`   - Library files: ${libCount}`);
              console.log(`   - Ignored errors: ${errorCount}`);
              resolve({ success: true, downloadedFiles: libCount, errors: errorCount });
            } else {
              console.error('❌ Fichiers critiques manquants');
              reject(new Error('Téléchargement incomplet - fichiers critiques manquants'));
            }
          } catch (e) {
            console.error('Error in close handler:', e && (e.stack || e.message || e));
            try { reject(e); } catch (_) {}
          }
        });

        this.launcher.on('error', (err) => {
          try {
            console.error('❌ Erreur launcher:', err && (err.stack || err.message || err));
            if (typeof onLog === 'function') onLog('error', String(err && (err.stack || err.message || err)));

            // Ne rejeter que si c'est une erreur critique
            const msg = String(err && (err.message || err) || '');
            if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('authentication')) {
              try { reject(err); } catch (_) {}
            } else {
              errorCount++;
              console.warn('⚠️  Erreur non-critique, on continue...');
            }
          } catch (e) {
            console.error('Error in error handler:', e && (e.stack || e.message || e));
          }
        });

        try {
          this.launcher.launch(launchOptions);
        } catch (e) {
          console.error('❌ Error launching internal launcher:', e && (e.stack || e.message || e));
          if (typeof onLog === 'function') onLog('error', `Failed to start internal launcher: ${e && (e.stack || e.message || e)}`);
          try { reject(e); } catch (_) {}
        }

        // Restore spawn only after the launcher has either closed or errored
        const restoreSpawn = () => {
          try {
            if (_patchedSpawn) {
              child_process.spawn = origSpawn;
              _patchedSpawn = false;
              console.log('[JavaLaunch] Spawn patch restored');
            }
          } catch (e) {
            console.warn('[JavaLaunch] Failed to restore spawn:', e && e.message ? e.message : e);
          }
        };

        this.launcher.on('close', (code) => {
          restoreSpawn();
        });

        this.launcher.on('error', () => {
          restoreSpawn();
        });

        // Timeout de sécurité (90 minutes)
        closeTimeout = setTimeout(() => {
          console.warn('⚠️ Timeout: Download taking too long, checking files...');

          const versionJsonPath = path.join(gameDirectory, 'versions', version, `${version}.json`);
          if (fs.existsSync(versionJsonPath)) {
            console.log('✅ Main files present, considering download successful');
            resolve({ success: true, downloadedFiles: 0, timeout: true });
          } else {
            reject(new Error('Timeout - fichiers manquants'));
          }

          restoreSpawn();
        }, 90 * 60 * 1000);

      } catch (error) {
        console.error('❌ Error preparing download:', error);
        reject(error);
      }
    });
  }

  // ✅ COMPTER LES FICHIERS TÉLÉCHARGÉS
  countFiles(dir) {
    let count = 0;
    try {
      if (!fs.existsSync(dir)) return 0;

      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          count += this.countFiles(path.join(dir, file.name));
        } else {
          count++;
        }
      }
    } catch (error) {
      return 0;
    }
    return count;
  }

  // Asynchrone: compter les fichiers sans bloquer la boucle d'événements
  async countFilesAsync(dir) {
    let total = 0;
    try {
      if (!fs.existsSync(dir)) return 0;
      const stack = [dir];
      while (stack.length) {
        const cur = stack.pop();
        try {
          const entries = await fs.promises.readdir(cur, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) stack.push(path.join(cur, entry.name));
            else total++;
          }
        } catch (e) {
          // ignore unreadable dirs
        }
      }
    } catch (e) {
      return 0;
    }
    return total;
  }

  // ✅ FIND JAVA PATH FOR SPECIFIC JAVA VERSION
  async findJavaPath(targetJavaVersion) {
    const javaBaseDir = 'C:\\Program Files\\Java';
    
    try {
      if (fs.existsSync(javaBaseDir)) {
        const dirs = fs.readdirSync(javaBaseDir);
        
        // Parse versions and filter for target
        const versions = dirs
          .filter(d => {
            const match = d.match(/(?:jdk|jre)(?:-)?(\d+)(?:\.(\d+))?/i);
            return match !== null;
          })
          .map(d => {
            const match = d.match(/(?:jdk|jre)(?:-)?(\d+)(?:\.(\d+))?/i);
            const major = parseInt(match[1], 10);
            return { dir: d, major };
          })
          .filter(v => v.major === parseInt(targetJavaVersion, 10))
          .sort((a, b) => b.major - a.major);

        // Find javaw.exe
        for (const { dir, major } of versions) {
          const javawPath = path.join(javaBaseDir, dir, 'bin', 'javaw.exe');
          if (fs.existsSync(javawPath)) {
            return javawPath;
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ Erreur lors de la recherche de Java ${targetJavaVersion}: ${e.message}`);
    }

    return null;
  }

  async launch(options) {
    const {
      authData, version, ram, gameDirectory, javaPath, serverIP,
      windowWidth, windowHeight, onProgress, onLog, onClose, loader
    } = options;

    let downloadedVersion = null;

    // ✅ VÉRIFIER ET TÉLÉCHARGER SI NÉCESSAIRE
    const isInstalled = await this.checkVersionInstalled(gameDirectory, version);

    if (!isInstalled) {
      console.log(`\n📥 Version ${version} missing. Downloading...`);
      if (typeof onLog === 'function') onLog('info', `📥 Version ${version} missing. Downloading...`);
      console.log(`⏱️  Cela peut prendre 10-30 minutes selon votre connexion...\n`);
      if (typeof onLog === 'function') onLog('info', `⏱️  Cela peut prendre 10-30 minutes selon votre connexion...`);

      try {
        const result = await this.downloadVersion(version, gameDirectory, (progress) => {
          // Propager la progression vers le callback fourni à launch()
          try {
            if (typeof onProgress === 'function') {
              onProgress({
                type: progress.type,
                task: progress.task,
                total: progress.total,
                percent: progress.percent,
                message: `[${progress.type}] ${progress.percent}% (${progress.task}/${progress.total})`
              });
            }
          } catch (e) {
            // Ignorer les erreurs du callback
          }
        });

        if (result.success) {
          downloadedVersion = version;
          console.log(`✅ Version ${version} downloaded successfully!`);
          if (typeof onLog === 'function') onLog('success', `✅ Version ${version} downloaded successfully!`);
          if (result.errors > 0) {
            console.log(`⚠️ ${result.errors} minor errors ignored (missing assets)`);
            if (typeof onLog === 'function') onLog('warning', `⚠️ ${result.errors} minor errors ignored (missing assets)`);
          }
        }
      } catch (error) {
        console.error(`❌ Download error: ${error.message}`);
        if (typeof onLog === 'function') onLog('error', `❌ Download error: ${error.message}`);
        return {
          success: false,
          error: `Impossible de télécharger Minecraft ${version}: ${error.message}`
        };
      }
    } else {
      console.log(`✅ Version ${version} already installed`);
      if (typeof onLog === 'function') onLog('info', `✅ Version ${version} already installed`);

      // Vérification supplémentaire de l'intégrité des fichiers
      const versionJsonPath = path.join(gameDirectory, 'versions', version, `${version}.json`);
      const versionJarPath = path.join(gameDirectory, 'versions', version, `${version}.jar`);

      if (!fs.existsSync(versionJsonPath) || !fs.existsSync(versionJarPath)) {
        console.log(`⚠️ Fichiers manquants détectés, retéléchargement nécessaire...`);
        if (typeof onLog === 'function') onLog('warning', `⚠️ Fichiers manquants détectés, retéléchargement nécessaire...`);
        try {
          const result = await this.downloadVersion(version, gameDirectory, (progress) => {
            try {
              if (typeof onProgress === 'function') {
                onProgress({
                  type: progress.type,
                  task: progress.task,
                  total: progress.total,
                  percent: progress.percent,
                  message: `[${progress.type}] ${progress.percent}% (${progress.task}/${progress.total})`
                });
              }
            } catch (e) {}
          });
          if (result.success) {
            downloadedVersion = version;
          }
          if (!result.success) {
            return {
              success: false,
              error: `Fichiers corrompus, retéléchargement échoué: ${result.error}`
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `Erreur lors du retéléchargement: ${error.message}`
          };
        }
      }

      console.log('');
    }

    // ✅ Check Java installation avant tout
    console.log(`🔍 Vérification de Java pour Minecraft ${version}...`);
    const javaCheck = await this.checkJavaInstallation();
    console.log(`📊 Java installé: ${javaCheck.installed}, Version: ${javaCheck.version}, Major: ${javaCheck.major}`);

    // ✅ Résolution javaw (sans console)
    let resolvedJava = (javaPath && String(javaPath).trim())
      ? String(javaPath).trim()
      : null;

    // Si aucun chemin Java configuré, rechercher automatiquement Java 25+ pour Minecraft 26
    if (!resolvedJava) {
      const javaBaseDir = 'C:\\Program Files\\Java';
      let foundJava = null;

      try {
        if (fs.existsSync(javaBaseDir)) {
          const dirs = fs.readdirSync(javaBaseDir);
          
          // Classer les versions par priorité (25 > 24 > 23 > 22 > 21 > ...)
          const versions = dirs
            .filter(d => {
              const match = d.match(/(?:jdk|jre)(?:-)?(\d+)(?:\.(\d+))?/i);
              return match !== null;
            })
            .map(d => {
              const match = d.match(/(?:jdk|jre)(?:-)?(\d+)(?:\.(\d+))?/i);
              const major = parseInt(match[1], 10);
              return { dir: d, major };
            })
            .sort((a, b) => b.major - a.major); // Trier décroissant (plus récent d'abord)

          // Chercher le binaire javaw.exe
          for (const { dir, major } of versions) {
            const javawPath = path.join(javaBaseDir, dir, 'bin', 'javaw.exe');
            if (fs.existsSync(javawPath)) {
              foundJava = javawPath;
              console.log(`🔍 Java ${major} trouvé: ${javawPath}`);
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ Erreur lors de la recherche de Java: ${e.message}`);
      }

      if (foundJava) {
        resolvedJava = foundJava;
      } else {
        // Si aucun Java trouvé, utiliser javaw en espérant qu'il soit dans le PATH
        resolvedJava = 'javaw';
        console.warn(`⚠️ Aucun Java trouvé dans ${javaBaseDir}, utilisation du PATH système`);
      }
    }

    // si chemin vers java.exe → remplacer par javaw.exe
    resolvedJava = resolvedJava.replace(/java\.exe$/i, "javaw.exe");

    // si juste "java"
    if (/^java$/i.test(resolvedJava)) {
      resolvedJava = "javaw";
    }

    // ✅ Check Java version si possible
    const requiredMajor = this.getRequiredJavaMajor(version);
    let javaMajor = null;
    try {
      if (resolvedJava.includes('\\') || resolvedJava.includes('/')) {
        const binDir = path.dirname(resolvedJava);
        const rootDir = path.dirname(binDir);
        const releaseFile = path.join(rootDir, 'release');
        if (fs.existsSync(releaseFile)) {
          const txt = fs.readFileSync(releaseFile, 'utf8');
          const m = txt.match(/JAVA_VERSION="([^"]+)"/);
          if (m && m[1]) {
            const ver = m[1];
            if (ver.startsWith('1.8')) javaMajor = 8;
            else {
              const n = ver.match(/^(\d+)/);
              javaMajor = n ? parseInt(n[1], 10) : null;
            }
          }
        }
      }
    } catch (_) { }

    if (onLog) onLog('info', `Java requis: ${requiredMajor}+, Java détecté: ${javaMajor ?? 'inconnu'}`);
    if (javaMajor && javaMajor < requiredMajor) {
      const errorMsg = `❌ Minecraft ${version} nécessite Java ${requiredMajor}+\n\nVersion Java actuelle: ${javaMajor}\n\n⚠️ Pour Minecraft 26.2, téléchargez Java 25 depuis:\nhttps://adoptium.net/temurin/releases/?version=25\n\nOu configurez manuellement le chemin Java dans les paramètres du launcher.`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Vérification supplémentaire pour les versions très récentes
    const versionParts = String(version).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    const versionMajor = versionParts ? parseInt(versionParts[1]) : 0;
    if (versionMajor >= 26 && javaMajor && javaMajor < 25) {
      const errorMsg = `❌ Minecraft ${version} nécessite Java 25 ou plus récent.\n\nVersion actuelle: Java ${javaMajor}\n\n📥 Téléchargez Java 25:\nhttps://adoptium.net/temurin/releases/?version=25`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const requestedLoader = String(loader || 'vanilla').toLowerCase();
    const customVersion = this.resolveInstalledLoaderVersion(gameDirectory, version, requestedLoader);
    if (requestedLoader !== 'vanilla' && !customVersion) {
      const errorMsg = `❌ Le loader ${requestedLoader} est selectionne pour Minecraft ${version}, mais aucune version moddee installee n'a ete trouvee dans le dossier versions.\n\nInstallez d'abord ${requestedLoader} pour cette version, puis relancez le jeu.`;
      if (onLog) onLog('error', errorMsg);
      return { success: false, error: errorMsg };
    }

    if (customVersion) {
      const loaderLog = `Version moddee detectee: ${customVersion.id} (${customVersion.loader} pour ${customVersion.baseVersion})`;
      console.log(`🧩 ${loaderLog}`);
      if (onLog) onLog('info', loaderLog);
    }

    return new Promise((resolve, reject) => {
      // ✅ Valider authData
      if (!authData || typeof authData !== 'object') {
        console.error('❌ Invalid authData:', authData);
        return reject(new Error('authData is required for launch'));
      }

      let authorization = null;

      if (authData.type === 'microsoft') {
        // sécurité : si pas encore de clientToken, on en crée un
        if (!authData.clientToken) {
          const crypto = require('crypto');
          authData.clientToken = crypto.randomUUID();
        }

        authorization = {
          access_token: authData.accessToken,   // token Minecraft services
          client_token: authData.clientToken,   // ✅ UUID random stable
          uuid: authData.uuid,                  // UUID joueur (OK)
          name: authData.username,
          user_properties: "{}"
        };
      } else {
        // ✅ Authentification offline ou autre
        const crypto = require('crypto');
        authorization = {
          access_token: crypto.randomUUID(),
          client_token: crypto.randomUUID(),
          uuid: authData.uuid || crypto.randomUUID(),
          name: authData.username || 'Player',
          user_properties: "{}"
        };
      }

      // ✅ Vérifier que authorization est défini
      if (!authorization) {
        console.error('❌ Authorization object not created');
        return reject(new Error('Failed to create authorization'));
      }

      const launchOptions = {
        authorization: authorization,
        root: gameDirectory,
        javaPath: resolvedJava,
        version: {
          number: version,
          type: customVersion ? requestedLoader : "release",
          ...(customVersion ? { custom: customVersion.id } : {})
        },
        memory: {
          max: `${ram}G`,
          min: `${Math.max(1, ram - 1)}G`
        },
        window: {
          width: parseInt(windowWidth || 1280, 10),
          height: parseInt(windowHeight || 720, 10)
        },

        // ✅ IMPORTANT:
        // customArgs = JVM args (donc PAS de --server / --quickPlayMultiplayer ici)
        // customLaunchArgs = arguments Minecraft (OK ici si besoin)
        customArgs: [],
        customLaunchArgs: [],

        // ✅ DÉTACHER COMPLÈTEMENT LE PROCESSUS ET CACHER LA CONSOLE
        windowsHide: true
      };

      function parseMcVersion(v) {
        // extrait les 3 premiers nombres (supporte "1.8.9", "1.21.11", "1.8.9-forge", etc.)
        const m = String(v || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
        if (!m) return [0, 0, 0];
        return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || '0', 10)];
      }

      function isAtLeast(v, target) {
        const a = parseMcVersion(v);
        const b = target;
        for (let i = 0; i < 3; i++) {
          const x = a[i] || 0, y = b[i] || 0;
          if (x > y) return true;
          if (x < y) return false;
        }
        return true;
      }

      launchOptions.customArgs = launchOptions.customArgs || [];
      launchOptions.customLaunchArgs = launchOptions.customLaunchArgs || [];

      if (serverIP) {
        const [hostRaw, portRaw] = String(serverIP).split(':');
        const host = hostRaw?.trim();
        const port = parseInt(portRaw || '25565', 10) || 25565;

        // parse version safe
        const m = String(version).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
        const major = m ? parseInt(m[1], 10) : 1;
        const minor = m ? parseInt(m[2], 10) : 0;

        console.log(`MC version parsed = ${major}.${minor}`);

        // ===== 1.20+ =====
        if (major > 1 || minor >= 20) {
          launchOptions.customLaunchArgs.push(
            "--quickPlayMultiplayer",
            `${host}:${port}`
          );
          console.log("Using QuickPlay");
        }

        // ===== <= 1.19 =====
        else {
          launchOptions.customLaunchArgs.push(
            "--server", host,
            "--port", String(port)
          );
          console.log("Using legacy server args");
        }
      }

      console.log(`🎮 Lancement Minecraft...`);
      console.log(`   Version: ${version}`);
      if (customVersion) console.log(`   Version custom: ${customVersion.id}`);
      console.log(`   Loader: ${requestedLoader}`);
      console.log(`   RAM: ${ram}G (max heap: ${ram}GB, min heap: ${Math.max(1, ram - 1)}GB)`);
      console.log(`   Utilisateur: ${authData.username}`);
      console.log(`   Directory: ${gameDirectory}`);
      console.log(`   Java: ${resolvedJava} (version ${javaMajor})`);
      if (serverIP) console.log(`   Serveur: ${serverIP}`);
      console.log('');

      try {
        // ✅ Force javaw.exe to avoid console window on first launch
        const child_process = require('child_process');
        const origSpawn = child_process.spawn;
        let _patchedSpawn = false;
        
        try {
          if (process.platform === 'win32' && typeof origSpawn === 'function') {
            child_process.spawn = function(command, args, options) {
              try {
                let cmd = command;
                
                // ✅ Replace ANY form of java with javaw.exe
                if (typeof cmd === 'string') {
                  const base = path.basename(cmd);
                  // Match: java, java.exe, JAVA, JAVA.EXE, etc.
                  if (/^java(\.exe)?$/i.test(base)) {
                    // Replace with absolute path to javaw.exe
                    const dir = path.dirname(cmd);
                    cmd = path.join(dir, 'javaw.exe');
                  }
                }
                
                // ✅ Hide console window on Windows
                options = Object.assign({}, options || {}, { windowsHide: true });
                
                console.log(`[JavaLaunch] Command: ${cmd}, Hide: true`);
                return origSpawn.call(child_process, cmd, args, options);
              } catch (e) {
                console.warn(`[JavaLaunch Error] ${e.message}, falling back to original spawn`);
                return origSpawn.call(child_process, command, args, options);
              }
            };
            _patchedSpawn = true;
          }
        } catch (e) {
          console.warn('⚠️ Could not patch child_process.spawn:', e && e.message);
        }

        this.launcher.launch(launchOptions);

        // ✅ Restore spawn after launching to avoid side-effects
        try {
          if (_patchedSpawn) {
            child_process.spawn = origSpawn;
            console.log('[JavaLaunch] Spawn patch removed');
          }
        } catch (e) {
          // ignore
        }

        this.launcher.on('debug', (e) => {
          try {
            if (e && typeof e === 'string' && (e.includes('Error') || e.includes('error'))) {
              console.log('[DEBUG]', e);
              if (onLog) onLog('debug', e);
            } else if (e && typeof e === 'string') {
              if (onLog) onLog('debug', e);
            }
          } catch (err) {
            console.error('Error in launch debug handler:', err && (err.stack || err.message || err));
          }
        });

        this.launcher.on('data', (e) => {
          try {
            if (e && typeof e === 'string') {
              console.log('[GAME]', e.substring(0, 100));
              if (onLog) onLog('info', e.substring(0, 300));
            }
          } catch (err) {
            console.error('Error in launch data handler:', err && (err.stack || err.message || err));
          }
        });

        let launchResolved = false;

        this.launcher.on('close', (code) => {
          try {
            console.log(`\n🎓 Minecraft closed (code: ${code})`);
            if (onLog) onLog(code === 0 ? 'success' : 'error', `Minecraft closed (code: ${code})`);
            try { if (typeof onClose === 'function') onClose(code); } catch (_) { }
            if (!launchResolved) {
              launchResolved = true;
              resolve({ success: true, code: code, downloadedVersion: downloadedVersion || undefined });
            }
          } catch (err) {
            console.error('Error in launch close handler:', err && (err.stack || err.message || err));
          }
        });

        this.launcher.on('error', (err) => {
          try {
            console.error('❌ Erreur Minecraft:', err && (err.stack || err.message || err));
            if (onLog) onLog('error', String(err?.message || err));
            if (!launchResolved) {
              launchResolved = true;
              reject(err);
            }
          } catch (e) {
            console.error('Error in launch error handler:', e && (e.stack || e.message || e));
          }
        });

        // Considérer le lancement réussi après 1 seconde (une seule fois)
        setTimeout(() => {
          if (!launchResolved) {
            console.log('✅ Minecraft started successfully!');
            if (onLog) onLog('success', 'Minecraft started');
            launchResolved = true;
            resolve({ success: true, launched: true, downloadedVersion: downloadedVersion || undefined });
          }
        }, 1000);

      } catch (error) {
        console.error('❌ Erreur lancement:', error);
        reject(error);
      }
    });
  }

  async getAvailableVersions() {
    // Retourner le cache si disponible
    if (this.versionsCache && Date.now() - this.versionsCacheTime < this.CACHE_DURATION) {
      return this.versionsCache;
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Attendre 2 secondes avant chaque tentative
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const controller = new AbortController();
        let timeout = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

        try {
          const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json', {
            signal: controller.signal,
              headers: { 'User-Agent': 'Velkora Client/3.0' }
          });

          clearTimeout(timeout);
          timeout = null;

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          const versions = data.versions
            .filter(v => v.type === 'release')
            .slice(0, 30)
            .map(v => ({
              id: v.id,
              name: v.id,
              type: v.type,
              url: v.url,
              releaseTime: v.releaseTime
            }));

          // Mettre en cache
          this.versionsCache = versions;
          this.versionsCacheTime = Date.now();
          return versions;
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }
      catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} to fetch versions failed: ${error.message}`);
      }
    }
    

    // Fallback: retourner une liste de versions en cache
    return [
      
      { id: '26.2', name: '26.2', type: 'release', releaseTime: '2026-06-16T08:00:00Z' },
      { id: '26.1.2', name: '26.1.2', type: 'release', releaseTime: '2026-04-08T08:00:00Z' },
      { id: '26.1.1', name: '26.1.1', type: 'release', releaseTime: '2026-04-01T08:00:00Z' },
      { id: '1.21.11', name: '1.21.11', type: 'release', releaseTime: '2025-01-15T08:00:00Z' },
      { id: '1.21.10', name: '1.21.10', type: 'release', releaseTime: '2024-12-17T08:00:00Z' },
      { id: '1.21.9', name: '1.21.9', type: 'release', releaseTime: '2024-11-19T08:00:00Z' },
      { id: '1.21.8', name: '1.21.8', type: 'release', releaseTime: '2024-10-30T08:00:00Z' },
      { id: '1.21.7', name: '1.21.7', type: 'release', releaseTime: '2024-10-18T08:00:00Z' },
      { id: '1.21.6', name: '1.21.6', type: 'release', releaseTime: '2024-10-04T08:00:00Z' },
      { id: '1.21.5', name: '1.21.5', type: 'release', releaseTime: '2024-09-24T08:00:00Z' },
      { id: '1.21.4', name: '1.21.4', type: 'release', releaseTime: '2024-09-10T08:00:00Z' },
      { id: '1.21.3', name: '1.21.3', type: 'release', releaseTime: '2024-08-06T08:00:00Z' },
      { id: '1.21.2', name: '1.21.2', type: 'release', releaseTime: '2024-07-18T08:00:00Z' },
      { id: '1.21.1', name: '1.21.1', type: 'release', releaseTime: '2024-07-10T08:00:00Z' },
      { id: '1.21', name: '1.21', type: 'release', releaseTime: '2024-06-13T08:00:00Z' },
      { id: '1.20.6', name: '1.20.6', type: 'release', releaseTime: '2024-05-30T08:00:00Z' },
      { id: '1.20.5', name: '1.20.5', type: 'release', releaseTime: '2024-04-23T08:00:00Z' },
      { id: '1.20.4', name: '1.20.4', type: 'release', releaseTime: '2023-12-07T08:00:00Z' },
      { id: '1.20.3', name: '1.20.3', type: 'release', releaseTime: '2023-09-12T08:00:00Z' },
      { id: '1.20.2', name: '1.20.2', type: 'release', releaseTime: '2023-09-14T08:00:00Z' },
      { id: '1.20.1', name: '1.20.1', type: 'release', releaseTime: '2023-06-13T08:00:00Z' },
      { id: '1.20', name: '1.20', type: 'release', releaseTime: '2023-06-06T08:00:00Z' },
      { id: '1.19.4', name: '1.19.4', type: 'release', releaseTime: '2023-03-14T08:00:00Z' },
      { id: '1.19.3', name: '1.19.3', type: 'release', releaseTime: '2022-12-07T08:00:00Z' },
      { id: '1.19.2', name: '1.19.2', type: 'release', releaseTime: '2022-08-05T08:00:00Z' },
      { id: '1.19.1', name: '1.19.1', type: 'release', releaseTime: '2022-07-27T08:00:00Z' },
      { id: '1.19', name: '1.19', type: 'release', releaseTime: '2022-06-07T08:00:00Z' },
      { id: '1.18.2', name: '1.18.2', type: 'release', releaseTime: '2022-02-28T08:00:00Z' },
      { id: '1.18.1', name: '1.18.1', type: 'release', releaseTime: '2021-12-10T08:00:00Z' },
      { id: '1.18', name: '1.18', type: 'release', releaseTime: '2021-12-07T08:00:00Z' },
      { id: '1.17.1', name: '1.17.1', type: 'release', releaseTime: '2021-07-27T08:00:00Z' },
      { id: '1.17', name: '1.17', type: 'release', releaseTime: '2021-06-08T08:00:00Z' },
      { id: '1.16.5', name: '1.16.5', type: 'release', releaseTime: '2021-01-15T08:00:00Z' },
      { id: '1.16.4', name: '1.16.4', type: 'release', releaseTime: '2020-11-02T08:00:00Z' },
      { id: '1.16.3', name: '1.16.3', type: 'release', releaseTime: '2020-09-16T08:00:00Z' },
      { id: '1.16.2', name: '1.16.2', type: 'release', releaseTime: '2020-08-11T08:00:00Z' },
      { id: '1.16.1', name: '1.16.1', type: 'release', releaseTime: '2020-06-24T08:00:00Z' },
      { id: '1.16', name: '1.16', type: 'release', releaseTime: '2020-06-23T08:00:00Z' },
      { id: '1.15.2', name: '1.15.2', type: 'release', releaseTime: '2020-01-17T08:00:00Z' },
      { id: '1.15.1', name: '1.15.1', type: 'release', releaseTime: '2019-12-17T08:00:00Z' },
      { id: '1.15', name: '1.15', type: 'release', releaseTime: '2019-12-10T08:00:00Z' },
      { id: '1.14.4', name: '1.14.4', type: 'release', releaseTime: '2019-07-19T08:00:00Z' },
      { id: '1.14.3', name: '1.14.3', type: 'release', releaseTime: '2019-06-24T08:00:00Z' },
      { id: '1.14.2', name: '1.14.2', type: 'release', releaseTime: '2019-05-27T08:00:00Z' },
      { id: '1.14.1', name: '1.14.1', type: 'release', releaseTime: '2019-05-13T08:00:00Z' },
      { id: '1.14', name: '1.14', type: 'release', releaseTime: '2019-04-23T08:00:00Z' },
      { id: '1.13.2', name: '1.13.2', type: 'release', releaseTime: '2019-01-28T08:00:00Z' },
      { id: '1.13.1', name: '1.13.1', type: 'release', releaseTime: '2018-08-22T08:00:00Z' },
      { id: '1.13', name: '1.13', type: 'release', releaseTime: '2018-07-10T08:00:00Z' },
      { id: '1.12.2', name: '1.12.2', type: 'release', releaseTime: '2017-09-18T08:00:00Z' },
      { id: '1.12.1', name: '1.12.1', type: 'release', releaseTime: '2017-08-02T08:00:00Z' },
      { id: '1.12', name: '1.12', type: 'release', releaseTime: '2017-06-07T08:00:00Z' },
      { id: '1.11.2', name: '1.11.2', type: 'release', releaseTime: '2016-12-20T08:00:00Z' },
      { id: '1.11.1', name: '1.11.1', type: 'release', releaseTime: '2016-12-20T08:00:00Z' },
      { id: '1.11', name: '1.11', type: 'release', releaseTime: '2016-11-14T08:00:00Z' },
      { id: '1.10.2', name: '1.10.2', type: 'release', releaseTime: '2016-06-23T08:00:00Z' },
      { id: '1.9.4', name: '1.9.4', type: 'release', releaseTime: '2016-05-10T08:00:00Z' },
      { id: '1.9.3', name: '1.9.3', type: 'release', releaseTime: '2016-05-10T08:00:00Z' },
      { id: '1.9.2', name: '1.9.2', type: 'release', releaseTime: '2016-03-30T08:00:00Z' },
      { id: '1.9.1', name: '1.9.1', type: 'release', releaseTime: '2016-03-30T08:00:00Z' },
      { id: '1.9', name: '1.9', type: 'release', releaseTime: '2016-02-29T08:00:00Z' },
      { id: '1.8.9', name: '1.8.9', type: 'release', releaseTime: '2015-12-08T08:00:00Z' },
    ];
  }

  async checkJavaInstallation() {
    const { exec } = require('child_process');

    return new Promise((resolve) => {
      exec('javaw -version', (error, stdout, stderr) => {
        if (error) {
          resolve({ installed: false, version: null, major: null });
        } else {
          const versionMatch = stderr.match(/version "(.+?)"/);
          const version = versionMatch ? versionMatch[1] : 'Unknown';
          let major = null;

          if (version.startsWith('1.8')) major = 8;
          else {
            const n = version.match(/^(\d+)(?:\.\d+)?/);
            major = n ? parseInt(n[1], 10) : null;
          }

          resolve({
            installed: true,
            version: version,
            major: major
          });
        }
      });
    });
  }
}

module.exports = MinecraftLauncher;

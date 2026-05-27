const { BrowserWindow, session } = require('electron');
const fetch = require('node-fetch');
const Store = require('electron-store');
const path = require('path');
const crypto = require('crypto');

class MicrosoftAuth {
  constructor(storeInstance) {
    this.clientId = '00000000-0000-0000-0000-0000402b5328';
    this.redirectUri = 'https://login.live.com/oauth20_desktop.srf';
    // ✅ Utiliser le store passé en paramètre ou créer un nouveau (fallback)
    this.store = storeInstance || new Store();
    this.tokenCache = this.store.get('authData', null);
    console.log('🔐 [MicrosoftAuth Constructor] Store initialized');
    console.log('🔐 [MicrosoftAuth Constructor] Cached authData:', this.tokenCache ? `${this.tokenCache.username} (${this.tokenCache.uuid})` : 'NULL');
    this.authInProgress = false;
    this.authWindow = null;
    this.authPromise = null;
  }

  /**
   * ✅ AUTHENTIFICATION PRINCIPALE - RÉSILIENTE ET ROBUSTE
   */
  async authenticate(forcePrompt = false) {
    console.log('🔐 [authenticate()] Starting - forcePrompt:', forcePrompt);
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      console.log('⚠️ Une fenêtre d\'authentification existe déjà');
      this.authWindow.focus();
      return { success: false, error: 'Une fenêtre d\'authentification est déjà ouverte' };
    }

    if (this.authInProgress && this.authPromise) {
      console.log('⚠️ Authentification déjà en cours, réutilisation de la promesse existante');
      return this.authPromise;
    }

    this.authInProgress = true;

    this.authPromise = new Promise(async (resolve) => {
      try {
        console.log('🔐 [authenticate()] Creating auth session with persist:auth partition');
        const authSession = session.fromPartition('persist:auth');
        console.log('🔐 [authenticate()] Auth session created');

        if (forcePrompt) {
          console.log('🔐 [authenticate()] forcePrompt=true, clearing storage...');
          try {
            await authSession.clearStorageData({
              storages: ['cookies', 'localstorage', 'sessionstorage']
            });
            console.log('✅ [authenticate()] Storage cleared');
          } catch (error) {
            console.warn('⚠️ Impossible de vider la session d\'authentification :', error.message);
          }
        } else {
          console.log('🔐 [authenticate()] forcePrompt=false, keeping existing session/cookies');
        }

        this.authWindow = new BrowserWindow({
          width: 600,
          height: 700,
          show: true,
          icon: path.join(__dirname, '..', 'assets', 'icon.png'),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            session: authSession
          }
        });

        this.authWindow.webContents.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );

        const authUrl =
          `https://login.live.com/oauth20_authorize.srf` +
          `?client_id=${this.clientId}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
          `&scope=XboxLive.signin%20offline_access` +
          `&prompt=select_account`;

        console.log('🔐 [authenticate()] Loading Microsoft auth URL:', authUrl);
        this.authWindow.loadURL(authUrl);

        let isProcessing = false;
        let windowClosed = false;

        const timeout = setTimeout(() => {
          if (!isProcessing && this.authWindow && !this.authWindow.isDestroyed()) {
            windowClosed = true;
            this.authWindow.close();
            this.authWindow = null;
            this.authInProgress = false;
            this.authPromise = null;
            resolve({ success: false, error: 'Timeout authentification (5 minutes)' });
          }
        }, 5 * 60 * 1000);

        const handleUrl = async (url) => {
          if (isProcessing || windowClosed) return;

          // Ignore Microsoft error pages and redirects
          if (url.includes('login.live.com/oauth20_desktop.srf') && !url.includes('code=')) {
            return;
          }

          if (url.includes('code=') || url.includes('error=')) {
            isProcessing = true;
            clearTimeout(timeout);

            if (this.authWindow && !this.authWindow.isDestroyed()) {
              windowClosed = true;
              this.authWindow.close();
              this.authWindow = null;
            }

            try {
              const urlParams = new URL(url);
              const code = urlParams.searchParams.get('code');
              const error = urlParams.searchParams.get('error');
              const errorDescription = urlParams.searchParams.get('error_description');

              if (error) {
                console.error('❌ Authentication error:', errorDescription || error);
                this.authInProgress = false;
                this.authPromise = null;
                resolve({
                  success: false,
                  error: errorDescription || 'Authentication cancelled'
                });
                return;
              }

              if (code) {
                console.log('✅ Authorization code received');
                const result = await this.completeAuthFlow(code);
                this.authInProgress = false;
                this.authPromise = null;
                resolve(result);
              }
            } catch (error) {
              this.authInProgress = false;
              this.authPromise = null;
              console.error('❌ Error in handleUrl:', error.message);
              resolve({ success: false, error: error.message });
            }
          }
        };

        // Utiliser seulement will-redirect pour éviter les doubles déclenchements
        this.authWindow.webContents.on('will-redirect', (event, url) => handleUrl(url));

        this.authWindow.on('closed', () => {
          clearTimeout(timeout);
          this.authWindow = null;
          if (!isProcessing) {
            this.authInProgress = false;
            this.authPromise = null;
            resolve({ success: false, error: 'Authentication window closed' });
          }
        });

        this.authWindow.webContents.on('crashed', () => {
          clearTimeout(timeout);
          this.authWindow = null;
          this.authInProgress = false;
          this.authPromise = null;
          resolve({ success: false, error: 'Window crashed' });
        });

      } catch (error) {
        this.authWindow = null;
        this.authInProgress = false;
        this.authPromise = null;
        console.error('❌ Authentication error:', error);
        resolve({ success: false, error: error.message });
      }
    });

    return this.authPromise;
  }

  async completeAuthFlow(code) {
    try {
      console.log('📋 Step 1: Exchanging code for tokens...');
      const tokens = await this.exchangeCodeForTokens(code);
      if (!tokens?.access_token) {
        return { success: false, error: 'Unable to get access token' };
      }
      console.log('✅ Microsoft tokens obtained');

      console.log('📋 Step 2: Xbox Live authentication...');
      const xboxToken = await this.authenticateXbox(tokens.access_token);
      if (!xboxToken) {
        return { success: false, error: 'Xbox Live authentication error' };
      }
      console.log('✅ Xbox token obtained');

      console.log('📋 Step 3: Getting XSTS token...');
      const xstsToken = await this.authenticateXSTS(xboxToken);
      if (!xstsToken?.token) {
        return { success: false, error: 'XSTS token error' };
      }
      console.log('✅ XSTS token obtained');

      console.log('📋 Step 4: Minecraft authentication...');
      // ✅ mc = { access_token, expires_in }
      const mc = await this.authenticateMinecraft(xstsToken);
      if (!mc?.access_token) {
        return { success: false, error: 'Minecraft token error' };
      }
      console.log('✅ Minecraft token obtained');

      console.log('📋 Step 5: Getting Minecraft profile...');
      const profile = await this.getMinecraftProfile(mc.access_token);
      if (!profile?.name || !profile?.id) {
        return {
          success: false,
          error:
            'No Minecraft profile found.\n\n⚠️ Make sure you have purchased Minecraft Java Edition on your Microsoft account.'
        };
      }
      console.log('✅ Profile found:', profile.name);

      // ✅ SAVE DATA
      const existing = this.store.get('authData') || {};
      const clientToken = existing.clientToken || crypto.randomUUID();

      const authData = {
        type: 'microsoft',
        username: profile.name,
        uuid: profile.id, // 32 chars sans tirets (normal via API)
        accessToken: mc.access_token, // ✅ token Minecraft services
        refreshToken: tokens.refresh_token,
        // ✅ expiration du token Minecraft (fallback 24h si expires_in manquant)
        expiresAt: Date.now() + ((mc.expires_in || 24 * 3600) * 1000),
        clientToken, // ✅ stable
        profile: profile,
        connectedAt: new Date().toISOString()
      };

      console.log('💾 [completeAuthFlow] SAVING authData to store:');
      console.log('   - username:', authData.username);
      console.log('   - uuid:', authData.uuid);
      console.log('   - accessToken:', authData.accessToken.substring(0, 20) + '...');
      console.log('   - refreshToken:', authData.refreshToken ? authData.refreshToken.substring(0, 20) + '...' : 'NULL');
      console.log('   - expiresAt:', new Date(authData.expiresAt).toISOString());
      console.log('   - clientToken:', authData.clientToken);

      this.store.set('authData', authData);
      console.log('✅ [completeAuthFlow] authData saved to store');
      
      // Vérifier que c'est bien sauvegardé
      const verify = this.store.get('authData');
      console.log('✅ [completeAuthFlow] VERIFICATION - authData retrieved from store:', verify ? `${verify.username} (${verify.uuid})` : 'NULL');
      
      this.tokenCache = authData;

      console.log('🎉 Authentication successful!');
      return { success: true, data: authData };

    } catch (error) {
      console.error('❌ Authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ÉCHANGER LE CODE POUR LES TOKENS (AVEC RETRY ROBUSTE)
   */
  async exchangeCodeForTokens(code, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('https://login.live.com/oauth20_token.srf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json'
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectUri,
            scope: 'XboxLive.signin offline_access'
          }).toString(),
          timeout: 10000
        });

        const data = await response.json();

        if (!response.ok || !data.access_token) {
          console.error(`⚠️ Tentative ${i + 1}/${retries}:`, data.error || 'Erreur inconnue');
          if (i < retries - 1) {
            await this.delay(Math.pow(2, i) * 1000);
            continue;
          }
          throw new Error(data.error_description || 'Erreur lors de l\'échange du code');
        }

        return data;
      } catch (error) {
        console.error(`⚠️ Tentative ${i + 1}/${retries} - Erreur:`, error.message);
        if (i < retries - 1) {
          await this.delay(Math.pow(2, i) * 1000);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Impossible d\'obtenir les tokens Microsoft');
  }

  /**
   * ✅ RAFRAÎCHIR LE TOKEN AUTOMATIQUEMENT
   */
  async refreshAccessToken() {
    try {
      const authData = this.store.get('authData');

      if (!authData?.refreshToken) {
        console.error('❌ Pas de refresh token disponible');
        this.store.delete('authData');
        return null;
      }

      console.log('🔄 Refreshing access token...');

      const response = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          refresh_token: authData.refreshToken,
          grant_type: 'refresh_token',
          redirect_uri: this.redirectUri,
          scope: 'XboxLive.signin offline_access'
        }).toString(),
        timeout: 10000
      });

      const data = await response.json();

      if (!response.ok || !data.access_token) {
        console.error('❌ Refresh failed:', data.error, data.error_description || '');
        const invalidGrant = ['invalid_grant', 'invalid_request', 'invalid_token', 'interaction_required'];
        if (data.error && invalidGrant.includes(data.error)) {
          this.store.delete('authData');
        }
        return null;
      }

      // ✅ RÉAUTHENTIFIER LA CHAÎNE COMPLÈTE
      const xboxToken = await this.authenticateXbox(data.access_token);
      if (!xboxToken) {
        console.error('❌ Erreur Xbox lors du refresh');
        return null;
      }

      const xstsToken = await this.authenticateXSTS(xboxToken);
      if (!xstsToken?.token) {
        console.error('❌ Erreur XSTS lors du refresh');
        return null;
      }

      const mc = await this.authenticateMinecraft(xstsToken);
      if (!mc?.access_token) {
        console.error('❌ Erreur Minecraft lors du refresh');
        return null;
      }

      // ✅ METTRE À JOUR LES DONNÉES
      authData.accessToken = mc.access_token;
      authData.refreshToken = data.refresh_token || authData.refreshToken;
      authData.expiresAt = Date.now() + ((mc.expires_in || 24 * 3600) * 1000);  // Fallback 24h

      // clientToken stable
      if (!authData.clientToken) authData.clientToken = crypto.randomUUID();

      this.store.set('authData', authData);
      this.tokenCache = authData;

      console.log('✅ Token refreshed successfully');
      return mc.access_token;

    } catch (error) {
      console.error('❌ Erreur refresh token:', error.message);
      return null;
    }
  }

  /**
   * ✅ VÉRIFIER ET RAFRAÎCHIR SI NÉCESSAIRE
   */
  async ensureValidToken() {
    const authData = this.store.get('authData');

    if (!authData) {
      console.warn('⚠️ No authentication data');
      return null;
    }

    const now = Date.now();
    const expiresAt = authData.expiresAt || 0;
    const isExpired = expiresAt && now >= expiresAt;
    const isNearExpiry = expiresAt && (expiresAt - now <= 5 * 60 * 1000);

    // Si le token a expiré, on doit tenter un refresh.
    if (!authData.accessToken || isExpired || isNearExpiry) {
      console.log('⏰ Token expiration approaching / token manquant, refreshing...');
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        this.tokenCache = this.store.get('authData');
        return refreshed;
      }

      // Si le refresh échoue mais que le token actuel est encore valide, on l'utilise.
      if (authData.accessToken && !isExpired) {
        console.warn('⚠️ Refresh failed but current token is still valid, keeping existing session');
        return authData.accessToken;
      }

      return null;
    }

    return authData.accessToken;
  }

  /**
   * ✅ AUTHENTIFIER XBOX LIVE
   */
  async authenticateXbox(accessToken, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'x-xbl-contract-version': '1'
          },
          body: JSON.stringify({
            Properties: {
              AuthMethod: 'RPS',
              SiteName: 'user.auth.xboxlive.com',
              RpsTicket: `d=${accessToken}`
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT'
          }),
          timeout: 10000
        });

        const data = await response.json();

        if (!response.ok || !data.Token) {
          console.error(`⚠️ Xbox tentative ${i + 1}/${retries}:`, data.XErr || 'Erreur inconnue');
          if (i < retries - 1) {
            await this.delay(Math.pow(2, i) * 500);
            continue;
          }
          throw new Error(data.Message || 'Erreur Xbox Live');
        }

        return data.Token;
      } catch (error) {
        console.error(`⚠️ Xbox tentative ${i + 1}/${retries}:`, error.message);
        if (i < retries - 1) {
          await this.delay(Math.pow(2, i) * 500);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Impossible d\'authentifier Xbox Live');
  }

  /**
   * ✅ AUTHENTIFIER XSTS
   */
  async authenticateXSTS(xboxToken, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'x-xbl-contract-version': '1'
          },
          body: JSON.stringify({
            Properties: {
              SandboxId: 'RETAIL',
              UserTokens: [xboxToken]
            },
            RelyingParty: 'rp://api.minecraftservices.com/',
            TokenType: 'JWT'
          }),
          timeout: 10000
        });

        const data = await response.json();

        if (!response.ok || !data.Token) {
          console.error(`⚠️ XSTS tentative ${i + 1}/${retries}:`, data.XErr || 'Erreur inconnue');
          if (i < retries - 1) {
            await this.delay(Math.pow(2, i) * 500);
            continue;
          }
          throw new Error(data.Message || 'Erreur XSTS');
        }

        return {
          token: data.Token,
          uhs: data.DisplayClaims.xui[0].uhs
        };
      } catch (error) {
        console.error(`⚠️ XSTS tentative ${i + 1}/${retries}:`, error.message);
        if (i < retries - 1) {
          await this.delay(Math.pow(2, i) * 500);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Impossible d\'obtenir le token XSTS');
  }

  /**
   * ✅ AUTHENTIFIER MINECRAFT
   * Retourne { access_token, expires_in }
   */
  async authenticateMinecraft(xstsData, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          body: JSON.stringify({
            identityToken: `XBL3.0 x=${xstsData.uhs};${xstsData.token}`
          }),
          timeout: 10000
        });

        const data = await response.json();

        if (!response.ok || !data.access_token) {
          console.error(`⚠️ Minecraft tentative ${i + 1}/${retries}:`, data.error || 'Erreur inconnue');
          if (i < retries - 1) {
            await this.delay(Math.pow(2, i) * 500);
            continue;
          }
          throw new Error(data.errorMessage || data.error_message || 'Erreur Minecraft');
        }

        return {
          access_token: data.access_token,
          expires_in: data.expires_in
        };

      } catch (error) {
        console.error(`⚠️ Minecraft tentative ${i + 1}/${retries}:`, error.message);
        if (i < retries - 1) {
          await this.delay(Math.pow(2, i) * 500);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Impossible d\'authentifier Minecraft');
  }

  /**
   * ✅ OBTENIR LE PROFIL MINECRAFT
   */
  async getMinecraftProfile(mcToken, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('https://api.minecraftservices.com/minecraft/profile', {
          headers: {
            'Authorization': `Bearer ${mcToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json'
          },
          timeout: 10000
        });

        if (!response.ok) {
          console.error(`⚠️ Profil tentative ${i + 1}/${retries} - Status: ${response.status}`);
          if (i < retries - 1) {
            await this.delay(Math.pow(2, i) * 500);
            continue;
          }
          throw new Error(`Erreur HTTP ${response.status}`);
        }

        const profile = await response.json();

        if (!profile.name || !profile.id) {
          throw new Error('Profil invalide - données manquantes');
        }

        console.log('✅ Profil Minecraft:', profile.name);
        return profile;
      } catch (error) {
        console.error(`⚠️ Profil tentative ${i + 1}/${retries}:`, error.message);
        if (i < retries - 1) {
          await this.delay(Math.pow(2, i) * 500);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Impossible d\'obtenir le profil Minecraft');
  }

  /**
   * ✅ UTILITAIRE - DÉLAI
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MicrosoftAuth;
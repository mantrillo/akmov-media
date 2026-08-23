/**
 * VALLE GEEK OVERLAY ENGINE (app.js)
 * Sincronización en tiempo real vía BroadcastChannel y LocalStorage
 * Canal: vallegeek_overlay_channel
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'vallegeek_overlay_config_v1';
  const CHANNEL_NAME = 'vallegeek_overlay_channel';

  const DEFAULT_CONFIG = {
    streamerName: 'VALLE GEEK',
    subtitle: 'CULTURA POP • GAMING • COMUNIDAD',
    tickerText: 'VALLE GEEK • CULTURA POP • GAMING • COMUNIDAD • VALLENAR • HUASCO • FREIRINA • ALTO DEL CARMEN',
    tickerSpeed: 35,
    statusStarting: 'YA COMENZAMOS',
    statusEnding: '¡NOS VEMOS PRONTO!',
    hostName: 'VALLE GEEK',
    guestName: 'INVITADO',
    logoType: 'image',
    logoImageUrl: 'assets/logo-horizontal.png',
    logoImageBase64: '',
    logoImageWidth: 560,
    logoImageMaxHeight: 240,
    camTitles: {
      cam1: 'CAM 1 - PRINCIPAL',
      cam2: 'CAM 2 - GAMEPLAY',
      cam3: 'CAM 3 - UNBOXING / TCG',
      cam4: 'CAM 4 - AMBIENTE'
    },
    timer: {
      durationMinutes: 5,
      remainingSeconds: 300,
      isRunning: false
    },
    socials: {
      instagram: { enabled: true, handle: 'vallegeek' },
      youtube: { enabled: true, handle: 'vallegeek' },
      tiktok: { enabled: true, handle: 'vallegeek' },
      twitch: { enabled: true, handle: 'vallegeek' },
      kick: { enabled: false, handle: 'vallegeek' }
    },
    chat: {
      enabled: true,
      simulation: false,
      apiBase: 'https://api.akmovmedia.com',
      webhookUrl: 'https://api.akmovmedia.com/owncast-webhook',
      streamUrl: 'https://stream.akmovmedia.com'
    },
    theme: {
      neonPrimary: '#00e5ff',
      neonSecondary: '#ff7b00',
      neonPurple: '#9d4edd',
      neonYellow: '#ffd166'
    },
    background: {
      mode: 'default', // 'default' | 'transparent'
      opacity: 1.0
    }
  };

  class ValleGeekEngine {
    constructor() {
      this.config = this.loadConfig();
      this.channel = null;
      this.listeners = [];
      this.chatListeners = [];
      this.timerInterval = null;

      this.initChannel();
      this.initUrlOverrides();
      this.applyThemeToCSS();
      this.initChatSimulator();
      this.connectLiveChatSources();

      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.config = JSON.parse(e.newValue);
            this.applyThemeToCSS();
            this.initChatSimulator();
            this.notifyListeners();
          } catch (err) {}
        }
      });

      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'CONFIG_UPDATE' && e.data.config) {
          this.config = { ...this.config, ...e.data.config };
          this.applyThemeToCSS();
          this.initChatSimulator();
          this.notifyListeners();
        }
      });
    }

    loadConfig() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
      } catch (e) {}
      return { ...DEFAULT_CONFIG };
    }

    saveConfig(updates = {}) {
      this.config = { ...this.config, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch (e) {}

      if (this.channel) {
        this.channel.postMessage({ type: 'CONFIG_UPDATE', config: this.config });
      }

      this.applyThemeToCSS();
      this.initChatSimulator();
      this.notifyListeners();
    }

    initChannel() {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (!event.data) return;
          if (event.data.type === 'CONFIG_UPDATE') {
            this.config = { ...this.config, ...event.data.config };
            this.applyThemeToCSS();
            this.notifyListeners();
          } else if (event.data.type === 'CHAT_MESSAGE') {
            this.notifyChatListeners(event.data.user, event.data.text);
          } else if (event.data.type === 'USER_JOINED') {
            this.notifyUserJoinedListeners(event.data.user);
          } else if (event.data.type === 'NAME_CHANGE') {
            this.notifyNameChangeListeners(event.data.oldName, event.data.newName);
          }
        };
      }
    }

    initUrlOverrides() {
      const params = new URLSearchParams(window.location.search);
      let changed = false;

      if (params.has('streamer')) { this.config.streamerName = params.get('streamer'); changed = true; }
      if (params.has('subtitle')) { this.config.subtitle = params.get('subtitle'); changed = true; }
      if (params.has('ticker')) { this.config.tickerText = params.get('ticker'); changed = true; }
      if (params.has('tickerspeed') || params.has('speed')) {
        const spd = parseInt(params.get('tickerspeed') || params.get('speed'), 10);
        if (!isNaN(spd) && spd > 0) {
          this.config.tickerSpeed = spd;
          changed = true;
        }
      }
      if (params.has('color')) { this.config.theme.neonPrimary = '#' + params.get('color').replace('#', ''); changed = true; }
      if (params.has('logowidth')) { this.config.logoImageWidth = parseInt(params.get('logowidth'), 10); changed = true; }
      if (params.has('logoheight')) { this.config.logoImageMaxHeight = parseInt(params.get('logoheight'), 10); changed = true; }
      if (params.has('bg')) {
        if (!this.config.background) this.config.background = {};
        this.config.background.mode = params.get('bg');
        changed = true;
      }

      // Check hash #cfg= base64
      try {
        if (window.location.hash && window.location.hash.includes('cfg=')) {
          const b64 = window.location.hash.split('cfg=')[1];
          if (b64) {
            const parsed = JSON.parse(decodeURIComponent(atob(b64)));
            this.config = { ...this.config, ...parsed };
            changed = true;
          }
        }
      } catch (e) {}

      if (changed) {
        this.applyThemeToCSS();
      }
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
        callback(this.config);
      }
    }

    notifyListeners() {
      this.listeners.forEach((cb) => {
        try { cb(this.config); } catch (e) {}
      });
    }

    onChatMessage(cb) {
      if (typeof cb === 'function') this.chatListeners.push(cb);
    }

    notifyChatListeners(user, text) {
      this.chatListeners.forEach((cb) => {
        try { cb(user, text); } catch (e) {}
      });
    }

    onUserJoined(cb) {
      this.userJoinedListeners = this.userJoinedListeners || [];
      if (typeof cb === 'function') this.userJoinedListeners.push(cb);
    }

    notifyUserJoinedListeners(user) {
      this.userJoinedListeners = this.userJoinedListeners || [];
      this.userJoinedListeners.forEach((cb) => {
        try { cb(user); } catch (e) {}
      });
    }

    onNameChange(cb) {
      this.nameChangeListeners = this.nameChangeListeners || [];
      if (typeof cb === 'function') this.nameChangeListeners.push(cb);
    }

    notifyNameChangeListeners(oldName, newName) {
      this.nameChangeListeners = this.nameChangeListeners || [];
      this.nameChangeListeners.forEach((cb) => {
        try { cb(oldName, newName); } catch (e) {}
      });
    }

    sendUserJoined(user) {
      if (!user) return;
      if (this.channel) {
        this.channel.postMessage({ type: 'USER_JOINED', user });
      }
      this.notifyUserJoinedListeners(user);
    }

    sendNameChange(oldName, newName) {
      if (!oldName || !newName) return;
      if (this.channel) {
        this.channel.postMessage({ type: 'NAME_CHANGE', oldName, newName });
      }
      this.notifyNameChangeListeners(oldName, newName);
    }

    sendChatMessage(user, text, isSimulated = false) {
      if (!user || !text) return;
      if (isSimulated && (!this.config?.chat?.enabled || this.config?.chat?.simulation !== true)) {
        return;
      }
      if (this.channel) {
        this.channel.postMessage({ type: 'CHAT_MESSAGE', user, text, isSimulated });
      }
      this.notifyChatListeners(user, text);
    }

    initChatSimulator() {
      if (this.chatSimInterval) {
        clearInterval(this.chatSimInterval);
        this.chatSimInterval = null;
      }

      const sampleUsers = ['Nerd_Huasco', 'Cosplay_Valle', 'PokemonGo_Vallenar', 'AnimeFan99', 'Gamer_Freirina', 'TCG_Master', 'RetroPixel', 'OtakuDelValle', 'AltoDelCarmenGeek', 'SwitchPlayer'];
      const sampleMsgs = [
        '¡Tremendo el torneo de Pokémon este finde en Vallenar! 🔥',
        '¿Qué opinan del nuevo anime de temporada?',
        '¡Saludos a toda la comunidad geek del Huasco! 🎮',
        '¿Cuándo sale la review del nuevo juego?',
        '¡Presente desde Freirina disfrutando Valle Geek!',
        'Esa partida estuvo de infarto ⚡',
        '¡Se viene el torneo de cartas TCG en Alto del Carmen!',
        '¡Tremendo el set y los overlays de Valle Geek!'
      ];

      this.chatSimInterval = setInterval(() => {
        if (this.config?.chat?.enabled && this.config?.chat?.simulation === true) {
          const u = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
          const m = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
          this.sendChatMessage(u, m, true);
        }
      }, 4200);
    }

    parseOwncastMessage(data) {
      if (!data) return null;
      let username = 'Usuario';
      let messageText = '';

      if (data.eventData) {
        if (data.eventData.user) {
          username = data.eventData.user.displayName || data.eventData.user.name || data.eventData.user.id || 'Usuario';
        }
        messageText = data.eventData.body || data.eventData.rawBody || data.eventData.message || '';
      } else {
        if (data.user && typeof data.user === 'object') {
          username = data.user.displayName || data.user.name || 'Usuario';
        } else if (typeof data.user === 'string') {
          username = data.user;
        } else if (data.username) {
          username = data.username;
        } else if (data.displayName) {
          username = data.displayName;
        }
        messageText = data.body || data.text || data.message || data.rawBody || '';
      }

      if (!messageText) return null;
      const cleanText = messageText.replace(/<[^>]*>?/gm, '').trim();
      if (!cleanText) return null;
      return { user: username, text: cleanText };
    }

    async getOwncastAccessToken(baseUrl) {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const storageKey = `owncast_token_${cleanBase}`;
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) return cached;
      } catch (e) {}

      try {
        const res = await fetch(`${cleanBase}/api/chat/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: 'ValleGeekOverlay' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.accessToken) {
            try { localStorage.setItem(storageKey, data.accessToken); } catch (e) {}
            return data.accessToken;
          }
        }
      } catch (err) {
        console.warn('[ValleGeek Chat] No se pudo registrar token en', cleanBase, err);
      }
      return null;
    }

    async connectLiveChatSources() {
      if (this.owncastConnecting) return;
      this.owncastConnecting = true;

      if (this.owncastWs) {
        try { this.owncastWs.close(); } catch (e) {}
        this.owncastWs = null;
      }
      if (this.owncastPollTimer) {
        clearInterval(this.owncastPollTimer);
        this.owncastPollTimer = null;
      }

      const chatCfg = this.config?.chat;
      if (!chatCfg || chatCfg.enabled === false) {
        this.owncastConnecting = false;
        return;
      }

      this.seenChatIds = this.seenChatIds || new Set();

      // Candidate URLs for Owncast
      const isHttpsPage = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
      const candidates = [];

      if (chatCfg.streamUrl) {
        candidates.push(chatCfg.streamUrl.trim());
      }
      candidates.push('https://stream.akmovmedia.com');

      // Only probe local IPs/ports if NOT running on an HTTPS web origin to prevent Mixed Content & Local Network prompts
      if (!isHttpsPage) {
        candidates.push('http://192.168.1.15:8080');
        candidates.push('http://localhost:8080');
        candidates.push('http://127.0.0.1:8080');
        if (typeof window !== 'undefined' && window.location && window.location.hostname) {
          candidates.push(`${window.location.protocol}//${window.location.hostname}:8080`);
          candidates.push(`${window.location.protocol}//${window.location.hostname}`);
        }
      }

      const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
      let connected = false;

      const tryConnectWs = async (baseUrl) => {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const token = await this.getOwncastAccessToken(cleanBase);

        return new Promise((resolve) => {
          try {
            let wsUrl = cleanBase.replace(/^http/, 'ws') + '/ws';
            if (token) {
              wsUrl += (wsUrl.includes('?') ? '&' : '?') + 'accessToken=' + encodeURIComponent(token);
            }
            const socket = new WebSocket(wsUrl);

            let timeout = setTimeout(() => {
              try { socket.close(); } catch (e) {}
              resolve(false);
            }, 3000);

            socket.onopen = () => {
              clearTimeout(timeout);
              this.owncastWs = socket;
              this.owncastConnected = true;
              this.activeOwncastUrl = cleanBase;
              this.notifyOwncastStatus(true, cleanBase);
              console.log('[ValleGeek Chat] Conectado exitosamente a Owncast:', wsUrl);
              this.fetchOwncastHistory(cleanBase, token);
              resolve(true);
            };

            socket.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.type === 'CHAT' || data.body || data.eventData) {
                  const id = data.id || (data.timestamp + (data.user?.displayName || ''));
                  if (id && this.seenChatIds.has(id)) return;
                  if (id) {
                    this.seenChatIds.add(id);
                    if (this.seenChatIds.size > 200) {
                      const first = this.seenChatIds.values().next().value;
                      this.seenChatIds.delete(first);
                    }
                  }
                  const parsed = this.parseOwncastMessage(data);
                  if (parsed) {
                    this.sendChatMessage(parsed.user, parsed.text);
                  }
                } else if (data.type === 'USER_JOINED') {
                  const user = data.user?.displayName || data.user?.name || data.eventData?.user?.displayName || data.body || 'Usuario';
                  this.sendUserJoined(user);
                } else if (data.type === 'NAME_CHANGE') {
                  const oldName = data.oldName || data.user?.previousNames?.[data.user?.previousNames?.length - 1] || 'Usuario';
                  const newName = data.newName || data.user?.displayName || 'Usuario';
                  this.sendNameChange(oldName, newName);
                }
              } catch (err) {}
            };

            socket.onerror = () => {
              clearTimeout(timeout);
              resolve(false);
            };

            socket.onclose = () => {
              clearTimeout(timeout);
              if (this.owncastWs === socket) {
                this.owncastWs = null;
                this.owncastConnected = false;
                this.notifyOwncastStatus(false, cleanBase);
                setTimeout(() => {
                  if (!this.owncastConnected) this.connectLiveChatSources();
                }, 4000);
              }
            };
          } catch (e) {
            resolve(false);
          }
        });
      };

      for (const url of uniqueCandidates) {
        const ok = await tryConnectWs(url);
        if (ok) {
          connected = true;
          break;
        }
      }

      this.owncastConnecting = false;

      // If WebSocket failed for all endpoints, start polling fallback
      if (!connected) {
        this.notifyOwncastStatus(false, uniqueCandidates[0]);
        this.startOwncastPolling(uniqueCandidates);
        setTimeout(() => {
          if (!this.owncastConnected) this.connectLiveChatSources();
        }, 6000);
      }
    }

    async fetchOwncastHistory(baseUrl, token = null) {
      try {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const authToken = token || await this.getOwncastAccessToken(cleanBase);
        let apiUrl = `${cleanBase}/api/chat`;
        if (authToken) apiUrl += '?accessToken=' + encodeURIComponent(authToken);

        const res = await fetch(apiUrl, { method: 'GET', mode: 'cors' });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.messages || []);
        
        // Render the last 4 recent messages if chat list is fresh
        const recent = list.slice(-4);
        recent.forEach((msg) => {
          const id = msg.id || (msg.timestamp + (msg.user?.displayName || ''));
          if (id && !this.seenChatIds.has(id)) {
            this.seenChatIds.add(id);
            const parsed = this.parseOwncastMessage(msg);
            if (parsed) {
              this.sendChatMessage(parsed.user, parsed.text);
            }
          } else if (id) {
            this.seenChatIds.add(id);
          }
        });
      } catch (e) {}
    }

    startOwncastPolling(candidates) {
      if (this.owncastPollTimer) clearInterval(this.owncastPollTimer);
      this.owncastPollTimer = setInterval(async () => {
        if (this.owncastConnected) {
          clearInterval(this.owncastPollTimer);
          return;
        }
        for (const baseUrl of candidates) {
          try {
            const cleanBase = baseUrl.replace(/\/+$/, '');
            const authToken = await this.getOwncastAccessToken(cleanBase);
            let apiUrl = `${cleanBase}/api/chat`;
            if (authToken) apiUrl += '?accessToken=' + encodeURIComponent(authToken);

            const res = await fetch(apiUrl, { method: 'GET', mode: 'cors' });
            if (res.ok) {
              const data = await res.json();
              const list = Array.isArray(data) ? data : (data.messages || []);
              list.forEach((msg) => {
                const id = msg.id || (msg.timestamp + (msg.user?.displayName || ''));
                if (id && !this.seenChatIds.has(id)) {
                  this.seenChatIds.add(id);
                  const parsed = this.parseOwncastMessage(msg);
                  if (parsed) {
                    this.sendChatMessage(parsed.user, parsed.text);
                  }
                }
              });
              this.notifyOwncastStatus(true, `${cleanBase} (HTTP)`);
              break;
            }
          } catch (e) {}
        }
      }, 2500);
    }

    notifyOwncastStatus(connected, url) {
      if (this.channel) {
        this.channel.postMessage({
          type: 'OWNCAST_STATUS',
          connected: connected,
          url: url
        });
      }
      if (this.statusListeners) {
        this.statusListeners.forEach((cb) => {
          try { cb(connected, url); } catch (e) {}
        });
      }
    }

    onOwncastStatus(cb) {
      this.statusListeners = this.statusListeners || [];
      if (typeof cb === 'function') {
        this.statusListeners.push(cb);
        if (this.owncastConnected !== undefined) {
          cb(this.owncastConnected, this.activeOwncastUrl || this.config?.chat?.streamUrl);
        }
      }
    }

    reconnectOwncast() {
      this.owncastConnected = false;
      this.connectLiveChatSources();
    }

    applyThemeToCSS() {
      const root = document.documentElement;
      if (!root) return;

      const primary = this.config.theme?.neonPrimary || '#00e5ff';
      const secondary = this.config.theme?.neonSecondary || '#ff7b00';
      const tickerSpeed = this.config.tickerSpeed || 35;

      root.style.setProperty('--neon-primary', primary);
      root.style.setProperty('--neon-secondary', secondary);
      root.style.setProperty('--border-neon', `${primary}55`);
      root.style.setProperty('--ticker-duration', `${tickerSpeed}s`);

      const rgb = this.hexToRgb(primary);
      if (rgb) {
        root.style.setProperty('--neon-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }

      // Transparent background enforcement
      if (this.config.background?.mode === 'transparent') {
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        document.querySelectorAll('.vallegeek-bg-layer, .vallegeek-overlay-tint').forEach((el) => {
          el.style.display = 'none';
        });
        const cvs = document.getElementById('bg-canvas');
        if (cvs) {
          cvs.style.display = 'none';
          cvs.style.opacity = '0';
        }
      } else {
        document.querySelectorAll('.vallegeek-bg-layer, .vallegeek-overlay-tint').forEach((el) => {
          el.style.display = 'block';
        });
        const cvs = document.getElementById('bg-canvas');
        if (cvs) cvs.style.display = 'block';
      }
    }

    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    // Hero / Header Logo Renderer
    renderHeroLogo(containerEl, customOpts = {}) {
      if (!containerEl) return;
      containerEl.innerHTML = '';

      const isHeader = customOpts.isHeader || containerEl.classList.contains('header-logo') || (containerEl.closest && (containerEl.closest('.v-geek-header') || containerEl.closest('.geek-frame-16x9') || containerEl.closest('header')));
      const isVerticalHero = (containerEl.closest && containerEl.closest('.v-geek-hero'));
      const width = customOpts.width || (isHeader ? 320 : (isVerticalHero ? Math.min(this.config.logoImageWidth || 480, 520) : (this.config.logoImageWidth || 560)));
      const maxHeight = customOpts.maxHeight || (isHeader ? 75 : (isVerticalHero ? Math.min(this.config.logoImageMaxHeight || 260, 280) : (this.config.logoImageMaxHeight || 240)));
      const imgSrc = this.config.logoImageBase64 || this.config.logoImageUrl || (isHeader ? 'assets/logo-horizontal.png' : 'assets/logo-emblem.png');

      if (this.config.logoType === 'image' && imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = this.config.streamerName || 'Valle Geek';
        img.style.maxWidth = `${width}px`;
        img.style.maxHeight = `${maxHeight}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.style.filter = isHeader
          ? 'drop-shadow(0 0 15px rgba(0, 229, 255, 0.45)) drop-shadow(0 0 25px rgba(255, 123, 0, 0.3))'
          : 'drop-shadow(0 0 25px rgba(0, 229, 255, 0.45)) drop-shadow(0 0 40px rgba(255, 123, 0, 0.3))';
        containerEl.appendChild(img);
      } else {
        const fontSize = isHeader ? '28px' : (isVerticalHero ? '68px' : '64px');
        containerEl.innerHTML = `<span style="font-family: var(--font-display); font-size: ${fontSize}; font-weight: 900; color: #fff; letter-spacing: 3px; text-shadow: 0 0 20px var(--neon-primary); text-transform: uppercase;">${this.config.streamerName || 'VALLE GEEK'}</span>`;
      }
    }

    // Social Bar Renderer
    renderSocialBar(containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML = '';

      const socials = this.config.socials || {};
      const wrap = document.createElement('div');
      wrap.className = 'geek-social-bar';

      const icons = {
        instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
        youtube: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        tiktok: '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>',
        twitch: '<svg viewBox="0 0 24 24"><path d="M2.149 0l-1.612 4.119v16.8h5.999v3.081h3.076l3.078-3.081h4.613l6.16-6.162v-14.757h-21.314zm19.243 13.714l-3.599 3.6h-4.615l-3.076 3.081v-3.081h-4.615v-15.429h15.905v11.829zm-8.723-7.714h2.057v6.171h-2.057v-6.171zm5.143 0h2.058v6.171h-2.058v-6.171z"/></svg>',
        kick: '<svg viewBox="0 0 24 24"><path d="M2.5 2h19v20h-19V2zm4 4v12h3.5v-3.5h2L15 18h4.5l-3.8-4.8 3.5-4.2H14.7L12 12.3V6H6.5z"/></svg>'
      };

      let count = 0;
      Object.keys(socials).forEach((key) => {
        const item = socials[key];
        if (item && item.enabled && item.handle) {
          count++;
          const el = document.createElement('div');
          el.className = 'geek-social-item';
          el.innerHTML = `${icons[key] || ''}<span>@${item.handle}</span>`;
          wrap.appendChild(el);
        }
      });

      if (count > 0) {
        containerEl.appendChild(wrap);
      }
    }

    // Timer Logic
    startTimer() {
      if (this.config.timer.isRunning) return;
      if (this.config.timer.remainingSeconds <= 0) {
        this.config.timer.remainingSeconds = (this.config.timer.durationMinutes || 5) * 60;
      }
      this.config.timer.isRunning = true;
      this.saveConfig();

      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.config.timer.remainingSeconds > 0) {
          this.config.timer.remainingSeconds--;
          this.saveConfig();
        } else {
          this.pauseTimer();
        }
      }, 1000);
    }

    pauseTimer() {
      this.config.timer.isRunning = false;
      clearInterval(this.timerInterval);
      this.saveConfig();
    }

    resetTimer(minutes = null) {
      this.pauseTimer();
      const mins = minutes !== null ? minutes : (this.config.timer.durationMinutes || 5);
      this.config.timer.durationMinutes = mins;
      this.config.timer.remainingSeconds = mins * 60;
      this.saveConfig();
    }

    formatTimer(totalSeconds) {
      const s = Math.max(0, totalSeconds || 0);
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Interactive Star Particle Background
    setupStarParticles(canvasId = 'bg-canvas') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      let w = canvas.width = window.innerWidth;
      let h = canvas.height = window.innerHeight;

      window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      });

      const stars = [];
      const numStars = 60;
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 2.5 + 0.8,
          speedY: Math.random() * 0.3 + 0.1,
          opacity: Math.random() * 0.8 + 0.2,
          color: Math.random() > 0.5 ? '#00e5ff' : '#ff7b00'
        });
      }

      function render() {
        ctx.clearRect(0, 0, w, h);
        stars.forEach((star) => {
          star.y -= star.speedY;
          if (star.y < 0) {
            star.y = h;
            star.x = Math.random() * w;
          }

          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = star.opacity;
          ctx.shadowBlur = 8;
          ctx.shadowColor = star.color;
          ctx.fill();
        });
        requestAnimationFrame(render);
      }
      render();
    }

    getExportableUrl(sceneFilename) {
      const origin = window.location.origin;
      const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
      const url = new URL(`${origin}${path}/${sceneFilename}`);
      const cfg = this.config;

      if (cfg.streamerName) url.searchParams.set('streamer', cfg.streamerName);
      if (cfg.subtitle) url.searchParams.set('subtitle', cfg.subtitle);
      if (cfg.tickerText) url.searchParams.set('ticker', cfg.tickerText);
      if (cfg.tickerSpeed) url.searchParams.set('tickerspeed', cfg.tickerSpeed);
      if (cfg.theme && cfg.theme.neonPrimary) url.searchParams.set('color', cfg.theme.neonPrimary.replace('#', ''));
      if (cfg.background && cfg.background.mode) url.searchParams.set('bg', cfg.background.mode);
      if (cfg.logoImageUrl) url.searchParams.set('logourl', cfg.logoImageUrl);
      if (cfg.chat && cfg.chat.streamUrl) url.searchParams.set('streamurl', cfg.chat.streamUrl);

      try {
        const cleanCfg = JSON.parse(JSON.stringify(cfg));
        const b64 = btoa(encodeURIComponent(JSON.stringify(cleanCfg)));
        url.hash = `cfg=${b64}`;
      } catch (e) {}

      return url.toString();
    }
  }

  window.valleGeekApp = new ValleGeekEngine();
})();

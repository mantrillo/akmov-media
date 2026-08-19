/**
 * RUEDAS & CANCHA OVERLAY ENGINE (app.js)
 * Sincronización en tiempo real vía BroadcastChannel y LocalStorage
 * Canal: ruedasycancha_overlay_channel
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ruedasycancha_overlay_config_v1';
  const CHANNEL_NAME = 'ruedasycancha_overlay_channel';

  const DEFAULT_CONFIG = {
    streamerName: 'RUEDAS & CANCHA',
    subtitle: 'DEPORTES URBANOS • MOTORES • VALLE DEL HUASCO',
    tickerText: 'RUEDAS & CANCHA • SKATE • BMX • FÚTBOL • BASKETBALL • ARTES MARCIALES • VALLENAR • HUASCO • FREIRINA • ALTO DEL CARMEN',
    statusStarting: 'YA COMENZAMOS',
    statusEnding: '¡NOS VEMOS EN LA PRÓXIMA FECHA!',
    hostName: 'RUEDAS & CANCHA',
    guestName: 'INVITADO ESPECIAL',
    logoType: 'image',
    logoImageUrl: 'assets/logo-horizontal.png',
    logoImageBase64: '',
    logoImageWidth: 540,
    logoImageMaxHeight: 220,
    camTitles: {
      cam1: 'CAM 1 - ESTUDIO',
      cam2: 'CAM 2 - PISTA / CANCHA',
      cam3: 'CAM 3 - COMENTARISTA',
      cam4: 'CAM 4 - AMBIENTE'
    },
    timer: {
      durationMinutes: 5,
      remainingSeconds: 300,
      isRunning: false
    },
    socials: {
      instagram: { enabled: true, handle: 'ruedasycancha' },
      youtube: { enabled: true, handle: 'ruedasycancha' },
      tiktok: { enabled: true, handle: 'ruedasycancha' },
      twitch: { enabled: true, handle: 'ruedasycancha' },
      kick: { enabled: false, handle: 'ruedasycancha' }
    },
    chat: {
      enabled: true,
      simulation: false,
      apiBase: 'https://api.akmovmedia.com',
      webhookUrl: 'https://api.akmovmedia.com/owncast-webhook',
      streamUrl: 'https://stream.akmovmedia.com'
    },
    theme: {
      neonPrimary: '#00b4d8',
      neonSecondary: '#ff6b00'
    }
  };

  class RuedasEngine {
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
        if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
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
          }
        };
      }
    }

    initUrlOverrides() {
      const params = new URLSearchParams(window.location.search);
      if (params.has('streamer')) this.config.streamerName = params.get('streamer');
      if (params.has('subtitle')) this.config.subtitle = params.get('subtitle');
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

      const sampleUsers = ['Skater_Huasco', 'BMX_Vallenar', 'Rally_Freirina', 'GolazoValle', 'Basket_Alto', 'Tuerca_Atacama', 'PasionDeportiva', 'DeportesHuasco', 'RuedasFan', 'Marcial_Valle'];
      const sampleMsgs = [
        '¡Tremendo trucazo en el skatepark de Vallenar! 🛹',
        '¿A qué hora empieza la final del campeonato?',
        '¡Aguante Ruedas & Cancha en vivo! ⚽',
        'Ese salto en BMX estuvo brutal 🔥',
        'Saludos a todo el equipo desde Huasco Puerto',
        '¡Gran cobertura del rally regional!',
        'Se viene partidazo este domingo en la cancha',
        '¡Excelente transmisión deportiva cabros!'
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

    async connectLiveChatSources() {
      const chatCfg = this.config?.chat;
      if (!chatCfg || !chatCfg.enabled) return;

      const apiBase = chatCfg.apiBase || 'https://api.akmovmedia.com';
      const webhookUrl = chatCfg.webhookUrl || `${apiBase}/owncast-webhook`;

      // 1. SSE from API
      if (typeof EventSource !== 'undefined') {
        const sseEndpoints = [
          `${webhookUrl}/events`,
          `${apiBase}/owncast-webhook/events`,
          `${apiBase}/alerts/stream`,
          `${apiBase}/chat/stream`,
          `${apiBase}/events`
        ];

        for (const endpoint of sseEndpoints) {
          try {
            const es = new EventSource(endpoint);
            es.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                const parsed = this.parseOwncastMessage(data);
                if (parsed) {
                  this.sendChatMessage(parsed.user, parsed.text);
                }
              } catch (e) {}
            };
            es.onerror = () => { es.close(); };
            break;
          } catch (e) {}
        }
      }

      // 2. Direct Owncast WebSocket
      try {
        if (chatCfg.streamUrl && typeof WebSocket !== 'undefined') {
          const wsUrl = chatCfg.streamUrl.replace(/^http/, 'ws') + '/ws';
          const ws = new WebSocket(wsUrl);
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              const parsed = this.parseOwncastMessage(data);
              if (parsed) {
                this.sendChatMessage(parsed.user, parsed.text);
              }
            } catch (e) {}
          };
        }
      } catch (e) {}
    }

    applyThemeToCSS() {
      const root = document.documentElement;
      if (!root) return;
      const primary = this.config.theme?.neonPrimary || '#00b4d8';
      const secondary = this.config.theme?.neonSecondary || '#ff6b00';
      root.style.setProperty('--neon-primary', primary);
      root.style.setProperty('--neon-secondary', secondary);
      root.style.setProperty('--border-neon', `${primary}55`);
    }

    renderHeroLogo(containerEl, customOpts = {}) {
      if (!containerEl) return;
      containerEl.innerHTML = '';

      const isHeader = customOpts.isHeader || containerEl.classList.contains('header-logo') || containerEl.classList.contains('sports-header-logo') || (containerEl.closest && (containerEl.closest('.v-sports-header') || containerEl.closest('header')));
      const isVerticalHero = (containerEl.closest && containerEl.closest('.v-sports-hero'));
      const width = customOpts.width || (isHeader ? 320 : (isVerticalHero ? Math.min(this.config.logoImageWidth || 480, 520) : (this.config.logoImageWidth || 540)));
      const maxHeight = customOpts.maxHeight || (isHeader ? 75 : (isVerticalHero ? Math.min(this.config.logoImageMaxHeight || 260, 280) : (this.config.logoImageMaxHeight || 220)));
      const imgSrc = this.config.logoImageBase64 || this.config.logoImageUrl || (isHeader ? 'assets/logo-horizontal.png' : 'assets/logo-emblem.png');

      if (this.config.logoType === 'image' && imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = this.config.streamerName || 'Ruedas & Cancha';
        img.style.maxWidth = `${width}px`;
        img.style.maxHeight = `${maxHeight}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.style.filter = isHeader
          ? 'drop-shadow(0 0 15px rgba(0, 180, 216, 0.45)) drop-shadow(0 0 20px rgba(255, 107, 0, 0.35))'
          : 'drop-shadow(0 0 25px rgba(0, 180, 216, 0.5)) drop-shadow(0 0 35px rgba(255, 107, 0, 0.4))';
        containerEl.appendChild(img);
      } else {
        const fontSize = isHeader ? '28px' : (isVerticalHero ? '68px' : '64px');
        containerEl.innerHTML = `<span style="font-family: var(--font-display); font-size: ${fontSize}; font-weight: 900; color: #fff; letter-spacing: 3px; text-shadow: 0 0 20px var(--neon-primary); text-transform: uppercase;">${this.config.streamerName || 'RUEDAS & CANCHA'}</span>`;
      }
    }

    renderSocialBar(containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML = '';
      const socials = this.config.socials || {};
      const wrap = document.createElement('div');
      wrap.className = 'sports-social-bar';

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
          el.className = 'sports-social-item';
          el.innerHTML = `${icons[key] || ''}<span>@${item.handle}</span>`;
          wrap.appendChild(el);
        }
      });
      if (count > 0) containerEl.appendChild(wrap);
    }

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

    getExportableUrl(sceneFilename) {
      const origin = window.location.origin;
      const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
      return `${origin}${path}/${sceneFilename}`;
    }
  }

  window.ruedasEngine = new RuedasEngine();
})();

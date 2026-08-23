/**
 * AKMOV MEDIA - OVERLAY ENGINE & SYNC CONTROLLER
 * Real-time state synchronization via BroadcastChannel & LocalStorage
 */

const CHANNEL_NAME = 'akmov_overlay_channel';
const STORAGE_KEY = 'akmov_overlay_config_v2';

// Default initial configuration with AKMOVMEDIA
const DEFAULT_CONFIG = {
  streamerName: "AKMOVMEDIA",
  subtitle: "STREAMING & MEDIA",
  statusStarting: "YA COMENZAMOS",
  statusEnding: "¡NOS VEMOS PRONTO!",
  tickerText: "YA COMENZAMOS",
  tickerSpeed: 35,
  
  // Program Logo Configuration
  logoType: "text", // "text" | "image"
  logoImageBase64: "",
  logoImageUrl: "",
  logoImageWidth: 380,
  logoImageMaxHeight: 340,

  // Scene Specific Names
  hostName: "AKMOVMEDIA",
  guestName: "INVITADO",
  camTitles: {
    cam1: "CAM 1 - PRINCIPAL",
    cam2: "CAM 2 - LATERAL",
    cam3: "CAM 3 - SETUP",
    cam4: "CAM 4 - AMBIENTE"
  },

  // Chat & Stream Integration
  chat: {
    enabled: true,
    simulation: false, // Por defecto inactivo para evitar spam automático en OBS a menos que se active
    apiBase: "https://api.akmovmedia.com",
    webhookUrl: "https://api.akmovmedia.com/owncast-webhook",
    streamUrl: "https://stream.akmovmedia.com",
    showInEndingScene: true,
    showInCamChatScene: true
  },
  background: {
    mode: "particles", // "particles" | "gradient" | "bricks" | "hacker" | "abstract" | "smoke" | "custom"
    customUrl: "",
    customType: "image", // "image" | "video"
    opacity: 1.0,
    speed: 1.0,
    blur: 0,
    brightness: 1.0,
    sceneOverrides: {
      "scene-ya-comenzamos.html": "default",
      "scene-nos-vemos-pronto.html": "default",
      "scene-escritorio.html": "transparent",
      "scene-reaccion.html": "default",
      "scene-reaccion-dual.html": "default",
      "scene-camara-chat.html": "default",
      "scene-invitado.html": "default",
      "scene-cam1.html": "default",
      "scene-cam2.html": "default",
      "scene-cam3.html": "default",
      "scene-cam4.html": "default",
      "overlay.html": "default"
    }
  },
  theme: {
    neonPrimary: "#00ff66",
    neonSecondary: "#0df576",
    bgDeep: "#050806",
    glowIntensity: 1.0,
    animSpeed: 1.0,
    particlesEnabled: true
  },
  timer: {
    durationMinutes: 5,
    remainingSeconds: 300,
    isRunning: false,
    targetTimestamp: null
  }
};

// Social media SVG icons
const SOCIAL_ICONS = {
  instagram: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>`,
  twitch: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`,
  kick: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.5 1h7.2v6.6l4.6-6.6h7.2l-6.8 9.3 7.3 12.7h-7.2l-5.1-9.2v9.2H2.5V1z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
};

class OverlayEngine {
  constructor() {
    this.config = this.loadConfig();
    this.broadcastChannel = null;
    this.timerInterval = null;
    
    this.initCommunication();
    this.initTimerEngine();
    this.applyThemeToCSS();
  }

  // Load config with deep fallback (URL Params > LocalStorage > Defaults)
  loadConfig() {
    let base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // 1. Try LocalStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        base = this.deepMerge(base, JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not load stored config from localStorage:", e);
    }

    // 2. Try URL Search Params & Hash (Guarantees OBS & file:/// compatibility)
    const urlConfig = this.loadConfigFromURL();
    if (urlConfig) {
      base = this.deepMerge(base, urlConfig);
    }

    return base;
  }

  // Parse config from URL parameters / hash (for OBS browser source & file:/// URLs)
  loadConfigFromURL() {
    try {
      const search = window.location.search;
      const hash = window.location.hash;
      const params = new URLSearchParams(search);
      let urlConfig = {};

      // Check for encoded JSON in ?cfg= or #cfg=
      let rawEncoded = params.get('cfg');
      if (!rawEncoded && hash && hash.startsWith('#cfg=')) {
        rawEncoded = hash.substring(5);
      }

      if (rawEncoded) {
        try {
          const jsonStr = decodeURIComponent(atob(rawEncoded));
          urlConfig = JSON.parse(jsonStr);
        } catch (e) {
          try {
            urlConfig = JSON.parse(decodeURIComponent(rawEncoded));
          } catch (e2) {}
        }
      }

      // Check discrete URL parameters
      if (params.has('streamer')) urlConfig.streamerName = params.get('streamer');
      if (params.has('host')) urlConfig.hostName = params.get('host');
      if (params.has('guest')) urlConfig.guestName = params.get('guest');
      if (params.has('subtitle')) urlConfig.subtitle = params.get('subtitle');
      if (params.has('ticker')) urlConfig.tickerText = params.get('ticker');
      if (params.has('tickerspeed') || params.has('speed')) {
        const spd = parseInt(params.get('tickerspeed') || params.get('speed'), 10);
        if (!isNaN(spd) && spd > 0) urlConfig.tickerSpeed = spd;
      }
      if (params.has('starting')) urlConfig.statusStarting = params.get('starting');
      if (params.has('ending')) urlConfig.statusEnding = params.get('ending');

      if (params.has('color')) {
        if (!urlConfig.theme) urlConfig.theme = {};
        const col = params.get('color');
        urlConfig.theme.neonPrimary = col.startsWith('#') ? col : `#${col}`;
      }

      if (params.has('bg')) {
        if (!urlConfig.background) urlConfig.background = {};
        urlConfig.background.mode = params.get('bg');
      }

      if (params.has('cam1') || params.has('cam2') || params.has('cam3') || params.has('cam4')) {
        if (!urlConfig.camTitles) urlConfig.camTitles = {};
        if (params.has('cam1')) urlConfig.camTitles.cam1 = params.get('cam1');
        if (params.has('cam2')) urlConfig.camTitles.cam2 = params.get('cam2');
        if (params.has('cam3')) urlConfig.camTitles.cam3 = params.get('cam3');
        if (params.has('cam4')) urlConfig.camTitles.cam4 = params.get('cam4');
      }

      if (params.has('timer')) {
        const m = parseInt(params.get('timer'), 10);
        if (!isNaN(m) && m > 0) {
          if (!urlConfig.timer) urlConfig.timer = {};
          urlConfig.timer.durationMinutes = m;
          urlConfig.timer.remainingSeconds = m * 60;
        }
      }

      if (params.has('minutes')) {
        const m = parseInt(params.get('minutes'), 10);
        if (!isNaN(m) && m > 0) {
          if (!urlConfig.timer) urlConfig.timer = {};
          urlConfig.timer.durationMinutes = m;
          urlConfig.timer.remainingSeconds = m * 60;
        }
      }

      if (params.has('chatsim')) {
        if (!urlConfig.chat) urlConfig.chat = {};
        const cs = params.get('chatsim');
        urlConfig.chat.simulation = (cs === '1' || cs === 'true');
      }
      if (params.has('chat')) {
        if (!urlConfig.chat) urlConfig.chat = {};
        const ch = params.get('chat');
        urlConfig.chat.enabled = (ch === '1' || ch === 'true');
      }

      // Logo URL parameters
      if (params.has('logotype')) urlConfig.logoType = params.get('logotype');
      if (params.has('logourl')) urlConfig.logoImageUrl = params.get('logourl');
      if (params.has('logowidth')) urlConfig.logoImageWidth = parseInt(params.get('logowidth'), 10);
      if (params.has('logoheight')) urlConfig.logoImageMaxHeight = parseInt(params.get('logoheight'), 10);

      return Object.keys(urlConfig).length > 0 ? urlConfig : null;
    } catch (err) {
      console.warn("Could not parse URL configuration:", err);
      return null;
    }
  }

  // Build a portable URL containing the complete customized state
  getExportableUrl(filename) {
    const base = new URL(filename, window.location.href);
    const cfg = this.config;

    // Set readable query parameters for OBS and debugging
    if (cfg.streamerName) base.searchParams.set('streamer', cfg.streamerName);
    if (cfg.hostName) base.searchParams.set('host', cfg.hostName);
    if (cfg.guestName) base.searchParams.set('guest', cfg.guestName);
    if (cfg.tickerText) base.searchParams.set('ticker', cfg.tickerText);
    if (cfg.tickerSpeed) base.searchParams.set('tickerspeed', cfg.tickerSpeed);
    if (cfg.statusStarting) base.searchParams.set('starting', cfg.statusStarting);
    if (cfg.statusEnding) base.searchParams.set('ending', cfg.statusEnding);
    if (cfg.theme && cfg.theme.neonPrimary) base.searchParams.set('color', cfg.theme.neonPrimary.replace('#', ''));
    if (cfg.background && cfg.background.mode) base.searchParams.set('bg', cfg.background.mode);

    if (cfg.logoType) base.searchParams.set('logotype', cfg.logoType);
    if (cfg.logoImageUrl) base.searchParams.set('logourl', cfg.logoImageUrl);
    if (cfg.logoImageWidth) base.searchParams.set('logowidth', cfg.logoImageWidth);
    if (cfg.logoImageMaxHeight) base.searchParams.set('logoheight', cfg.logoImageMaxHeight);

    if (cfg.chat) {
      base.searchParams.set('chat', cfg.chat.enabled !== false ? '1' : '0');
      base.searchParams.set('chatsim', cfg.chat.simulation === true ? '1' : '0');
    }

    // Encode full config (including optimized logo image) into #cfg= for standalone OBS loading
    try {
      const cleanCfg = JSON.parse(JSON.stringify(cfg));
      const b64 = btoa(encodeURIComponent(JSON.stringify(cleanCfg)));
      base.hash = `cfg=${b64}`;
    } catch (e) {
      console.warn("Could not encode config hash:", e);
    }

    return base.href;
  }

  saveConfig(newConfig) {
    this.config = this.deepMerge(this.config, newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
    this.broadcastUpdate();
    this.applyThemeToCSS();
  }

  resetToDefault() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {}
    this.broadcastUpdate();
    this.applyThemeToCSS();
  }

  deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  initCommunication() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'CONFIG_UPDATE') {
            this.config = event.data.config;
            this.applyThemeToCSS();
            this.notifyListeners();
          } else if (event.data && event.data.type === 'TIMER_SYNC') {
            this.config.timer = event.data.timer;
            this.notifyListeners();
          } else if (event.data && event.data.type === 'CHAT_MESSAGE') {
            if (event.data.isSimulated && (!this.config || !this.config.chat || !this.config.chat.enabled || this.config.chat.simulation !== true)) {
              return;
            }
            this.notifyChatListeners(event.data.user, event.data.text);
          } else if (event.data && event.data.type === 'USER_JOINED') {
            this.notifyUserJoinedListeners(event.data.user);
          } else if (event.data && event.data.type === 'NAME_CHANGE') {
            this.notifyNameChangeListeners(event.data.oldName, event.data.newName);
          } else if (event.data && event.data.type === 'OWNCAST_STATUS') {
            if (this.statusListeners) {
              this.statusListeners.forEach(fn => fn(event.data.connected, event.data.url));
            }
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    // Cross-window / iframe postMessage support
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CONFIG_UPDATE' && event.data.config) {
        this.config = this.deepMerge(this.config, event.data.config);
        this.applyThemeToCSS();
        this.notifyListeners();
        this.initChatSimulator();
      }
    });

    // Fallback for storage event across tabs/OBS
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          this.config = JSON.parse(e.newValue);
          this.applyThemeToCSS();
          this.notifyListeners();
          this.initChatSimulator();
        } catch (err) {}
      }
    });

    this.initChatSimulator();
    this.connectLiveChatSources();
  }

  // Convert Hex color to RGB string (e.g., #ff0055 -> "255, 0, 85")
  hexToRgb(hex) {
    if (!hex) return '0, 255, 102';
    hex = hex.replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (isNaN(num)) return '0, 255, 102';
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `${r}, ${g}, ${b}`;
  }

  // Dynamically update CSS variables across all scenes
  applyThemeToCSS() {
    const theme = (this.config && this.config.theme) ? this.config.theme : DEFAULT_CONFIG.theme;
    const primaryHex = theme.neonPrimary || '#00ff66';
    const primaryRgb = this.hexToRgb(primaryHex);
    const glowIntensity = theme.glowIntensity || 1.0;

    const root = document.documentElement;
    if (root && root.style) {
      root.style.setProperty('--neon-primary', primaryHex);
      root.style.setProperty('--neon-primary-rgb', primaryRgb);
      root.style.setProperty('--accent', primaryHex);
      root.style.setProperty('--border-neon', `rgba(${primaryRgb}, 0.5)`);
      root.style.setProperty('--border-subtle', `rgba(${primaryRgb}, 0.2)`);
      root.style.setProperty('--bg-glass', `rgba(${primaryRgb}, 0.04)`);
      root.style.setProperty('--glow-sm', `0 0 ${10 * glowIntensity}px rgba(${primaryRgb}, 0.4)`);
      root.style.setProperty('--glow-md', `0 0 ${20 * glowIntensity}px rgba(${primaryRgb}, 0.5), 0 0 ${40 * glowIntensity}px rgba(${primaryRgb}, 0.25)`);
      root.style.setProperty('--glow-lg', `0 0 ${30 * glowIntensity}px rgba(${primaryRgb}, 0.7), 0 0 ${60 * glowIntensity}px rgba(${primaryRgb}, 0.4)`);
      root.style.setProperty('--glow-text', `0 0 ${15 * glowIntensity}px rgba(${primaryRgb}, 0.6)`);
    }
  }

  // Chat message distribution
  chatListeners = [];
  userJoinedListeners = [];
  nameChangeListeners = [];

  onChatMessage(fn) {
    this.chatListeners.push(fn);
  }

  notifyChatListeners(user, text) {
    this.chatListeners = this.chatListeners || [];
    this.chatListeners.forEach(fn => {
      try { fn(user, text); } catch (e) { console.error('Error in chatListener:', e); }
    });
  }

  onUserJoined(fn) {
    this.userJoinedListeners = this.userJoinedListeners || [];
    this.userJoinedListeners.push(fn);
  }

  notifyUserJoinedListeners(user) {
    this.userJoinedListeners = this.userJoinedListeners || [];
    this.userJoinedListeners.forEach(fn => {
      try { fn(user); } catch (e) {}
    });
  }

  onNameChange(fn) {
    this.nameChangeListeners = this.nameChangeListeners || [];
    this.nameChangeListeners.push(fn);
  }

  notifyNameChangeListeners(oldName, newName) {
    this.nameChangeListeners = this.nameChangeListeners || [];
    this.nameChangeListeners.forEach(fn => {
      try { fn(oldName, newName); } catch (e) {}
    });
  }

  sendChatMessage(user, text, isSimulated = false) {
    if (!user || !text) return;
    if (isSimulated && (!this.config || !this.config.chat || !this.config.chat.enabled || this.config.chat.simulation !== true)) {
      return;
    }
    this.notifyChatListeners(user, text);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'CHAT_MESSAGE',
          user: user,
          text: text,
          isSimulated: isSimulated
        });
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'CHAT_MESSAGE', user, text, isSimulated }, '*'); } catch (e) {}
      }
      document.querySelectorAll('iframe').forEach(ifr => {
        try { ifr.contentWindow?.postMessage({ type: 'CHAT_MESSAGE', user, text, isSimulated }, '*'); } catch (e) {}
      });
    }
  }

  sendUserJoined(user) {
    if (!user) return;
    this.notifyUserJoinedListeners(user);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'USER_JOINED',
          user: user
        });
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'USER_JOINED', user }, '*'); } catch (e) {}
      }
      document.querySelectorAll('iframe').forEach(ifr => {
        try { ifr.contentWindow?.postMessage({ type: 'USER_JOINED', user }, '*'); } catch (e) {}
      });
    }
  }

  sendNameChange(oldName, newName) {
    if (!oldName || !newName) return;
    this.notifyNameChangeListeners(oldName, newName);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'NAME_CHANGE',
          oldName: oldName,
          newName: newName
        });
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'NAME_CHANGE', oldName, newName }, '*'); } catch (e) {}
      }
      document.querySelectorAll('iframe').forEach(ifr => {
        try { ifr.contentWindow?.postMessage({ type: 'NAME_CHANGE', oldName, newName }, '*'); } catch (e) {}
      });
    }
  }

  notifyOwncastStatus(connected, url) {
    this.owncastConnected = connected;
    this.activeOwncastUrl = url;
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'OWNCAST_STATUS',
          connected: connected,
          url: url
        });
      } catch (e) {}
    }
    if (this.statusListeners) {
      this.statusListeners.forEach((cb) => {
        try { cb(connected, url); } catch (e) {}
      });
    }
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'OWNCAST_STATUS', connected, url }, '*'); } catch (e) {}
      }
      document.querySelectorAll('iframe').forEach(ifr => {
        try { ifr.contentWindow?.postMessage({ type: 'OWNCAST_STATUS', connected, url }, '*'); } catch (e) {}
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

  // Simulated live chat pool
  initChatSimulator() {
    if (this.chatSimInterval) {
      clearInterval(this.chatSimInterval);
      this.chatSimInterval = null;
    }

    const sampleUsers = ['Matias_H', 'Vallenar_Gamer', 'Koke_Radio', 'AtacamaStreamer', 'Fran_V', 'HuascoMax', 'GamerRetro', 'CyberBrutal', 'Lucas_CL', 'Valen_Tech'];
    const sampleMsgs = [
      '¡Excelente transmisión cabros! 🔥',
      '¿De qué parte transmiten hoy?',
      'Se escucha filete la señal HD 🎧',
      '¡Aguante AKMOV MEDIA!',
      'Mandame un saludo en la próxima pausa please',
      '¡Tremendo diseño cyberpunk verde neón!',
      '¿A qué hora empieza el torneo?',
      '¡Muy buena vibra gente!'
    ];

    this.chatSimInterval = setInterval(() => {
      if (this.config && this.config.chat && this.config.chat.enabled && this.config.chat.simulation === true) {
        const u = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
        const m = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        this.sendChatMessage(u, m, true);
      }
    }, 4500);
  }

  // Parse Owncast Webhook & API Payloads
  parseOwncastMessage(data) {
    if (!data) return null;
    let username = 'Usuario';
    let messageText = '';

    // Standard Owncast Webhook: { type: "CHAT", eventData: { user: { displayName: "..." }, body: "..." } }
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

    // Sanitize HTML tags from Owncast rich text format
    const cleanText = messageText.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText) return null;

    return { user: username, text: cleanText };
  }

  async getOwncastAccessToken(baseUrl) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanBase}/api/chat/register`, {
        method: 'POST',
        body: JSON.stringify({ displayName: 'AkmovOverlay' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.accessToken) {
          console.log('[AKMOV Chat] Token de chat obtenido correctamente');
          return data.accessToken;
        }
      }
    } catch (err) {
      console.warn('[AKMOV Chat] Error obteniendo token:', err);
    }
    return null;
  }

  // Live Owncast WebSocket connection
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

    // Only probe local IPs/ports if NOT running on an HTTPS web origin
    if (!isHttpsPage) {
      candidates.push('http://192.168.1.15:8080');
      candidates.push('http://localhost:8080');
      candidates.push('http://127.0.0.1:8080');
    }

    const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
    let connected = false;

    const tryConnectWs = async (baseUrl) => {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const token = await this.getOwncastAccessToken(cleanBase);
      let wsUrl = cleanBase.replace(/^http/, 'ws') + '/ws';
      if (token) {
        wsUrl += (wsUrl.includes('?') ? '&' : '?') + 'accessToken=' + encodeURIComponent(token);
      }

      return new Promise((resolve) => {
        try {
          const socket = new WebSocket(wsUrl);

          let timeout = setTimeout(() => {
            try { socket.close(); } catch (e) {}
            resolve(false);
          }, 4000);

          socket.onopen = () => {
            clearTimeout(timeout);
            this.owncastWs = socket;
            this.owncastConnected = true;
            this.activeOwncastUrl = cleanBase;
            this.notifyOwncastStatus(true, cleanBase);
            console.log('[AKMOV Chat] Conectado exitosamente a Owncast:', wsUrl);
            resolve(true);
          };

          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              const type = (data.type || '').toUpperCase();

              if (type === 'USER_JOINED' || type === 'USER_JOIN') {
                const user = data.user?.displayName || data.user?.name || data.eventData?.user?.displayName || data.body || 'Usuario';
                this.sendUserJoined(user);
              } else if (type === 'NAME_CHANGE' || type === 'NAME_CHANGED' || type === 'USER_NAME_CHANGED') {
                const oldName = data.oldName || data.user?.previousNames?.[data.user?.previousNames?.length - 1] || 'Usuario';
                const newName = data.newName || data.user?.displayName || 'Usuario';
                this.sendNameChange(oldName, newName);
              } else if (type === 'CHAT' || type === 'CHAT_MESSAGE' || data.body || data.eventData) {
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

    if (!connected) {
      this.notifyOwncastStatus(false, uniqueCandidates[0]);
      setTimeout(() => {
        if (!this.owncastConnected) this.connectLiveChatSources();
      }, 5000);
    }
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
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
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

  broadcastUpdate() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'CONFIG_UPDATE',
        config: this.config
      });
    }
    this.notifyListeners();
  }

  broadcastTimer() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'TIMER_SYNC',
        timer: this.config.timer
      });
    }
  }

  listeners = [];
  subscribe(fn) {
    this.listeners.push(fn);
    fn(this.config);
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn(this.config));
  }

  applyThemeToCSS() {
    // If we are on the Streamer Control Panel (streamer.html), protect the dashboard UI brand colors (Green)
    const isDashboard = typeof window !== 'undefined' && (
      window.location.pathname.endsWith('streamer.html') || 
      (document.body && document.body.classList.contains('streamer-dashboard')) || 
      document.getElementById('preview-frame')
    );

    if (isDashboard) {
      const iframe = document.getElementById('preview-frame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'CONFIG_UPDATE',
            config: this.config
          }, '*');
        } catch (e) {}
      }
      return;
    }

    const root = document.documentElement;
    const theme = this.config.theme;
    if (!theme) return;

    const primaryHex = theme.neonPrimary || "#00ff66";
    const rgb = this.hexToRgb(primaryHex) || { r: 0, g: 255, b: 102 };
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Primary Neon & RGB
    root.style.setProperty('--neon-primary', primaryHex);
    root.style.setProperty('--neon-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

    // Harmonic Secondary (Hue shifted by 30 degrees)
    const secondaryHue = (hsl.h + 0.08) % 1;
    const secondaryRgb = this.hslToRgb(secondaryHue, hsl.s, hsl.l);
    const secondaryHex = this.rgbToHex(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
    root.style.setProperty('--neon-secondary', secondaryHex);
    root.style.setProperty('--neon-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);

    // Glitch Counter Accent (Split complementary)
    const glitchHue = (hsl.h + 0.5) % 1;
    const glitchRgb = this.hslToRgb(glitchHue, 1, 0.55);
    root.style.setProperty('--glitch-secondary', this.rgbToHex(glitchRgb.r, glitchRgb.g, glitchRgb.b));

    // Dynamic Deep Background Tints
    const bgDarkHsl = this.hslToRgb(hsl.h, 0.35, 0.035);
    const bgMidHsl = this.hslToRgb(hsl.h, 0.4, 0.07);
    root.style.setProperty('--bg-deep-color', `rgb(${bgDarkHsl.r}, ${bgDarkHsl.g}, ${bgDarkHsl.b})`);
    root.style.setProperty('--bg-mid-color', `rgb(${bgMidHsl.r}, ${bgMidHsl.g}, ${bgMidHsl.b})`);
    root.style.setProperty('--bg-solid-gradient', `radial-gradient(circle at 50% 50%, rgb(${bgMidHsl.r}, ${bgMidHsl.g}, ${bgMidHsl.b}) 0%, rgb(${bgDarkHsl.r}, ${bgDarkHsl.g}, ${bgDarkHsl.b}) 65%, #020302 100%)`);

    // Dynamic Borders & Accents
    root.style.setProperty('--accent', primaryHex);
    root.style.setProperty('--border-neon', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    root.style.setProperty('--border-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    root.style.setProperty('--bg-glass', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)`);

    // Dynamic Panels & Ribbons
    const tickerSpeed = this.config.tickerSpeed || 35;
    root.style.setProperty('--ticker-duration', `${tickerSpeed}s`);
    root.style.setProperty('--ticker-bg-gradient', `linear-gradient(90deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22) 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06) 100%)`);
    root.style.setProperty('--social-capsule-bg', `linear-gradient(180deg, rgba(${Math.round(rgb.r*0.08)}, ${Math.round(rgb.g*0.08)}, ${Math.round(rgb.b*0.08)}, 0.94) 0%, rgba(2, 5, 3, 0.96) 100%)`);
    root.style.setProperty('--chat-box-bg', `linear-gradient(180deg, rgba(${Math.round(rgb.r*0.07)}, ${Math.round(rgb.g*0.07)}, ${Math.round(rgb.b*0.07)}, 0.88) 0%, rgba(3, 6, 4, 0.92) 100%)`);
    root.style.setProperty('--chat-bubble-bg', `rgba(${Math.round(rgb.r*0.12)}, ${Math.round(rgb.g*0.12)}, ${Math.round(rgb.b*0.12)}, 0.75)`);
    root.style.setProperty('--text-dim', `hsl(${Math.round(hsl.h * 360)}, 100%, 82%)`);

    // Glow intensity multiplier
    const glowScale = theme.glowIntensity || 1.0;
    root.style.setProperty('--glow-sm', `0 0 ${Math.round(10 * glowScale)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    root.style.setProperty('--glow-md', `0 0 ${Math.round(20 * glowScale)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 ${Math.round(40 * glowScale)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
    root.style.setProperty('--glow-lg', `0 0 ${Math.round(35 * glowScale)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8), 0 0 ${Math.round(70 * glowScale)}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);

    if (theme.animSpeed) {
      root.style.setProperty('--anim-speed', theme.animSpeed);
    }
  }

  // Color Utility Helpers
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  // Timer controls
  initTimerEngine() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.config.timer.isRunning && this.config.timer.targetTimestamp) {
        const now = Date.now();
        const diff = Math.max(0, Math.round((this.config.timer.targetTimestamp - now) / 1000));
        this.config.timer.remainingSeconds = diff;
        if (diff <= 0) {
          this.config.timer.isRunning = false;
        }
        this.notifyListeners();
      }
    }, 1000);
  }

  startTimer(minutes) {
    if (minutes !== undefined) {
      this.config.timer.durationMinutes = minutes;
      this.config.timer.remainingSeconds = minutes * 60;
    } else if (!this.config.timer.remainingSeconds || this.config.timer.remainingSeconds <= 0) {
      this.config.timer.remainingSeconds = (this.config.timer.durationMinutes || 5) * 60;
    }
    const duration = this.config.timer.remainingSeconds;
    this.config.timer.targetTimestamp = Date.now() + (duration * 1000);
    this.config.timer.isRunning = true;
    this.saveConfig(this.config);
    this.broadcastTimer();
  }

  pauseTimer() {
    if (this.config.timer.isRunning && this.config.timer.targetTimestamp) {
      const diff = Math.max(0, Math.round((this.config.timer.targetTimestamp - Date.now()) / 1000));
      this.config.timer.remainingSeconds = diff;
    }
    this.config.timer.isRunning = false;
    this.config.timer.targetTimestamp = null;
    this.saveConfig(this.config);
    this.broadcastTimer();
  }

  resetTimer(minutes) {
    const mins = minutes !== undefined ? minutes : this.config.timer.durationMinutes;
    this.config.timer.durationMinutes = mins;
    this.config.timer.remainingSeconds = mins * 60;
    this.config.timer.isRunning = false;
    this.config.timer.targetTimestamp = null;
    this.saveConfig(this.config);
    this.broadcastTimer();
  }

  formatTimer(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Render Program Logo Helper (Text or Image)
  renderHeroLogo(containerEl, customOpts = {}) {
    if (!containerEl) return;
    const config = this.config;
    let logoSrc = config.logoImageBase64 || config.logoImageUrl;
    if (config.logoType === 'image' && !logoSrc) {
      logoSrc = '../logo.svg';
    }

    const isHeader = customOpts.isHeader || 
      (containerEl.closest && (containerEl.closest('.v-header-branding') || containerEl.closest('.top-brand-pattern') || containerEl.closest('.header-branding') || containerEl.closest('.top-nav'))) || 
      containerEl.classList.contains('header-logo') || 
      containerEl.classList.contains('v-header-logo');

    const isVerticalHero = customOpts.isVerticalHero || (containerEl.closest && containerEl.closest('.v-center-hero'));

    if (config.logoType === 'image' && logoSrc) {
      let width, maxHeight;
      if (isHeader) {
        width = customOpts.width || 320;
        maxHeight = customOpts.maxHeight || 75;
      } else if (isVerticalHero) {
        width = customOpts.width || Math.min(config.logoImageWidth || 440, 520);
        maxHeight = customOpts.maxHeight || Math.min(config.logoImageMaxHeight || 260, 280);
      } else {
        width = customOpts.width || (config.logoImageWidth || 380);
        maxHeight = customOpts.maxHeight || (config.logoImageMaxHeight || 340);
      }

      containerEl.className = 'streamer-logo-img-wrapper' + (isHeader ? ' header-logo' : '');
      containerEl.style.fontSize = '';
      containerEl.innerHTML = `<img src="${logoSrc}" alt="Logo" class="streamer-logo-img" style="max-width: ${width}px; max-height: ${maxHeight}px; width: auto; height: auto; object-fit: contain; filter: drop-shadow(0 0 25px rgba(var(--neon-primary-rgb), 0.75)) drop-shadow(0 4px 15px rgba(0, 0, 0, 0.8)); display: block; margin: 0 auto;">`;
    } else {
      containerEl.className = 'streamer-logo-text' + (isHeader ? ' header-logo' : '');
      containerEl.style.fontSize = '';
      const name = config.streamerName !== undefined ? config.streamerName : "AKMOVMEDIA";
      if (!name || name.trim() === '') {
        containerEl.innerHTML = '';
      } else {
        containerEl.innerHTML = `${name}<span class="dot">.</span>`;
      }
    }
  }

  // Render Social Bar Helper
  renderSocialBar(containerEl) {
    if (!containerEl) return;
    const socials = this.config.socials;
    if (!socials) {
      containerEl.innerHTML = '';
      return;
    }
    const activeSocials = Object.keys(socials).filter(key => socials[key] && socials[key].enabled && socials[key].handle && socials[key].handle.trim() !== '');

    if (activeSocials.length === 0) {
      containerEl.innerHTML = '';
      return;
    }

    let html = `<div class="social-bar-capsule">`;
    activeSocials.forEach(platform => {
      const icon = SOCIAL_ICONS[platform] || '';
      const handle = socials[platform].handle;
      html += `
        <div class="social-badge">
          <div class="social-icon-wrapper">${icon}</div>
          <span class="social-handle">${handle}</span>
        </div>
      `;
    });
    html += `</div>`;
    containerEl.innerHTML = html;
  }

  // Render Ticker Ribbon Helper
  renderTicker(tickerTrackEl, text) {
    if (!tickerTrackEl) return;
    const rawText = text !== undefined ? text : (this.config.tickerText !== undefined ? this.config.tickerText : "YA COMENZAMOS");
    const displayText = (rawText || "").toUpperCase();
    if (!displayText.trim()) {
      tickerTrackEl.innerHTML = '';
      return;
    }
    const count = 14;
    let items = '';
    for (let i = 0; i < count; i++) {
      items += `<span class="ticker-item">${displayText}</span>`;
    }
    tickerTrackEl.innerHTML = items;
  }

  // Setup Dynamic Background System (Multi-mode: particles, gradient, bricks, hacker, abstract, smoke, custom)
  setupBackground(sceneKey, targetContainer) {
    let canvas = null;
    let container = targetContainer;

    if (!container) {
      // Find existing canvas or create/wrap container
      canvas = document.getElementById('bg-canvas');
      if (canvas) {
        container = canvas.parentElement;
      } else {
        container = document.body;
      }
    }

    if (!canvas) {
      canvas = container.querySelector('#bg-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'bg-canvas';
        canvas.className = 'overlay-canvas-bg';
        container.prepend(canvas);
      }
    }

    // Dynamic custom background layer (for images/videos)
    let customLayer = container.querySelector('.akmov-custom-bg-layer');
    if (!customLayer) {
      customLayer = document.createElement('div');
      customLayer.className = 'akmov-custom-bg-layer';
      container.insertBefore(customLayer, canvas);
    }

    // Auto-determine scene key from pathname if not supplied
    if (!sceneKey) {
      const path = window.location.pathname;
      sceneKey = path.substring(path.lastIndexOf('/') + 1) || 'default';
    }

    let currentAnimId = null;
    let lastRenderedMode = null;
    let state = {};

    const cleanup = () => {
      if (currentAnimId) {
        cancelAnimationFrame(currentAnimId);
        currentAnimId = null;
      }
    };

    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = 1920;
      canvas.height = 1080;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Main background render dispatch
    const update = (config) => {
      cleanup();

      const bgCfg = config.background || DEFAULT_CONFIG.background;
      let mode = bgCfg.mode || 'particles';

      // Check scene override
      if (bgCfg.sceneOverrides && bgCfg.sceneOverrides[sceneKey] && bgCfg.sceneOverrides[sceneKey] !== 'default') {
        mode = bgCfg.sceneOverrides[sceneKey];
      }

      const opacity = bgCfg.opacity !== undefined ? bgCfg.opacity : 1.0;
      const speed = bgCfg.speed !== undefined ? bgCfg.speed : 1.0;
      const blur = bgCfg.blur || 0;
      const brightness = bgCfg.brightness !== undefined ? bgCfg.brightness : 1.0;

      canvas.style.opacity = opacity;
      canvas.style.filter = `blur(${blur}px) brightness(${brightness})`;
      customLayer.style.opacity = opacity;
      customLayer.style.filter = `blur(${blur}px) brightness(${brightness})`;

      const rgb = this.hexToRgb(config.theme.neonPrimary || '#00ff66') || { r: 0, g: 255, b: 102 };
      const secRgb = this.hexToRgb(config.theme.neonSecondary || '#0df576') || { r: 13, g: 245, b: 118 };

      if (mode === 'transparent' || opacity === 0) {
        ctx.clearRect(0, 0, 1920, 1080);
        canvas.style.display = 'none';
        canvas.style.opacity = '0';
        customLayer.innerHTML = '';
        customLayer.style.display = 'none';
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        if (container) container.style.background = 'transparent';
        return;
      } else {
        canvas.style.display = 'block';
      }

      if (mode === 'custom') {
        ctx.clearRect(0, 0, 1920, 1080);
        customLayer.style.display = 'block';
        const url = bgCfg.customUrl || '';
        if (url) {
          if (bgCfg.customType === 'video' || url.match(/\.(mp4|webm|ogg)$/i)) {
            customLayer.innerHTML = `<video src="${url}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`;
          } else {
            customLayer.innerHTML = `<div style="width:100%;height:100%;background:url('${url}') center/cover no-repeat;"></div>`;
          }
        } else {
          customLayer.innerHTML = `<div style="width:100%;height:100%;background:radial-gradient(circle at 50% 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.15) 0%, #030604 100%);"></div>`;
        }
        return;
      } else {
        customLayer.innerHTML = '';
        customLayer.style.display = 'none';
      }

      // Initialize state if mode changed
      if (lastRenderedMode !== mode) {
        state = {};
        lastRenderedMode = mode;
      }

      // 1. PARTICLES MODE
      if (mode === 'particles') {
        if (!state.particles) {
          state.particles = [];
          for (let i = 0; i < 48; i++) {
            state.particles.push({
              x: Math.random() * 1920,
              y: Math.random() * 1080,
              size: Math.random() * 2.5 + 1,
              speedX: (Math.random() - 0.5) * 0.45,
              speedY: (Math.random() - 0.5) * 0.45,
              opacity: Math.random() * 0.55 + 0.25
            });
          }
        }

        const renderParticles = () => {
          ctx.clearRect(0, 0, 1920, 1080);

          // Draw connections
          for (let i = 0; i < state.particles.length; i++) {
            for (let j = i + 1; j < state.particles.length; j++) {
              const dx = state.particles[i].x - state.particles[j].x;
              const dy = state.particles[i].y - state.particles[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 140) {
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(1 - dist / 140) * 0.16})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(state.particles[i].x, state.particles[i].y);
                ctx.lineTo(state.particles[j].x, state.particles[j].y);
                ctx.stroke();
              }
            }
          }

          // Draw dots
          state.particles.forEach(p => {
            p.x += p.speedX * speed;
            p.y += p.speedY * speed;

            if (p.x < 0) p.x = 1920;
            if (p.x > 1920) p.x = 0;
            if (p.y < 0) p.y = 1080;
            if (p.y > 1080) p.y = 0;

            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
            ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
            ctx.shadowBlur = 9;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          });

          currentAnimId = requestAnimationFrame(renderParticles);
        };
        renderParticles();
      }

      // 2. GRADIENT EN MOVIMIENTO (Lissajous Aurora Mesh)
      else if (mode === 'gradient') {
        let t = 0;
        const renderGradient = () => {
          t += 0.008 * speed;
          ctx.clearRect(0, 0, 1920, 1080);

          // Deep base
          ctx.fillStyle = '#030604';
          ctx.fillRect(0, 0, 1920, 1080);

          // Blob 1 (Primary Neon)
          const x1 = 960 + Math.sin(t * 1.2) * 550;
          const y1 = 540 + Math.cos(t * 0.9) * 320;
          const grad1 = ctx.createRadialGradient(x1, y1, 50, x1, y1, 750);
          grad1.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
          grad1.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
          grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad1;
          ctx.fillRect(0, 0, 1920, 1080);

          // Blob 2 (Secondary Neon / Hue shifted)
          const x2 = 960 + Math.cos(t * 0.8) * 600;
          const y2 = 540 + Math.sin(t * 1.1) * 350;
          const grad2 = ctx.createRadialGradient(x2, y2, 40, x2, y2, 650);
          grad2.addColorStop(0, `rgba(${secRgb.r}, ${secRgb.g}, ${secRgb.b}, 0.28)`);
          grad2.addColorStop(0.6, `rgba(${secRgb.r}, ${secRgb.g}, ${secRgb.b}, 0.08)`);
          grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad2;
          ctx.fillRect(0, 0, 1920, 1080);

          // Blob 3 (Cyan/Glitch accent)
          const x3 = 960 + Math.sin(t * 1.5 + 2) * 450;
          const y3 = 540 + Math.cos(t * 1.3 + 1) * 280;
          const grad3 = ctx.createRadialGradient(x3, y3, 30, x3, y3, 500);
          grad3.addColorStop(0, `rgba(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 20)}, 255, 0.2)`);
          grad3.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad3;
          ctx.fillRect(0, 0, 1920, 1080);

          currentAnimId = requestAnimationFrame(renderGradient);
        };
        renderGradient();
      }

      // 3. LADRILLOS (Cyberpunk Neon Bricks Wall)
      else if (mode === 'bricks') {
        let sweepX = 0;
        const brickW = 100;
        const brickH = 44;
        const rows = Math.ceil(1080 / brickH) + 1;
        const cols = Math.ceil(1920 / brickW) + 2;

        const renderBricks = () => {
          sweepX = (sweepX + 2.2 * speed) % (1920 + 600);
          ctx.clearRect(0, 0, 1920, 1080);

          // Dark wall background
          ctx.fillStyle = '#040705';
          ctx.fillRect(0, 0, 1920, 1080);

          const lightCenter = sweepX - 300;

          // Draw brick grid
          for (let r = 0; r < rows; r++) {
            const offset = (r % 2 === 0) ? 0 : brickW / 2;
            for (let c = -1; c < cols; c++) {
              const bx = c * brickW + offset;
              const by = r * brickH;

              // Distance to sweeping spotlight
              const distLight = Math.abs((bx + brickW/2) - lightCenter);
              const lightFactor = Math.max(0, 1 - distLight / 650);

              // Brick Body
              ctx.fillStyle = `rgb(${Math.round(8 + lightFactor * rgb.r * 0.08)}, ${Math.round(12 + lightFactor * rgb.g * 0.08)}, ${Math.round(9 + lightFactor * rgb.b * 0.08)})`;
              ctx.fillRect(bx + 2, by + 2, brickW - 4, brickH - 4);

              // Neon Mortar / Joints
              ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.05 + lightFactor * 0.35})`;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(bx + 2, by + 2, brickW - 4, brickH - 4);

              // Subtle brick top highlight
              if (lightFactor > 0.3) {
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${lightFactor * 0.45})`;
                ctx.beginPath();
                ctx.moveTo(bx + 4, by + 4);
                ctx.lineTo(bx + brickW - 4, by + 4);
                ctx.stroke();
              }
            }
          }

          // Volumetric Neon Spotlight Cone
          const spotGrad = ctx.createRadialGradient(lightCenter, 540, 50, lightCenter, 540, 750);
          spotGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
          spotGrad.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`);
          spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = spotGrad;
          ctx.fillRect(0, 0, 1920, 1080);

          currentAnimId = requestAnimationFrame(renderBricks);
        };
        renderBricks();
      }

      // 4. MALLA TIPO HACKER (Cyber Matrix 3D Grid + Digital Rain Stream)
      else if (mode === 'hacker') {
        let gridOffset = 0;
        const matrixChars = '01AKMOVX9876543210ABCDEF<>$_#@!/\\{}[]';
        const columns = Math.floor(1920 / 32);
        if (!state.drops) {
          state.drops = [];
          for (let i = 0; i < columns; i++) {
            state.drops.push({
              y: Math.random() * -1080,
              speed: (Math.random() * 2.5 + 2.0) * speed,
              chars: []
            });
          }
        }

        const renderHacker = () => {
          gridOffset = (gridOffset + 1.8 * speed) % 50;
          ctx.clearRect(0, 0, 1920, 1080);

          // Deep cyberspace background
          ctx.fillStyle = '#020503';
          ctx.fillRect(0, 0, 1920, 1080);

          // 3D Perspective Ground Grid
          const horizonY = 560;
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`;
          ctx.lineWidth = 1.2;

          // Horizon line glow
          ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(0, horizonY);
          ctx.lineTo(1920, horizonY);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Vanishing Perspective Lines
          const vpX = 960;
          const numVp = 32;
          for (let i = -numVp; i <= numVp; i++) {
            const bottomX = vpX + i * 90;
            ctx.beginPath();
            ctx.moveTo(vpX, horizonY);
            ctx.lineTo(bottomX, 1080);
            ctx.stroke();
          }

          // Horizontal Moving Grid Lines (perspective scaling)
          for (let d = 0; d < 18; d++) {
            const ratio = ((d * 50 + gridOffset) % 520) / 520;
            const y = horizonY + Math.pow(ratio, 2.2) * (1080 - horizonY);
            const alpha = ratio * 0.45;
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1920, y);
            ctx.stroke();
          }

          // Digital Matrix Rain Streams (Upper/Full Space)
          ctx.font = '15px monospace';
          state.drops.forEach((drop, colIndex) => {
            drop.y += drop.speed * speed;
            if (drop.y > 1080) {
              drop.y = Math.random() * -300;
              drop.speed = (Math.random() * 2.5 + 2.0) * speed;
            }

            const x = colIndex * 32 + 8;
            for (let i = 0; i < 14; i++) {
              const charY = drop.y - (i * 18);
              if (charY > 0 && charY < 1080) {
                const char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                if (i === 0) {
                  // Head: Bright White/Neon
                  ctx.fillStyle = '#ffffff';
                  ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
                  ctx.shadowBlur = 10;
                  ctx.fillText(char, x, charY);
                  ctx.shadowBlur = 0;
                } else {
                  // Tail: Neon Fade
                  const alpha = Math.max(0, 1 - i / 14) * 0.65;
                  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
                  ctx.fillText(char, x, charY);
                }
              }
            }
          });

          currentAnimId = requestAnimationFrame(renderHacker);
        };
        renderHacker();
      }

      // 5. ABSTRACTO EN MOVIMIENTO (Hypnotic Kinetic Wave Ribbons & Warping Geometry)
      else if (mode === 'abstract') {
        let t = 0;
        const renderAbstract = () => {
          t += 0.012 * speed;
          ctx.clearRect(0, 0, 1920, 1080);

          ctx.fillStyle = '#030504';
          ctx.fillRect(0, 0, 1920, 1080);

          // Central pulsing rings
          const cx = 960, cy = 540;
          for (let r = 1; r <= 8; r++) {
            const radius = (r * 75 + Math.sin(t * 1.5 + r * 0.4) * 45) % 650;
            const alpha = Math.sin((radius / 650) * Math.PI) * 0.25;
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Oscillating Sine Wave Ribbons
          const numRibbons = 6;
          for (let w = 0; w < numRibbons; w++) {
            const phase = t + w * 0.6;
            const baseAmp = 90 + w * 25;
            const yBase = 220 + w * 120;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.12 + (w / numRibbons) * 0.35})`;
            ctx.lineWidth = 2.5;

            for (let x = 0; x <= 1920; x += 15) {
              const y = yBase + Math.sin(x * 0.0035 + phase) * baseAmp * Math.cos(t * 0.7 + x * 0.001);
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }

          // Floating neon glow accent
          const glowGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 550);
          glowGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(0, 0, 1920, 1080);

          currentAnimId = requestAnimationFrame(renderAbstract);
        };
        renderAbstract();
      }

      // 6. HUMOS (Volumetric Atmospheric Fog & Smoke Clusters)
      else if (mode === 'smoke') {
        if (!state.smokePuffs) {
          state.smokePuffs = [];
          for (let i = 0; i < 28; i++) {
            state.smokePuffs.push({
              x: Math.random() * 1920,
              y: Math.random() * 1080,
              radius: Math.random() * 220 + 160,
              speedX: (Math.random() - 0.5) * 0.35,
              speedY: -Math.random() * 0.45 - 0.15,
              alpha: Math.random() * 0.14 + 0.05,
              pulseSpeed: Math.random() * 0.015 + 0.005,
              angle: Math.random() * Math.PI * 2
            });
          }
        }

        const renderSmoke = () => {
          ctx.clearRect(0, 0, 1920, 1080);

          // Atmospheric deep backdrop
          ctx.fillStyle = '#040705';
          ctx.fillRect(0, 0, 1920, 1080);

          // Draw each drifting smoke puff
          state.smokePuffs.forEach(puff => {
            puff.x += puff.speedX * speed;
            puff.y += puff.speedY * speed;
            puff.angle += puff.pulseSpeed * speed;

            if (puff.y < -puff.radius) {
              puff.y = 1080 + puff.radius;
              puff.x = Math.random() * 1920;
            }
            if (puff.x < -puff.radius) puff.x = 1920 + puff.radius;
            if (puff.x > 1920 + puff.radius) puff.x = -puff.radius;

            const currentAlpha = puff.alpha * (0.8 + Math.sin(puff.angle) * 0.25);
            const grad = ctx.createRadialGradient(puff.x, puff.y, 10, puff.x, puff.y, puff.radius);
            grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentAlpha * 1.3})`);
            grad.addColorStop(0.5, `rgba(${Math.round(rgb.r * 0.6)}, ${Math.round(rgb.g * 0.8)}, ${Math.round(rgb.b * 0.6)}, ${currentAlpha * 0.5})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
            ctx.fill();
          });

          // Ambient low fog glow
          const lowFog = ctx.createLinearGradient(0, 700, 0, 1080);
          lowFog.addColorStop(0, 'rgba(0,0,0,0)');
          lowFog.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
          ctx.fillStyle = lowFog;
          ctx.fillRect(0, 700, 1920, 380);

          currentAnimId = requestAnimationFrame(renderSmoke);
        };
        renderSmoke();
      }
    };

    // Subscribe to config changes
    this.subscribe(update);
  }

  // Backward compatibility alias for setupParticles
  setupParticles(canvas) {
    this.setupBackground(null, canvas ? canvas.parentElement : null);
  }
}

// Global instance for all overlay pages
window.OverlayEngine = OverlayEngine;
window.overlayApp = new OverlayEngine();


document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 0. MAINTENANCE AND ROUTING SYSTEM
  // ==========================================
  const maintenanceScreen = document.getElementById('maintenanceScreen');
  const loginScreen = document.getElementById('loginScreen');
  const mainPortal = document.getElementById('mainPortal');
  const loginForm = document.getElementById('loginForm');
  const adminPassword = document.getElementById('adminPassword');
  const loginError = document.getElementById('loginError');

  // Open access to the main portal: hide maintenance and login views.
  function initPortalAccess() {
    if (maintenanceScreen) maintenanceScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainPortal) mainPortal.classList.remove('hidden');
    
    // Auto-play live video on page load
    setTimeout(() => {
      if (liveVideo && !isVideoPlaying) {
        isVideoPlaying = true;
        if (videoVolumeSlider) videoVolumeSlider.value = 0.3;
        initVideoStream();
        liveVideo.volume = 0.3;
        liveVideo.muted = false;
        if (mainVideoPlayer) mainVideoPlayer.classList.add('live-active');
        
        const iconPlayVideo = videoPlayPauseBtn ? videoPlayPauseBtn.querySelector('.icon-play') : null;
        const iconPauseVideo = videoPlayPauseBtn ? videoPlayPauseBtn.querySelector('.icon-pause') : null;
        const iconVolumeHighVideo = videoMuteBtn ? videoMuteBtn.querySelector('.icon-volume-high') : null;
        const iconVolumeMuteVideo = videoMuteBtn ? videoMuteBtn.querySelector('.icon-volume-mute') : null;

        if (iconPlayVideo) iconPlayVideo.classList.add('hidden');
        if (iconPauseVideo) iconPauseVideo.classList.remove('hidden');
        
        liveVideo.play().catch(err => {
          console.warn("Autoplay block: rendering with sound muted first", err);
          liveVideo.muted = true;
          isVideoMuted = true;
          if (iconVolumeHighVideo) iconVolumeHighVideo.classList.add('hidden');
          if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.remove('hidden');
          liveVideo.play().catch(e => console.error("Video play failed:", e));
        });
      }
    }, 600);
  }

  initPortalAccess();

  // ==========================================
  // MOBILE NAVIGATION TOGGLE (HAMBURGER)
  // ==========================================
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when clicking on any navigation link
    const navItems = navLinks.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('active')) {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }

  // ==========================================
  // 1. LIVE VIDEO PLAYER CONTROL SIMULATION
  // ==========================================
  const mainVideoPlayer = document.getElementById('mainVideoPlayer');
  const liveVideo = document.getElementById('liveVideo');
  const playerCover = document.getElementById('playerCover');
  const videoPlayPauseBtn = document.getElementById('videoPlayPauseBtn');
  const videoMuteBtn = document.getElementById('videoMuteBtn');
  const videoVolumeSlider = document.getElementById('videoVolumeSlider');
  const videoFullscreenBtn = document.getElementById('videoFullscreenBtn');
  const liveTimecode = document.getElementById('liveTimecode');
  
  const STREAM_URL = "https://stream.akmovmedia.com/hls/stream.m3u8";
  let hlsInstance = null;
  let isVideoPlaying = false;
  let isVideoMuted = false;
  let videoVolumeBeforeMute = 0.3;

  // Initialize HLS stream on play
  function initVideoStream() {
    if (!liveVideo || hlsInstance) return; // Already initialized or no video element

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        maxMaxBufferLength: 10,
        liveSyncDuration: 3,
        enableWorker: true
      });
      hlsInstance.loadSource(STREAM_URL);
      hlsInstance.attachMedia(liveVideo);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        liveVideo.play().catch(err => console.warn("Auto-play blocked or stream offline", err));
      });
      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("HLS Network Error, trying to recover...");
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("HLS Media Error, trying to recover...");
              hlsInstance.recoverMediaError();
              break;
            default:
              console.error("Fatal HLS Error, destroying instance");
              destroyVideoStream();
              break;
          }
        }
      });
    } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
      // Native iOS HLS support
      liveVideo.src = STREAM_URL;
      liveVideo.addEventListener('loadedmetadata', () => {
        liveVideo.play().catch(err => console.warn("Native auto-play blocked", err));
      });
    }
  }

  function destroyVideoStream() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    if (liveVideo) {
      liveVideo.src = "";
      liveVideo.load();
    }
  }

  // Toggle Video Play/Pause State
  function toggleVideoPlayback() {
    if (!liveVideo || !videoPlayPauseBtn || !videoMuteBtn) return;
    
    const iconPlayVideo = videoPlayPauseBtn.querySelector('.icon-play');
    const iconPauseVideo = videoPlayPauseBtn.querySelector('.icon-pause');
    const iconVolumeHighVideo = videoMuteBtn.querySelector('.icon-volume-high');
    const iconVolumeMuteVideo = videoMuteBtn.querySelector('.icon-volume-mute');
    
    isVideoPlaying = !isVideoPlaying;
    
    if (isVideoPlaying) {
      // Si la barra de audio inferior está sonando, pausarla inmediatamente
      if (isAudioPlaying) {
        pauseAudioPlayback();
      }

      initVideoStream();
      
      // Force unmute when initiating playback
      isVideoMuted = false;
      liveVideo.muted = false;
      
      if (videoVolumeSlider) {
        if (parseFloat(videoVolumeSlider.value) === 0) {
          videoVolumeSlider.value = 0.3; // Set to a default audible volume if previously zero
        }
        liveVideo.volume = parseFloat(videoVolumeSlider.value);
      }
      
      if (iconVolumeHighVideo) iconVolumeHighVideo.classList.remove('hidden');
      if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.add('hidden');
      
      if (mainVideoPlayer) {
        mainVideoPlayer.classList.add('live-active');
        showControls();
      }
      if (playerCover) {
        playerCover.style.opacity = '0';
        setTimeout(() => playerCover.classList.add('hidden'), 300);
      }
      
      if (iconPlayVideo) iconPlayVideo.classList.add('hidden');
      if (iconPauseVideo) iconPauseVideo.classList.remove('hidden');
      
      // Auto-play the video
      if (liveVideo.paused) {
        liveVideo.play().catch(err => console.warn("Play triggered before stream initialized", err));
      }
    } else {
      liveVideo.pause();
      if (mainVideoPlayer) {
        mainVideoPlayer.classList.remove('live-active');
        mainVideoPlayer.classList.remove('user-active');
        if (controlsTimeout) clearTimeout(controlsTimeout);
      }
      if (playerCover) {
        playerCover.classList.remove('hidden');
        setTimeout(() => playerCover.style.opacity = '1', 50);
      }
      
      if (iconPlayVideo) iconPlayVideo.classList.remove('hidden');
      if (iconPauseVideo) iconPauseVideo.classList.add('hidden');
    }
  }

  // Auto-hide player controls during video playback
  let controlsTimeout = null;

  function showControls() {
    if (!mainVideoPlayer) return;
    mainVideoPlayer.classList.add('user-active');
    if (controlsTimeout) clearTimeout(controlsTimeout);
    if (isVideoPlaying) {
      controlsTimeout = setTimeout(() => {
        mainVideoPlayer.classList.remove('user-active');
      }, 3000);
    }
  }

  function hideControls() {
    if (!mainVideoPlayer) return;
    if (controlsTimeout) clearTimeout(controlsTimeout);
    if (isVideoPlaying) {
      mainVideoPlayer.classList.remove('user-active');
    }
  }

  if (mainVideoPlayer) {
    mainVideoPlayer.addEventListener('mousemove', showControls);
    mainVideoPlayer.addEventListener('mouseenter', showControls);
    mainVideoPlayer.addEventListener('mouseleave', hideControls);
    mainVideoPlayer.addEventListener('touchstart', showControls, { passive: true });
  }

  // Bind video player event listeners if elements exist
  if (liveVideo && videoPlayPauseBtn && videoMuteBtn) {
    const iconPlayVideo = videoPlayPauseBtn.querySelector('.icon-play');
    const iconPauseVideo = videoPlayPauseBtn.querySelector('.icon-pause');
    const iconVolumeHighVideo = videoMuteBtn.querySelector('.icon-volume-high');
    const iconVolumeMuteVideo = videoMuteBtn.querySelector('.icon-volume-mute');

    if (playerCover) playerCover.addEventListener('click', toggleVideoPlayback);
    liveVideo.addEventListener('click', toggleVideoPlayback);
    videoPlayPauseBtn.addEventListener('click', toggleVideoPlayback);

    // Mute / Unmute Video Audio
    videoMuteBtn.addEventListener('click', () => {
      isVideoMuted = !isVideoMuted;
      liveVideo.muted = isVideoMuted;
      
      if (isVideoMuted) {
        if (videoVolumeSlider) {
          videoVolumeBeforeMute = parseFloat(videoVolumeSlider.value);
          videoVolumeSlider.value = 0;
        }
        if (iconVolumeHighVideo) iconVolumeHighVideo.classList.add('hidden');
        if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.remove('hidden');
      } else {
        if (videoVolumeSlider) {
          videoVolumeSlider.value = videoVolumeBeforeMute;
        }
        liveVideo.volume = videoVolumeBeforeMute;
        if (iconVolumeHighVideo) iconVolumeHighVideo.classList.remove('hidden');
        if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.add('hidden');
      }
    });

    // Volume slider input
    if (videoVolumeSlider) {
      videoVolumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        liveVideo.volume = val;
        
        if (val === 0) {
          isVideoMuted = true;
          liveVideo.muted = true;
          if (iconVolumeHighVideo) iconVolumeHighVideo.classList.add('hidden');
          if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.remove('hidden');
        } else {
          isVideoMuted = false;
          liveVideo.muted = false;
          if (iconVolumeHighVideo) iconVolumeHighVideo.classList.remove('hidden');
          if (iconVolumeMuteVideo) iconVolumeMuteVideo.classList.add('hidden');
        }
      });
    }

    // Fullscreen video player
    if (videoFullscreenBtn) {
      videoFullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          if (mainVideoPlayer) {
            mainVideoPlayer.requestFullscreen().catch(err => {
              console.error(`Error al intentar activar pantalla completa: ${err.message}`);
            });
          }
        } else {
          document.exitFullscreen();
        }
      });
    }
  }

  // Dynamic Timecode (Simulating Broadcast Clock)
  function updateTimecode() {
    if (!liveTimecode) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    // Calculate frames (00-29 based on milliseconds)
    const frames = String(Math.floor((now.getMilliseconds() / 1000) * 30)).padStart(2, '0');
    
    liveTimecode.textContent = `${hours}:${minutes}:${seconds}:${frames}`;
    requestAnimationFrame(updateTimecode);
  }
  if (liveTimecode) {
    requestAnimationFrame(updateTimecode);
  }


  // ==========================================
  // 2. STICKY BOTTOM AUDIO PLAYER & LIVE STREAM
  // ==========================================
  const audioPlayPauseBtn = document.getElementById('audioPlayPauseBtn');
  const footerListenBtn = document.getElementById('footerListenBtn');
  const audioMuteBtn = document.getElementById('audioMuteBtn');
  const audioVolumeSlider = document.getElementById('audioVolumeSlider');
  const liveAudioStream = document.getElementById('liveAudioStream');
  const audioTrackName = document.getElementById('audioTrackName');

  const iconPlayAudio = audioPlayPauseBtn.querySelector('.icon-play');
  const iconPauseAudio = audioPlayPauseBtn.querySelector('.icon-pause');
  const iconVolumeHighAudio = audioMuteBtn.querySelector('.icon-volume-high');
  const iconVolumeMuteAudio = audioMuteBtn.querySelector('.icon-volume-mute');

  let isAudioPlaying = false;
  let isAudioMuted = false;
  let audioVolumeBeforeMute = 0.7;

  // Set initial volume
  liveAudioStream.volume = audioVolumeSlider.value;

  // HLS stream support for audio bar
  let hlsAudioInstance = null;
  function initAudioStream() {
    if (hlsAudioInstance) return;

    if (Hls.isSupported()) {
      hlsAudioInstance = new Hls({
        maxMaxBufferLength: 10,
        liveSyncDuration: 3,
        enableWorker: true
      });
      hlsAudioInstance.loadSource(STREAM_URL);
      hlsAudioInstance.attachMedia(liveAudioStream);
    } else if (liveAudioStream.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / native iOS audio tag HLS support
      liveAudioStream.src = STREAM_URL;
    } else {
      // Fallback
      liveAudioStream.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    }
  }

  function pauseVideoPlayback() {
    if (!isVideoPlaying) return;
    isVideoPlaying = false;
    if (liveVideo) liveVideo.pause();
    
    if (mainVideoPlayer) {
      mainVideoPlayer.classList.remove('live-active');
      mainVideoPlayer.classList.remove('user-active');
      if (controlsTimeout) clearTimeout(controlsTimeout);
    }
    if (playerCover) {
      playerCover.classList.remove('hidden');
      setTimeout(() => playerCover.style.opacity = '1', 50);
    }
    
    if (videoPlayPauseBtn) {
      const iconPlayVideo = videoPlayPauseBtn.querySelector('.icon-play');
      const iconPauseVideo = videoPlayPauseBtn.querySelector('.icon-pause');
      if (iconPlayVideo) iconPlayVideo.classList.remove('hidden');
      if (iconPauseVideo) iconPauseVideo.classList.add('hidden');
    }
  }

  function pauseAudioPlayback() {
    if (!isAudioPlaying) return;
    isAudioPlaying = false;
    if (liveAudioStream) liveAudioStream.pause();

    const audioSongTitle = document.getElementById('audioSongTitle');
    if (audioSongTitle) audioSongTitle.textContent = "AKMOV MEDIA";
    if (audioTrackName) audioTrackName.textContent = "Transmisión Online • Señal de Audio";

    if (iconPlayAudio) iconPlayAudio.classList.remove('hidden');
    if (iconPauseAudio) iconPauseAudio.classList.add('hidden');
    if (audioPlayPauseBtn) audioPlayPauseBtn.style.boxShadow = "none";

    if (footerListenBtn) {
      const footerPlayIcon = footerListenBtn.querySelector('svg');
      if (footerPlayIcon) footerPlayIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      footerListenBtn.style.borderColor = "var(--color-gray-border)";
    }

    const vinylPlatter = document.getElementById('vinylPlatter');
    const turntableTonearm = document.getElementById('turntableTonearm');
    const playerEqBars = document.getElementById('playerEqBars');
    if (vinylPlatter) vinylPlatter.classList.remove('playing');
    if (turntableTonearm) turntableTonearm.classList.remove('playing');
    if (playerEqBars) playerEqBars.classList.remove('playing');

    const albumArtEl = document.getElementById('audioAlbumArt');
    if (albumArtEl) {
      albumArtEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='38' height='38' viewBox='0 0 24 24' fill='%2300ff00'><path d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/></svg>";
    }
  }

  function toggleAudioPlayback() {
    if (isAudioPlaying) {
      pauseAudioPlayback();
    } else {
      isAudioPlaying = true;

      // Si el video principal está sonando, pausarlo
      if (isVideoPlaying) {
        pauseVideoPlayback();
      }

      initAudioStream();
      liveAudioStream.volume = parseFloat(audioVolumeSlider.value);
      liveAudioStream.muted = isAudioMuted;

      liveAudioStream.play().then(() => {
        updatePlayerUI();
      }).catch(err => {
        console.warn("Autoplay block or streaming offline. error:", err);
      });
      
      iconPlayAudio.classList.add('hidden');
      iconPauseAudio.classList.remove('hidden');
      audioPlayPauseBtn.style.boxShadow = "0 0 18px var(--color-neon)";
      
      const footerPlayIcon = footerListenBtn.querySelector('svg');
      if (footerPlayIcon) footerPlayIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      footerListenBtn.style.borderColor = "var(--color-neon)";

      const vinylPlatter = document.getElementById('vinylPlatter');
      const turntableTonearm = document.getElementById('turntableTonearm');
      const playerEqBars = document.getElementById('playerEqBars');
      if (vinylPlatter) vinylPlatter.classList.add('playing');
      if (turntableTonearm) turntableTonearm.classList.add('playing');
      if (playerEqBars) playerEqBars.classList.add('playing');
    }
  }

  let nowPlayingData = null;

  async function fetchNowPlaying() {
    try {
      const response = await fetch(AKMOV_API_BASE + '/now-playing');
      if (response.ok) {
        nowPlayingData = await response.json();
        updatePlayerUI();
      }
    } catch (e) {
      console.warn("Error fetching now-playing:", e);
    }
  }

  function updatePlayerUI() {
    const audioSongTitle = document.getElementById('audioSongTitle');
    const albumArtEl = document.getElementById('audioAlbumArt');
    
    if (nowPlayingData && nowPlayingData.title && nowPlayingData.title !== 'Transmisión Online') {
      if (audioSongTitle) {
        audioSongTitle.textContent = nowPlayingData.title.toUpperCase();
      }
      audioTrackName.textContent = (nowPlayingData.artist || 'AKMOV MEDIA').toUpperCase();
    } else {
      if (audioSongTitle) {
        audioSongTitle.textContent = "AKMOV MEDIA 24/7";
      }
      audioTrackName.textContent = "TRANSMITIENDO EN VIVO • SEÑAL DIGITAL HD";
    }

    if (albumArtEl) {
      if (nowPlayingData && nowPlayingData.cover) {
        albumArtEl.src = nowPlayingData.cover;
      } else {
        albumArtEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='38' height='38' viewBox='0 0 24 24' fill='%2300ff00'><path d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/></svg>";
      }
    }
  }

  // Poll now playing every 5 seconds
  setInterval(fetchNowPlaying, 5000);
  fetchNowPlaying();

  audioPlayPauseBtn.addEventListener('click', toggleAudioPlayback);
  footerListenBtn.addEventListener('click', toggleAudioPlayback);

  // Mute / Unmute Audio Player
  audioMuteBtn.addEventListener('click', () => {
    isAudioMuted = !isAudioMuted;
    liveAudioStream.muted = isAudioMuted;
    
    if (isAudioMuted) {
      audioVolumeBeforeMute = parseFloat(audioVolumeSlider.value);
      audioVolumeSlider.value = 0;
      iconVolumeHighAudio.classList.add('hidden');
      iconVolumeMuteAudio.classList.remove('hidden');
    } else {
      audioVolumeSlider.value = audioVolumeBeforeMute;
      liveAudioStream.volume = audioVolumeBeforeMute;
      iconVolumeHighAudio.classList.remove('hidden');
      iconVolumeMuteAudio.classList.add('hidden');
    }
  });

  // Volume slider change for audio
  audioVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    liveAudioStream.volume = val;
    
    if (val === 0) {
      isAudioMuted = true;
      liveAudioStream.muted = true;
      iconVolumeHighAudio.classList.add('hidden');
      iconVolumeMuteAudio.classList.remove('hidden');
    } else {
      isAudioMuted = false;
      liveAudioStream.muted = false;
      iconVolumeHighAudio.classList.remove('hidden');
      iconVolumeMuteAudio.classList.add('hidden');
    }
  });


// ==========================================
// 4. PROGRAMACIÓN DINÁMICA DESDE LA API
// ==========================================
(async function loadPublicSchedule() {
  const container = document.getElementById('publicScheduleContainer');
  if (!container) return;

  const typeLabels = {
    live:    '<span class="schedule-tag">EN VIVO</span>',
    next:    '<span class="schedule-tag next">Siguiente</span>',
    autodj:  '<span class="schedule-tag autodj">AutoDJ</span>',
    repeat:  '<span class="schedule-tag">Repetición</span>',
  };

  function isCurrentSlot(start, end) {
    const now  = new Date();
    const cur  = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    // Handle midnight wrap (e.g. 22:00 → 00:00)
    if (e < s) return cur >= s || cur < e;
    return cur >= s && cur < e;
  }

  function renderPublicSchedule(slots) {
    const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
    container.innerHTML = sorted.map(slot => {
      const isCurrent = isCurrentSlot(slot.start, slot.end);
      return `
        <div class="schedule-item${isCurrent ? ' current' : ''}">
          <div class="schedule-time">${slot.start} - ${slot.end}</div>
          <div class="schedule-details">
            ${typeLabels[slot.type] || ''}
            <h3>${slot.title}</h3>
            ${slot.desc ? `<p>${slot.desc}</p>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // Fallback: programación por defecto de los 6 bloques AutoDJ
  const defaultSlots = [
    { start: '00:00', end: '08:00', title: 'BLOQUE_TRASNOCHE', desc: 'Música Chill / Selección ambiental variada', type: 'autodj' },
    { start: '08:00', end: '12:00', title: 'BLOQUE_REGGAE_HIPHOP', desc: 'Música: Reggae, Ska y Hip-hop consciente', type: 'autodj' },
    { start: '12:00', end: '15:00', title: 'BLOQUE_CUMBIA', desc: 'Música: Cumbia regional y folclor andino', type: 'autodj' },
    { start: '15:00', end: '18:00', title: 'BLOQUE_ROCK', desc: 'Música: Rock local, Blues y Metal', type: 'autodj' },
    { start: '18:00', end: '21:00', title: 'BLOQUE_URBANO', desc: 'Música: Hip-hop, Trap local y Dub', type: 'autodj' },
    { start: '21:00', end: '00:00', title: 'BLOQUE_ESTELARES', desc: 'Música variada/instrumental + Videos de Drone', type: 'autodj' }
  ];

  try {
    const res  = await fetch(AKMOV_API_BASE + '/schedule');
    const data = await res.json();
    if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
      // Fusionar grilla predefinida con programas personalizados (ej. EN VIVO)
      let merged = [...defaultSlots];
      
      data.schedule.forEach(slot => {
        // Buscar si hay algún bloque por defecto que coincida exactamente en el horario
        const duplicate = merged.find(m => m.start === slot.start && m.end === slot.end);
        if (!duplicate) {
          merged.push(slot);
        } else {
          // Si coincide el horario, el programa personalizado reemplaza al por defecto
          const idx = merged.indexOf(duplicate);
          merged[idx] = slot;
        }
      });

      renderPublicSchedule(merged);
      return;
    }
  } catch (err) {
    console.warn("No se pudo cargar la programación desde la API, usando grilla estática.", err);
  }

  renderPublicSchedule(defaultSlots);
})();

// ==========================================
// 4.5. PUBLICIDAD / TICKER SCROLL DINÁMICO
// ==========================================
(function initDynamicAdTicker() {
  const mainAdBanner = document.getElementById('mainAdBanner');
  const adBannerBadge = document.getElementById('adBannerBadge');
  const adTickerContent = document.getElementById('adTickerContent');
  if (!mainAdBanner || !adBannerBadge || !adTickerContent) return;

  const speedMap = {
    slow: '35s',
    medium: '22s',
    fast: '14s'
  };

  function applyTickerConfig(config) {
    if (!config) return;

    // Toggle on/off global
    if (config.enabled === false) {
      mainAdBanner.classList.add('hidden');
      return;
    }

    // Badge global
    adBannerBadge.textContent = (config.badgeText || 'PUBLICIDAD').toUpperCase();

    // Speed global
    const speedVal = speedMap[config.speed] || (typeof config.speed === 'string' && config.speed.endsWith('s') ? config.speed : '22s');
    mainAdBanner.style.setProperty('--ad-speed', speedVal);

    // Items de anuncios
    let items = [];
    if (Array.isArray(config.items) && config.items.length > 0) {
      items = config.items.filter(item => item.active !== false);
    } else if (config.message) {
      items = [{
        message: config.message,
        ctaText: config.ctaText || 'CONTÁCTANOS AQUÍ',
        ctaUrl: config.ctaUrl || 'https://akmovmedia.com',
        bgColor: config.bgColor || '#00FF00',
        textColor: config.textColor || '#000000'
      }];
    }

    if (items.length === 0) {
      mainAdBanner.classList.add('hidden');
      return;
    }

    mainAdBanner.classList.remove('hidden');

    // Usar el color del primer anuncio o default para la barra
    const firstAd = items[0];
    mainAdBanner.style.backgroundColor = firstAd.bgColor || '#00FF00';
    mainAdBanner.style.color = firstAd.textColor || '#000000';
    adBannerBadge.style.backgroundColor = '#000000';
    adBannerBadge.style.color = firstAd.bgColor || '#00FF00';

    // Construir bloque de anuncios concatenados
    let combinedHtml = '';
    items.forEach(ad => {
      const msg = ad.message || '★ PUBLICIDAD DISPONIBLE ★';
      const cta = ad.ctaText || 'VER MÁS';
      const url = ad.ctaUrl || 'https://akmovmedia.com';
      const adBg = ad.bgColor || '#00FF00';
      const adText = ad.textColor || '#000000';

      combinedHtml += `
        <span class="ad-ticker-item" style="background-color:${adBg}; color:${adText}; padding: 2px 14px; margin-right: 1.5rem; border-radius: 2px;">
          <span>${msg}</span>
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="ad-ticker-cta" style="border-color:${adText}; color:${adText};">
            ${cta}
          </a>
        </span>
      `;
    });

    // Multiplicar por 3 o 4 para garantizar que el scroll infinito nunca quede vacío
    adTickerContent.innerHTML = combinedHtml + combinedHtml + combinedHtml + combinedHtml;
  }

  // 1. Carga inicial desde la API o Fallback LocalStorage
  async function fetchAdTicker() {
    try {
      const res = await fetch(AKMOV_API_BASE + '/api/ad-ticker');
      if (res.ok) {
        const config = await res.json();
        applyTickerConfig(config);
        localStorage.setItem('akmov_ad_ticker_cache', JSON.stringify(config));
        return;
      }
    } catch (e) {
      console.warn('No se pudo conectar a /api/ad-ticker, usando cache local:', e);
    }

    const cached = localStorage.getItem('akmov_ad_ticker_cache');
    if (cached) {
      try { applyTickerConfig(JSON.parse(cached)); } catch(err){}
    }
  }

  fetchAdTicker();

  // 2. Suscribirse a SSE para actualizaciones en vivo instantáneas sin recargar
  try {
    const sse = new EventSource(AKMOV_API_BASE + '/alerts/stream');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.dataType === 'AD_TICKER_UPDATE') {
          applyTickerConfig(data);
        }
      } catch (err) {}
    };
  } catch (e) {
    console.warn("SSE no disponible para marquesina:", e);
  }
})();
  // ==========================================
  // 3. NAVIGATION INTERACTION (Smooth Scroll & Active Link)
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Highlight active link based on scroll section
  window.addEventListener('scroll', () => {
    let current = "";
    const sections = document.querySelectorAll('section, footer');
    const scrollPosition = window.scrollY + 100; // Offset for navbar

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    if (current) {
      navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href').includes(current)) {
          item.classList.add('active');
        }
      });
    }
  });

  // ==========================================
  // 5. CARGA DINÁMICA DE VIDEOS YOUTUBE (ON DEMAND)
  // ==========================================
  (async function loadYouTubeVideos() {
    const container = document.getElementById('youtubeOnDemandContainer');
    if (!container) return;

    function renderVideos(videos) {
      container.innerHTML = videos.map(video => {
        return `
          <a href="${video.link}" target="_blank" rel="noopener noreferrer" class="ondemand-card">
            <div class="card-thumbnail" style="background-image: url('${video.thumbnail}'); background-size: cover; background-position: center;">
              <div class="thumbnail-overlay">
                <svg viewBox="0 0 24 24" fill="currentColor" class="play-small-icon"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <div class="card-badge">YOUTUBE</div>
            </div>
            <div class="card-info">
              <h3>${video.title}</h3>
              <p>${video.views ? `${video.views} • ` : ''}${video.published || ''}</p>
            </div>
          </a>`;
      }).join('');
    }

    try {
      const res = await fetch(AKMOV_API_BASE + '/youtube/videos');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        renderVideos(data.videos);
      }
    } catch (err) {
      console.warn("No se pudieron cargar los videos de YouTube desde la API. Usando respaldo estático.", err);
    }
  })();

  // Handle "Otro" checkbox in inscripción form
  const checkInteresOtro = document.getElementById('check-interes-otro');
  const inputInteresOtro = document.getElementById('input-interes-otro');
  if (checkInteresOtro && inputInteresOtro) {
    checkInteresOtro.addEventListener('change', (e) => {
      inputInteresOtro.disabled = !e.target.checked;
      if (e.target.checked) {
        inputInteresOtro.focus();
        inputInteresOtro.required = true;
      } else {
        inputInteresOtro.value = '';
        inputInteresOtro.required = false;
      }
    });
  }

  // Interceptar formulario de postulación e integrar con la API de Discord
  const postulaForm = document.querySelector('.brutalist-form');
  if (postulaForm) {
    postulaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = postulaForm.querySelector('.brutalist-form-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'ENVIANDO POSTULACIÓN...';
      }

      const formData = new FormData(postulaForm);
      
      const intereses = [];
      postulaForm.querySelectorAll('input[name="Intereses[]"]:checked').forEach(cb => {
        intereses.push(cb.value);
      });
      
      const herramientas = [];
      postulaForm.querySelectorAll('input[name="Herramientas[]"]:checked').forEach(cb => {
        herramientas.push(cb.value);
      });

      const payload = {
        Nombre: formData.get('Nombre Completo'),
        Edad: parseInt(formData.get('Edad'), 10) || null,
        Ciudad: formData.get('Ciudad/Localidad'),
        Contacto: formData.get('Contacto'),
        RedSocial: formData.get('Red Social'),
        Intereses: intereses,
        Intereses_Otro: formData.get('Intereses_Otro'),
        Experiencia: formData.get('Experiencia'),
        NombrePrograma: formData.get('Nombre Programa Tentativo'),
        Idea: formData.get('Idea de Programa'),
        Coanimador: formData.get('Coanimador'),
        Modalidad: formData.get('Modalidad'),
        Herramientas: herramientas,
        Disponibilidad: formData.get('Disponibilidad Horaria'),
        EnlacePitch: formData.get('Enlace Pitch')
      };

      try {
        const res = await fetch(AKMOV_API_BASE + '/inscripciones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result && result.success) {
          alert('¡Tu inscripción ha sido recibida! El Staff de AKMOV Media la revisará en el canal de Discord y se contactará contigo a la brevedad. 🎸');
          postulaForm.reset();
          if (inputInteresOtro) {
            inputInteresOtro.disabled = true;
            inputInteresOtro.value = '';
          }
        } else {
          alert('Hubo un error al procesar tu postulación: ' + (result.error || 'Inténtalo de nuevo.'));
        }
      } catch (err) {
        console.error('Error enviando formulario:', err);
        alert('No se pudo establecer conexión con el servidor de inscripciones. Inténtalo más tarde.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ENVIAR MI INSCRIPCIÓN';
        }
      }
    });
  }

});

// ==========================================
// 4. GOOGLE CAST (CHROMECAST) INTEGRATION
// ==========================================
window.__onGCastApiAvailable = function(isAvailable) {
  if (isAvailable) {
    const castBtn = document.getElementById('videoCastBtn');
    if (castBtn) {
      castBtn.style.display = 'inline-block';
    }

    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });

    const context = cast.framework.CastContext.getInstance();
    context.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      function(event) {
        if (event.sessionState === cast.framework.SessionState.SESSION_STARTED) {
          const session = context.getCurrentSession();
          if (session) {
            const STREAM_URL = "https://stream.akmovmedia.com/hls/stream.m3u8";
            const mediaInfo = new chrome.cast.media.MediaInfo(STREAM_URL, 'application/x-mpegurl');
            mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = 'AKMOV MEDIA';
            mediaInfo.metadata.subtitle = 'Señal de TV en Vivo';
            
            const request = new chrome.cast.media.LoadRequest(mediaInfo);
            session.loadMedia(request).then(
              function() {
                console.log('Chromecast: Cast started successfully.');
                const localVideo = document.getElementById('liveVideo');
                if (localVideo) {
                  localVideo.pause();
                }
              },
              function(errorCode) { console.warn('Chromecast: Cast failed: ' + errorCode); }
            );
          }
        }
      }
    );
  }
};



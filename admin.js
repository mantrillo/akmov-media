/* ============================================================
   AKMOV MEDIA — ADMIN PANEL JAVASCRIPT
   ============================================================
   Controla:
   - Sistema de login con captcha matemático
   - Control de AutoDJ via API REST (admin-api.js)
   - Editor visual de programación de radio
   - Funciones de copia y reveal de clave
   ============================================================ */

// ─── CONFIGURACIÓN ──────────────────────────────────────────
const CONFIG = {
  ADMIN_EMAIL:    'akmovmedia@gmail.com',
  ADMIN_PASSWORD: 'Akmovmedia.,2026!', // Contraseña por defecto solicitada
  STREAM_KEY:     'abc123',       // Clave de stream de Owncast
  API_BASE: AKMOV_API_BASE,
  POLL_INTERVAL: 8000,           // ms entre cada chequeo de estado del AutoDJ
};

// ─── SUPABASE INITIALIZATION ────────────────────────────────
const SUPABASE_URL = 'https://xoypavldfccdyjnfogci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uHznpwGU_ZSUPdEVzyVGmA_K152mmHI';
let supabase = null;

try {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase library not loaded yet or invalid key:", e);
}

// ─── ESTADO LOCAL DE PROGRAMACIÓN ────────────────────────────
// Se guarda en localStorage para persistir entre sesiones
let scheduleData = [];

const DEFAULT_SCHEDULE = [
  { start: '00:00', end: '08:00', title: 'BLOQUE_TRASNOCHE', desc: 'Música Chill / Selección ambiental variada', type: 'autodj' },
  { start: '08:00', end: '12:00', title: 'BLOQUE_REGGAE_HIPHOP', desc: 'Música: Reggae, Ska y Hip-hop consciente', type: 'autodj' },
  { start: '12:00', end: '15:00', title: 'BLOQUE_CUMBIA', desc: 'Música: Cumbia regional y folclor andino', type: 'autodj' },
  { start: '15:00', end: '18:00', title: 'BLOQUE_ROCK', desc: 'Música: Rock local, Blues y Metal', type: 'autodj' },
  { start: '18:00', end: '21:00', title: 'BLOQUE_URBANO', desc: 'Música: Hip-hop, Trap local y Dub', type: 'autodj' },
  { start: '21:00', end: '00:00', title: 'BLOQUE_ESTELARES', desc: 'Música variada/instrumental + Videos de Drone', type: 'autodj' }
];

// ─── ESTADO RUNTIME ─────────────────────────────────────────────────────
let pollTimer   = null;
let keyRevealed = false;

// ─── DOM REFS ─────────────────────────────────────────────────
const loginGate   = document.getElementById('loginGate');
const adminPanel  = document.getElementById('adminPanel');
const loginForm   = document.getElementById('loginForm');
const loginError  = document.getElementById('loginError');
const adminPassEl = document.getElementById('adminPass');

const pingDot     = document.getElementById('pingDot');
const pingLabel   = document.getElementById('pingLabel');

const owncastBadge        = document.getElementById('owncastBadge');
const owncastBadgeText    = document.getElementById('owncastBadgeText');
const owncastServiceState = document.getElementById('owncastServiceState');
const owncastStreamState  = document.getElementById('owncastStreamState');
const owncastViewers      = document.getElementById('owncastViewers');
const owncastUpdated      = document.getElementById('owncastUpdated');
const owncastStats        = document.getElementById('owncastStats');
const btnOpenChat         = document.getElementById('btnOpenChat');
const btnBypass           = document.getElementById('btnBypass');

const obsConnectionBadge = document.getElementById('obsConnectionBadge');
const obsConnectionText  = document.getElementById('obsConnectionText');
const obsActiveScene     = document.getElementById('obsActiveScene');
const obsStreamingState  = document.getElementById('obsStreamingState');
const localObsCard       = document.getElementById('localObsCard');

const streamKeyVal    = document.getElementById('streamKeyVal');
const revealKeyBtn    = document.getElementById('revealKeyBtn');

const scheduleList    = document.getElementById('scheduleList');
const addSlotBtn      = document.getElementById('addSlotBtn');
const saveScheduleBtn = document.getElementById('saveScheduleBtn');
const saveHint        = document.getElementById('saveHint');

const slotModal       = document.getElementById('slotModal');
const cancelSlot      = document.getElementById('cancelSlot');
const confirmSlot     = document.getElementById('confirmSlot');

const toastWrap       = document.getElementById('toastWrap');
const logoutBtn       = document.getElementById('logoutBtn');



// ─── LOGIN ────────────────────────────────────────────────────
function showPanel() {
  loginGate.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  initPanel();
}

function showGate() {
  adminPanel.classList.add('hidden');
  loginGate.classList.remove('hidden');
}

// Check if already logged in
if (sessionStorage.getItem('akmov_admin') === 'true') {
  showPanel();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const enteredEmail   = document.getElementById('adminEmail').value.trim();
  const enteredPass    = adminPassEl.value.trim();

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.disabled = true;
    const btnSpan = loginBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = 'VERIFICANDO...';
  }

  let authenticated = false;
  let errorMsg = 'Verifica tus credenciales';

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: enteredEmail,
        password: enteredPass
      });
      if (!error && data.user) {
        authenticated = true;
        console.log("Autenticado con Supabase Auth");
      } else if (error) {
        console.warn("Fallo de Supabase Auth, intentando fallback local:", error.message);
        errorMsg = error.message;
      }
    } catch (err) {
      console.warn("Error en Supabase auth client:", err);
    }
  }

  // Fallback Local
  if (!authenticated) {
    if (enteredEmail === CONFIG.ADMIN_EMAIL && enteredPass === CONFIG.ADMIN_PASSWORD) {
      authenticated = true;
      console.log("Autenticado con fallback local");
    }
  }

  if (loginBtn) {
    loginBtn.disabled = false;
    const btnSpan = loginBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = 'ACCEDER AL PANEL';
  }

  if (authenticated) {
    loginError.classList.add('hidden');
    sessionStorage.setItem('akmov_admin', 'true');
    sessionStorage.setItem('akmov_panel_session', '1'); // Para bypass del iframe de overlays
    adminPassEl.value = '';
    showPanel();
  } else {
    showError(errorMsg);
  }
});

function showError(msg) {
  loginError.textContent = 'ACCESO DENEGADO — ' + msg;
  loginError.classList.remove('hidden');
}

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('akmov_admin');
  stopPolling();
  showGate();
});

// ─── API HELPERS ──────────────────────────────────────────────
async function apiCall(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(CONFIG.API_BASE + path, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setApiStatus(online) {
  if (online) {
    pingDot.className = 'ping-dot online';
    pingLabel.textContent = 'API ONLINE';
  } else {
    pingDot.className = 'ping-dot offline';
    pingLabel.textContent = 'API OFFLINE';
  }
}

// ─── OWNCAST STATUS ───────────────────────────────────────────
async function fetchOwncastStatus() {
  try {
    const data = await apiCall('/status');
    setApiStatus(true);
    updateOwncastUI(data.active, data.live || { online: false, viewerCount: 0 }, data.obs || { online: false, scene: '—', streaming: false });
  } catch {
    setApiStatus(false);
    updateOwncastUI(null, { online: false, viewerCount: 0 }, { online: false, scene: '—', streaming: false });
  }
}

function updateOwncastUI(serviceActive, live, obs) {
  const now = new Date().toLocaleTimeString('es-CL');
  owncastUpdated.textContent = now;

  if (serviceActive === true) {
    owncastServiceState.textContent = 'ACTIVO ✓';
    owncastServiceState.style.color = 'var(--neon)';
    
    if (live.online) {
      owncastStreamState.textContent = 'EN VIVO 🔴';
      owncastStreamState.style.color = 'var(--red)';
      owncastBadge.className = 'autodj-badge running';
      owncastBadgeText.textContent = 'TRANSMITIENDO';
      owncastStats.textContent = `// Transmisión activa\n// Espectadores actuales: ${live.viewerCount}\n// Conectado desde: ${live.lastConnectTime ? new Date(live.lastConnectTime).toLocaleTimeString('es-CL') : 'N/A'}`;
    } else {
      owncastStreamState.textContent = 'INACTIVO';
      owncastStreamState.style.color = 'var(--text-muted)';
      owncastBadge.className = 'autodj-badge stopped';
      owncastBadgeText.textContent = 'INACTIVO';
      owncastStats.textContent = '// Servidor listo para recibir transmisiones de OBS.';
    }
    owncastViewers.textContent = live.viewerCount;
  } else if (serviceActive === false) {
    owncastServiceState.textContent = 'CAÍDO ❌';
    owncastServiceState.style.color = 'var(--red)';
    owncastStreamState.textContent = 'OFFLINE';
    owncastStreamState.style.color = 'var(--red)';
    owncastBadge.className = 'autodj-badge stopped';
    owncastBadgeText.textContent = 'OFFLINE';
    owncastStats.textContent = '// El servicio Owncast está apagado en el servidor.';
    owncastViewers.textContent = '0';
  } else {
    owncastServiceState.textContent = '—';
    owncastServiceState.style.color = '';
    owncastStreamState.textContent = '—';
    owncastStreamState.style.color = '';
    owncastBadge.className = 'autodj-badge';
    owncastBadgeText.textContent = 'SIN DATOS';
    owncastStats.textContent = '// No se pudo obtener conexión con la API.';
    owncastViewers.textContent = '0';
  }

  // --- RENDER LOCAL OBS CARD ---
  if (obs.online) {
    obsConnectionBadge.className = 'autodj-badge running';
    obsConnectionText.textContent = 'ONLINE';
    obsActiveScene.textContent = obs.scene || '—';
    obsStreamingState.textContent = obs.streaming ? 'TRANSMITIENDO 🔴' : 'DETENIDO';
    obsStreamingState.style.color = obs.streaming ? 'var(--neon)' : 'var(--text-muted)';
    localObsCard.style.borderColor = 'var(--neon)';
  } else {
    obsConnectionBadge.className = 'autodj-badge stopped';
    obsConnectionText.textContent = 'OFFLINE';
    obsActiveScene.textContent = '—';
    obsStreamingState.textContent = 'DESCONECTADO';
    obsStreamingState.style.color = 'var(--red)';
    localObsCard.style.borderColor = 'var(--text-muted)';
  }
}

// ─── OWNCAST CONTROLS ────────────────────────────────────────
btnBypass.addEventListener('click', async () => {
  const confirmAction = confirm('¿Seguro que deseas liberar la señal? Esto desconectará al locutor o AutoDJ que esté transmitiendo en este momento.');
  if (!confirmAction) return;

  btnBypass.disabled = true;
  try {
    await apiCall('/owncast/restart', 'POST');
    toast('Señal liberada. Ya puedes iniciar una nueva transmisión.', 'success');
    await fetchOwncastStatus();
  } catch {
    toast('Error al reiniciar el servicio de Owncast.', 'error');
  }
  btnBypass.disabled = false;
});

btnOpenChat.addEventListener('click', () => {
  const domain = CONFIG.API_BASE.replace('api.', 'stream.').replace(':3001', ':8080');
  const chatUrl = `${domain}/embed/chat`;
  window.open(chatUrl, 'OwncastChat', 'width=420,height=650,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
  toast('Abriendo chat flotante...', 'info');
});

// ─── POLLING ─────────────────────────────────────────────────

function startPolling() {
  fetchOwncastStatus();
  pollTimer = setInterval(fetchOwncastStatus, CONFIG.POLL_INTERVAL);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ─── STREAM KEY REVEAL ────────────────────────────────────────

revealKeyBtn.addEventListener('click', () => {
  keyRevealed = !keyRevealed;
  streamKeyVal.textContent = keyRevealed ? CONFIG.STREAM_KEY : '••••••••';

  // Allow copying when revealed
  if (keyRevealed) {
    revealKeyBtn.setAttribute('data-copy', CONFIG.STREAM_KEY);
    revealKeyBtn.title = 'Copiar clave';
    toast('Clave revelada. Clic de nuevo para copiar.', 'info');
  } else {
    revealKeyBtn.removeAttribute('data-copy');
    revealKeyBtn.title = 'Mostrar/ocultar clave';
  }
});

// ─── COPY BUTTONS ─────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-btn[data-copy]');
  if (!btn) return;
  const text = btn.getAttribute('data-copy');
  navigator.clipboard.writeText(text).then(() => {
    toast('¡Copiado al portapapeles!', 'success');
  }).catch(() => {
    toast('No se pudo copiar. Cópialo manualmente.', 'error');
  });
});

// ─── SCHEDULE EDITOR ─────────────────────────────────────────
// DEFAULT_SCHEDULE movido al inicio del archivo

async function loadSchedule() {
  try {
    const data = await apiCall('/schedule');
    if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
      scheduleData = data.schedule;
      localStorage.setItem('akmov_schedule', JSON.stringify(scheduleData));
      return;
    }
  } catch { /* API no disponible, usar localStorage */ }

  const saved = localStorage.getItem('akmov_schedule');
  if (saved) {
    try {
      scheduleData = JSON.parse(saved);
    } catch (e) {
      scheduleData = [];
    }
  } else {
    scheduleData = [];
  }

  // Si después de intentar cargar de la API y de localStorage sigue vacío,
  // cargamos la grilla por defecto de los 6 bloques AutoDJ automáticamente.
  if (!scheduleData || scheduleData.length === 0) {
    scheduleData = [...DEFAULT_SCHEDULE];
  }
}

async function saveSchedule() {
  localStorage.setItem('akmov_schedule', JSON.stringify(scheduleData));
  try {
    await apiCall('/schedule', 'POST', { schedule: scheduleData });
  } catch {
    // Si la API no responde, al menos quedó en localStorage
    console.warn('No se pudo guardar en el servidor. Solo guardado en localStorage.');
  }
}

function renderSchedule() {
  scheduleList.innerHTML = '';

  if (scheduleData.length === 0) {
    scheduleList.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);padding:12px">// Sin bloques. Agrega uno con el botón +</p>';
    return;
  }

  // Sort by start time
  const sorted = [...scheduleData].sort((a, b) => a.start.localeCompare(b.start));

  sorted.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'schedule-slot';
    el.innerHTML = `
      <span class="slot-time">${slot.start} → ${slot.end}</span>
      <span class="slot-tag ${slot.type}">${typeLabel(slot.type)}</span>
      <div class="slot-info">
        <div class="slot-title">${slot.title}${slot.host ? ` <span style="font-size:0.8em;color:var(--text-muted);font-weight:normal;">(Locutor: ${slot.host})</span>` : ''}</div>
        <div class="slot-desc">${slot.desc}</div>
      </div>
      <button class="slot-delete" data-index="${scheduleData.indexOf(slot)}" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    scheduleList.appendChild(el);
  });
}

function typeLabel(type) {
  return { live: 'EN VIVO', next: 'SIGUIENTE', autodj: 'AUTODJ', repeat: 'REPETICIÓN' }[type] || type;
}

scheduleList.addEventListener('click', (e) => {
  const btn = e.target.closest('.slot-delete');
  if (!btn) return;
  const idx = parseInt(btn.getAttribute('data-index'), 10);
  scheduleData.splice(idx, 1);
  renderSchedule();
  saveHint.textContent = '⚠ Cambios sin guardar';
});

saveScheduleBtn.addEventListener('click', async () => {
  saveScheduleBtn.disabled = true;
  await saveSchedule();
  saveHint.textContent = '✓ Guardado en servidor';
  toast('Programación guardada y publicada en la web.', 'success');
  setTimeout(() => { saveHint.textContent = ''; }, 3000);
  saveScheduleBtn.disabled = false;
});

// ─── ADD SLOT MODAL ───────────────────────────────────────────
addSlotBtn.addEventListener('click', () => {
  slotModal.classList.remove('hidden');
  document.getElementById('slotTitle').focus();
});

cancelSlot.addEventListener('click', () => {
  slotModal.classList.add('hidden');
  clearModal();
});

slotModal.addEventListener('click', (e) => {
  if (e.target === slotModal) { slotModal.classList.add('hidden'); clearModal(); }
});

confirmSlot.addEventListener('click', () => {
  const start = document.getElementById('slotStart').value;
  const end   = document.getElementById('slotEnd').value;
  const title = document.getElementById('slotTitle').value.trim().toUpperCase();
  const host  = document.getElementById('slotHost').value.trim();
  const desc  = document.getElementById('slotDesc').value.trim();
  const type  = document.getElementById('slotType').value;

  if (!start || !end || !title) {
    toast('Completa al menos: hora inicio, hora fin y título.', 'error');
    return;
  }

  scheduleData.push({ start, end, title, host, desc, type });
  renderSchedule();
  saveHint.textContent = '⚠ Cambios sin guardar';
  slotModal.classList.add('hidden');
  clearModal();
  toast(`Bloque "${title}" agregado.`, 'success');
});

function clearModal() {
  document.getElementById('slotStart').value = '';
  document.getElementById('slotEnd').value   = '';
  document.getElementById('slotTitle').value = '';
  document.getElementById('slotHost').value  = '';
  document.getElementById('slotDesc').value  = '';
  document.getElementById('slotType').value  = 'live';
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── TABS NAVIGATION ──────────────────────────────────────────
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    // Switch active buttons
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Switch active content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `tab-${targetTab}`) {
        content.classList.add('active');
      }
    });

    // Dynamically set iframe src to CONFIG.API_BASE (e.g. api.akmovmedia.com)
    if (targetTab === 'overlays') {
      const overlaysIframe = document.getElementById('overlaysIframe');
      if (overlaysIframe && !overlaysIframe.src) {
        overlaysIframe.src = CONFIG.API_BASE + '/streamers.html?auth=true';
      }
      sessionStorage.setItem('akmov_panel_session', '1');
    } else if (targetTab === 'pauta') {
      const pautaIframe = document.getElementById('pautaIframe');
      if (pautaIframe && !pautaIframe.src) {
        pautaIframe.src = CONFIG.API_BASE + '/pauta_studio.html';
      }
    }
  });
});

// ─── YOUTUBE CHANNELS MANAGEMENT ──────────────────────────────
let youtubeChannels = [];

async function loadYoutubeChannels() {
  const container = document.getElementById('youtubeChannelsList');
  if (!container) return;

  try {
    const res = await fetch(CONFIG.API_BASE + '/api/youtube/channels');
    if (res.ok) {
      youtubeChannels = await res.json();
      renderYoutubeChannels();
    }
  } catch (err) {
    console.error('Error fetching youtube channels:', err);
  }
}

function renderYoutubeChannels() {
  const container = document.getElementById('youtubeChannelsList');
  if (!container) return;

  if (youtubeChannels.length === 0) {
    container.innerHTML = '<span class="log-placeholder" style="color: var(--text-muted);">// No hay canales configurados.</span>';
    return;
  }

  container.innerHTML = youtubeChannels.map((channel, index) => `
    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--gray-border); padding: 10px 15px; margin-bottom: 5px;">
      <span style="font-family: var(--font-mono); color: var(--neon); font-size: 0.95rem;">${channel}</span>
      <button class="action-btn btn-stop" onclick="deleteYoutubeChannel(${index})" style="background: var(--red); color: white; border: none; padding: 5px 10px; cursor: pointer; font-family: var(--font-mono); font-size: 0.7rem; font-weight: bold;">ELIMINAR</button>
    </div>
  `).join('');
}

window.deleteYoutubeChannel = function(index) {
  youtubeChannels.splice(index, 1);
  renderYoutubeChannels();
};

document.getElementById('btnAddYoutubeChannel')?.addEventListener('click', () => {
  const input = document.getElementById('newYoutubeChannel');
  let handle = input.value.trim();
  if (!handle) return;
  if (!handle.startsWith('@')) {
    handle = '@' + handle;
  }
  if (youtubeChannels.includes(handle)) {
    alert('Este canal ya está en la lista.');
    return;
  }
  youtubeChannels.push(handle);
  input.value = '';
  renderYoutubeChannels();
});

document.getElementById('btnSaveYoutubeChannels')?.addEventListener('click', async () => {
  const hint = document.getElementById('youtubeSaveHint');
  if (hint) {
    hint.textContent = 'Guardando...';
    hint.className = 'save-hint active';
  }
  try {
    const res = await fetch(CONFIG.API_BASE + '/api/youtube/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: youtubeChannels })
    });
    const data = await res.json();
    if (data.success) {
      if (hint) {
        hint.textContent = '✓ Guardado con éxito';
        setTimeout(() => { hint.textContent = ''; }, 3000);
      }
      toast('Canales de YouTube guardados con éxito.', 'success');
    } else {
      if (hint) {
        hint.textContent = 'Error al guardar';
      }
    }
  } catch (err) {
    if (hint) {
      hint.textContent = 'Error de conexión';
    }
  }
});

// ─── INIT PANEL ──────────────────────────────────────────────
async function initPanel() {
  await loadSchedule();
  renderSchedule();
  await loadYoutubeChannels();
  startPolling();
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    slotModal.classList.add('hidden');
    clearModal();
  }
});

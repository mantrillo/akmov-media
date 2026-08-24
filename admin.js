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
let supabaseClient = null;

try {
  if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

// ─── LOGIN & ROLES PERMISSIONS ───────────────────────────────
function applyUserPermissions() {
  const email = sessionStorage.getItem('akmov_user_email') || CONFIG.ADMIN_EMAIL;
  const role = sessionStorage.getItem('akmov_user_role') || 'superadmin';
  let allowedTabs = ['stream-control', 'live-events', 'ad-ticker', 'pauta', 'vod-config', 'users'];
  try {
    const raw = sessionStorage.getItem('akmov_user_tabs');
    if (raw) {
      allowedTabs = JSON.parse(raw);
      if (role === 'superadmin' || email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase()) {
        if (!allowedTabs.includes('live-events')) allowedTabs.push('live-events');
        if (!allowedTabs.includes('ad-ticker')) allowedTabs.push('ad-ticker');
        sessionStorage.setItem('akmov_user_tabs', JSON.stringify(allowedTabs));
      }
    }
  } catch(e) {}

  // Update Topbar User Badge
  const topbarInfo = document.getElementById('topbarUserInfo');
  const roleBadge = document.getElementById('userRoleBadge');
  const emailBadge = document.getElementById('userEmailBadge');
  if (topbarInfo && roleBadge && emailBadge) {
    topbarInfo.style.display = 'flex';
    roleBadge.textContent = role.toUpperCase();
    roleBadge.className = `user-role-badge ${role.toLowerCase()}`;
    emailBadge.textContent = email;
  }

  // Update Navigation Tabs Visibility
  const tabBtns = document.querySelectorAll('.tab-btn');
  let currentActiveAllowed = false;

  tabBtns.forEach(btn => {
    const tabKey = btn.getAttribute('data-tab');
    if (allowedTabs.includes(tabKey)) {
      btn.style.display = 'inline-block';
      if (btn.classList.contains('active')) {
        currentActiveAllowed = true;
      }
    } else {
      btn.style.display = 'none';
      btn.classList.remove('active');
    }
  });

  // If active tab is not allowed, switch to the first allowed tab (e.g. pauta)
  if (!currentActiveAllowed) {
    const firstAllowed = Array.from(tabBtns).find(btn => allowedTabs.includes(btn.getAttribute('data-tab')));
    if (firstAllowed) {
      firstAllowed.click();
    }
  }
}

function showPanel() {
  loginGate.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  applyUserPermissions();
  initPanel();
}

function showGate() {
  adminPanel.classList.add('hidden');
  loginGate.classList.remove('hidden');
}

// Check if already logged in or arriving via Supabase confirmation link (#access_token=...)
if (sessionStorage.getItem('akmov_admin') === 'true') {
  showPanel();
}

if (supabaseClient) {
  // Check active Supabase session or parse URL hash token
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      const userEmail = session.user.email;
      const meta = session.user.user_metadata || {};
      const regUsers = getRegisteredUsers();
      const cached = regUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
      const userRole = meta.role || (cached ? cached.role : (userEmail.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase() ? 'superadmin' : 'locutor'));
      const userTabs = meta.allowed_tabs || (cached ? cached.allowed_tabs : (userRole === 'superadmin' ? ['stream-control', 'overlays', 'overlays-vertical', 'pauta', 'vod-config', 'users'] : ['pauta']));

      sessionStorage.setItem('akmov_admin', 'true');
      sessionStorage.setItem('akmov_user_email', userEmail);
      sessionStorage.setItem('akmov_user_role', userRole);
      sessionStorage.setItem('akmov_user_tabs', JSON.stringify(userTabs));
      sessionStorage.setItem('akmov_panel_session', '1');
      showPanel();
    }
  }).catch(err => console.warn('Supabase getSession error:', err));

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user) {
      const userEmail = session.user.email;
      const meta = session.user.user_metadata || {};
      const regUsers = getRegisteredUsers();
      const cached = regUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
      const userRole = meta.role || (cached ? cached.role : (userEmail.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase() ? 'superadmin' : 'locutor'));
      const userTabs = meta.allowed_tabs || (cached ? cached.allowed_tabs : (userRole === 'superadmin' ? ['stream-control', 'overlays', 'overlays-vertical', 'pauta', 'vod-config', 'users'] : ['pauta']));

      sessionStorage.setItem('akmov_admin', 'true');
      sessionStorage.setItem('akmov_user_email', userEmail);
      sessionStorage.setItem('akmov_user_role', userRole);
      sessionStorage.setItem('akmov_user_tabs', JSON.stringify(userTabs));
      sessionStorage.setItem('akmov_panel_session', '1');
      showPanel();
    }
  });
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
  let userEmail = enteredEmail;
  let userRole = 'superadmin';
  let userTabs = ['stream-control', 'live-events', 'ad-ticker', 'pauta', 'vod-config', 'users'];
  let errorMsg = 'Verifica tus credenciales';

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: enteredEmail,
        password: enteredPass
      });
      if (!error && data.user) {
        authenticated = true;
        userEmail = data.user.email;
        const meta = data.user.user_metadata || {};
        
        // Match with registered users registry
        const regUsers = getRegisteredUsers();
        const cached = regUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());

        userRole = meta.role || (cached ? cached.role : (userEmail.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase() ? 'superadmin' : 'locutor'));
        userTabs = meta.allowed_tabs || (cached ? cached.allowed_tabs : (userRole === 'superadmin' ? ['stream-control', 'live-events', 'ad-ticker', 'pauta', 'vod-config', 'users'] : ['pauta']));
        console.log(`Autenticado con Supabase Auth (${userEmail}) - Rol: ${userRole}`);
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
    if (enteredEmail.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase() && enteredPass === CONFIG.ADMIN_PASSWORD) {
      authenticated = true;
      userEmail = CONFIG.ADMIN_EMAIL;
      userRole = 'superadmin';
      userTabs = ['stream-control', 'live-events', 'ad-ticker', 'pauta', 'vod-config', 'users'];
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
    sessionStorage.setItem('akmov_user_email', userEmail);
    sessionStorage.setItem('akmov_user_role', userRole);
    sessionStorage.setItem('akmov_user_tabs', JSON.stringify(userTabs));
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
  sessionStorage.removeItem('akmov_user_email');
  sessionStorage.removeItem('akmov_user_role');
  sessionStorage.removeItem('akmov_user_tabs');
  sessionStorage.removeItem('akmov_panel_session');
  if (supabaseClient) {
    supabaseClient.auth.signOut().catch(() => {});
  }
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
    const response = await fetch(CONFIG.API_BASE + '/owncast/restart', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      toast('Señal liberada. Ya puedes iniciar una nueva transmisión.', 'success');
    } else {
      toast('Error al liberar señal: ' + (data.error || 'Código HTTP ' + response.status), 'error');
    }
    await fetchOwncastStatus();
  } catch (err) {
    toast('Error de conexión al liberar señal: ' + err.message, 'error');
  }
  btnBypass.disabled = false;
});

btnOpenChat.addEventListener('click', () => {
  const domain = CONFIG.API_BASE.replace('api.', 'stream.').replace(':3001', ':8080');
  // Abrimos el dominio completo de stream para que se cargue la interfaz interactiva con caja de texto (chat activo)
  const chatUrl = domain;
  window.open(chatUrl, 'OwncastChat', 'width=1000,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
  toast('Abriendo reproductor y chat interactivo...', 'info');
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

  // Sort by date (if any) then start time
  const sorted = [...scheduleData].sort((a, b) => {
    const dtA = (a.date || '0000-00-00') + ' ' + a.start;
    const dtB = (b.date || '0000-00-00') + ' ' + b.start;
    return dtA.localeCompare(dtB);
  });

  sorted.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'schedule-slot';
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2px;">
        ${slot.date ? `<span style="font-size:0.72rem; color:var(--neon); font-family:monospace; font-weight:bold;">[ ${slot.date} ]</span>` : `<span style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">[ DIARIO ]</span>`}
        <span class="slot-time">${slot.start} → ${slot.end}</span>
      </div>
      <span class="slot-tag ${slot.type}">${typeLabel(slot.type)}</span>
      <div class="slot-info">
        <div class="slot-title">${slot.title}${slot.host ? ` <span style="font-size:0.8em;color:var(--text-muted);font-weight:normal;">(Locutor: ${slot.host})</span>` : ''}</div>
        <div class="slot-desc">${slot.desc || ''}</div>
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
  const date  = document.getElementById('slotDate').value;
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

  scheduleData.push({ date: date || '', start, end, title, host, desc, type });
  renderSchedule();
  saveHint.textContent = '⚠ Cambios sin guardar';
  slotModal.classList.add('hidden');
  clearModal();
  toast(`Bloque "${title}" agregado.`, 'success');
});

function clearModal() {
  document.getElementById('slotDate').value  = '';
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

    // Dynamically set iframe src to local relative paths (same domain as web server)
    if (targetTab === 'overlays') {
      const overlaysIframe = document.getElementById('overlaysIframe');
      if (overlaysIframe && !overlaysIframe.src.includes('overlay-akmov/streamer.html')) {
        overlaysIframe.src = './overlay-akmov/streamer.html';
      }
      sessionStorage.setItem('akmov_panel_session', '1');
    } else if (targetTab === 'overlays-vertical') {
      const overlaysVerticalIframe = document.getElementById('overlaysVerticalIframe');
      if (overlaysVerticalIframe && !overlaysVerticalIframe.src.includes('overlay-akmov/streamer-vertical.html')) {
        overlaysVerticalIframe.src = './overlay-akmov/streamer-vertical.html';
      }
      sessionStorage.setItem('akmov_panel_session', '1');
    } else if (targetTab === 'pauta') {
      const pautaIframe = document.getElementById('pautaIframe');
      if (pautaIframe && !pautaIframe.src.includes('pauta_studio.html')) {
        pautaIframe.src = './pauta_studio.html';
      }
    } else if (targetTab === 'users') {
      renderUsersTable();
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

  container.innerHTML = youtubeChannels.map((ch, index) => {
    const handle = typeof ch === 'string' ? ch : ch.handle;
    const count = typeof ch === 'string' ? 3 : (ch.count || 3);
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--gray-border); padding: 10px 15px; margin-bottom: 5px;">
        <span style="font-family: var(--font-mono); color: var(--neon); font-size: 0.95rem;">${handle} <span style="color: var(--text-dim); font-size: 0.8rem;">(${count} videos)</span></span>
        <button class="action-btn btn-stop" onclick="deleteYoutubeChannel(${index})" style="background: var(--red); color: white; border: none; padding: 5px 10px; cursor: pointer; font-family: var(--font-mono); font-size: 0.7rem; font-weight: bold;">ELIMINAR</button>
      </div>
    `;
  }).join('');
}

window.deleteYoutubeChannel = function(index) {
  youtubeChannels.splice(index, 1);
  renderYoutubeChannels();
};

document.getElementById('btnAddYoutubeChannel')?.addEventListener('click', () => {
  const input = document.getElementById('newYoutubeChannel');
  const countInput = document.getElementById('newYoutubeChannelCount');
  let handle = input.value.trim();
  const count = parseInt(countInput ? countInput.value : '3', 10) || 3;
  
  if (!handle) return;
  if (!handle.startsWith('@')) {
    handle = '@' + handle;
  }
  
  const handleExists = youtubeChannels.some(ch => (typeof ch === 'string' ? ch : ch.handle) === handle);
  if (handleExists) {
    alert('Este canal ya está en la lista.');
    return;
  }
  
  youtubeChannels.push({ handle, count });
  input.value = '';
  if (countInput) countInput.value = '3';
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

// ─── USER ROLES & REGISTRY MANAGEMENT (SUPABASE PERSISTENCE) ──
const USERS_STORAGE_KEY = 'akmov_users_registry';
let registeredUsers = [];

async function fetchRegisteredUsers() {
  // 1. Query Supabase Database table
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('akmov_users_permissions')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        registeredUsers = data;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data));
        return registeredUsers;
      } else if (error) {
        console.warn("Supabase query akmov_users_permissions note:", error.message);
      }
    } catch (err) {
      console.warn("Supabase DB error:", err);
    }
  }

  // 2. Fallback to localStorage cache
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      registeredUsers = JSON.parse(stored);
      return registeredUsers;
    }
  } catch (e) {}

  // 3. Default seeded superadmin
  registeredUsers = [
    {
      email: CONFIG.ADMIN_EMAIL,
      role: 'superadmin',
      allowed_tabs: ['stream-control', 'overlays', 'pauta', 'vod-config', 'users'],
      created_at: new Date().toISOString()
    }
  ];
  return registeredUsers;
}

function getRegisteredUsers() {
  if (registeredUsers && registeredUsers.length > 0) return registeredUsers;
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [
    {
      email: CONFIG.ADMIN_EMAIL,
      role: 'superadmin',
      allowed_tabs: ['stream-control', 'overlays', 'pauta', 'vod-config', 'users'],
      created_at: new Date().toISOString()
    }
  ];
}

window.handleRolePresetChange = function(role) {
  const chkStream = document.getElementById('perm-stream-control');
  const chkOverlays = document.getElementById('perm-overlays');
  const chkOverlaysV = document.getElementById('perm-overlays-vertical');
  const chkPauta = document.getElementById('perm-pauta');
  const chkVod = document.getElementById('perm-vod-config');
  const chkUsers = document.getElementById('perm-users');

  if (!chkStream) return;

  if (role === 'locutor') {
    chkStream.checked = false;
    chkOverlays.checked = false;
    if (chkOverlaysV) chkOverlaysV.checked = false;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'productor') {
    chkStream.checked = false;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'operador') {
    chkStream.checked = true;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'superadmin') {
    chkStream.checked = true;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = true;
    chkUsers.checked = true;
  }
};

window.renderUsersTable = async function() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = await fetchRegisteredUsers();
  tbody.innerHTML = '';

  const tabLabels = {
    'stream-control': '⚡ Emisión',
    'overlays': '🎨 Overlays',
    'overlays-vertical': '📱 Overlays 9:16',
    'pauta': '📜 Pauta',
    'vod-config': '📺 VOD',
    'users': '👥 Usuarios'
  };

  users.forEach((user) => {
    const tr = document.createElement('tr');
    
    let tabsHtml = '';
    (user.allowed_tabs || []).forEach(tab => {
      tabsHtml += `<span class="tag-perm active">${tabLabels[tab] || tab}</span>`;
    });

    const isCurrentAdmin = user.email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase();

    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: #fff;">${user.email}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(user.created_at || Date.now()).toLocaleDateString('es-CL')}</div>
      </td>
      <td>
        <span class="user-role-badge ${user.role}">${user.role.toUpperCase()}</span>
      </td>
      <td>
        <div>${tabsHtml}</div>
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="action-btn" onclick="openEditUserModal('${user.email}')" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--bg-card); border: 1px solid var(--neon); color: var(--neon); cursor: pointer; margin-right: 6px;">
          ✏️ EDITAR
        </button>
        ${!isCurrentAdmin ? `
          <button class="action-btn btn-stop" onclick="deleteUser('${user.email}')" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--red); color: #fff; cursor: pointer; border: none;">
            ELIMINAR
          </button>
        ` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.openEditUserModal = function(email) {
  const users = getRegisteredUsers();
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user && email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase()) {
    user = {
      email: CONFIG.ADMIN_EMAIL,
      role: 'superadmin',
      allowed_tabs: ['stream-control', 'overlays', 'overlays-vertical', 'pauta', 'vod-config', 'users']
    };
  }

  if (!user) return;

  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role || 'locutor';
  document.getElementById('editUserPass').value = '';

  const tabs = user.allowed_tabs || [];
  document.getElementById('edit-perm-stream-control').checked = tabs.includes('stream-control');
  document.getElementById('edit-perm-overlays').checked = tabs.includes('overlays');
  document.getElementById('edit-perm-overlays-vertical').checked = tabs.includes('overlays-vertical');
  document.getElementById('edit-perm-pauta').checked = tabs.includes('pauta');
  document.getElementById('edit-perm-vod-config').checked = tabs.includes('vod-config');
  document.getElementById('edit-perm-users').checked = tabs.includes('users');

  document.getElementById('editUserModal').classList.remove('hidden');
};

window.closeEditUserModal = function() {
  document.getElementById('editUserModal').classList.add('hidden');
};

window.handleEditRolePresetChange = function(role) {
  const chkStream = document.getElementById('edit-perm-stream-control');
  const chkOverlays = document.getElementById('edit-perm-overlays');
  const chkOverlaysV = document.getElementById('edit-perm-overlays-vertical');
  const chkPauta = document.getElementById('edit-perm-pauta');
  const chkVod = document.getElementById('edit-perm-vod-config');
  const chkUsers = document.getElementById('edit-perm-users');

  if (!chkStream) return;

  if (role === 'locutor') {
    chkStream.checked = false;
    chkOverlays.checked = false;
    if (chkOverlaysV) chkOverlaysV.checked = false;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'productor') {
    chkStream.checked = false;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'operador') {
    chkStream.checked = true;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = false;
    chkUsers.checked = false;
  } else if (role === 'superadmin') {
    chkStream.checked = true;
    chkOverlays.checked = true;
    if (chkOverlaysV) chkOverlaysV.checked = true;
    chkPauta.checked = true;
    chkVod.checked = true;
    chkUsers.checked = true;
  }
};

window.saveUserEdit = async function() {
  const email = document.getElementById('editUserEmail').value.trim();
  const role = document.getElementById('editUserRole').value;
  const newPass = document.getElementById('editUserPass').value.trim();

  const allowed_tabs = [];
  if (document.getElementById('edit-perm-stream-control').checked) allowed_tabs.push('stream-control');
  if (document.getElementById('edit-perm-overlays').checked) allowed_tabs.push('overlays');
  if (document.getElementById('edit-perm-overlays-vertical').checked) allowed_tabs.push('overlays-vertical');
  if (document.getElementById('edit-perm-pauta').checked) allowed_tabs.push('pauta');
  if (document.getElementById('edit-perm-vod-config').checked) allowed_tabs.push('vod-config');
  if (document.getElementById('edit-perm-users').checked) allowed_tabs.push('users');

  if (allowed_tabs.length === 0) {
    toast('Debes seleccionar al menos una pestaña permitida', 'error');
    return;
  }

  // Update in Supabase DB if enabled
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('akmov_users_permissions')
        .upsert({
          email: email,
          role: role,
          allowed_tabs: allowed_tabs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
    } catch (err) {
      console.warn("Supabase upsert permissions note:", err);
    }
  }

  // Update in local registry
  let users = getRegisteredUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx >= 0) {
    users[idx].role = role;
    users[idx].allowed_tabs = allowed_tabs;
    users[idx].updated_at = new Date().toISOString();
  } else {
    users.push({
      email: email,
      role: role,
      allowed_tabs: allowed_tabs,
      created_at: new Date().toISOString()
    });
  }

  registeredUsers = users;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

  // If the edited user is the current active session user, update permissions immediately in live UI!
  const currentSessionEmail = sessionStorage.getItem('akmov_user_email') || '';
  if (currentSessionEmail.toLowerCase() === email.toLowerCase()) {
    sessionStorage.setItem('akmov_user_role', role);
    sessionStorage.setItem('akmov_user_tabs', JSON.stringify(allowed_tabs));
    applyUserPermissions();
    toast(`Tus permisos y rol (${role.toUpperCase()}) se han actualizado al instante`, 'success');
  } else {
    toast(`Usuario ${email} actualizado con éxito (${role.toUpperCase()})`, 'success');
  }

  closeEditUserModal();
  await renderUsersTable();
};

window.deleteUser = async function(email) {
  if (!confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) return;

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('akmov_users_permissions')
        .delete()
        .eq('email', email);
    } catch (err) {
      console.warn("Error deleting in Supabase:", err);
    }
  }

  registeredUsers = registeredUsers.filter(u => u.email.toLowerCase() !== email.toLowerCase());
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(registeredUsers));
  toast(`Usuario ${email} eliminado`, 'info');
  renderUsersTable();
};

document.getElementById('newUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('newUserEmail').value.trim();
  const pass = document.getElementById('newUserPass').value.trim();
  const role = document.getElementById('newUserRoleSelect').value;

  const allowed_tabs = [];
  if (document.getElementById('perm-stream-control').checked) allowed_tabs.push('stream-control');
  if (document.getElementById('perm-overlays').checked) allowed_tabs.push('overlays');
  if (document.getElementById('perm-overlays-vertical')?.checked) allowed_tabs.push('overlays-vertical');
  if (document.getElementById('perm-pauta').checked) allowed_tabs.push('pauta');
  if (document.getElementById('perm-vod-config').checked) allowed_tabs.push('vod-config');
  if (document.getElementById('perm-users').checked) allowed_tabs.push('users');

  if (!email || !pass) {
    toast('Ingresa correo y contraseña', 'error');
    return;
  }
  if (pass.length < 6) {
    toast('La contraseña debe tener mínimo 6 caracteres', 'error');
    return;
  }
  if (allowed_tabs.length === 0) {
    toast('Debes seleccionar al menos un permiso de pestaña', 'error');
    return;
  }

  const btn = document.getElementById('btnCreateUser');
  if (btn) btn.disabled = true;

  try {
    if (supabaseClient) {
      const redirectUrl = window.location.origin.includes('localhost')
        ? 'https://akmovmedia.com/_ctrl_ak9x2.html'
        : `${window.location.origin}${window.location.pathname}`;

      // 1. Crear en Supabase Auth
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: pass,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            role: role,
            allowed_tabs: allowed_tabs
          }
        }
      });

      if (error) {
        console.warn("Supabase SignUp warning:", error.message);
      }

      // 2. Persistir en la tabla Supabase akmov_users_permissions
      try {
        await supabaseClient.from('akmov_users_permissions').upsert({
          email: email,
          role: role,
          allowed_tabs: allowed_tabs,
          created_at: new Date().toISOString()
        }, { onConflict: 'email' });
      } catch (dbErr) {
        console.warn("Supabase upsert error:", dbErr);
      }
    }

    // 3. Actualizar memoria y cache local
    const users = getRegisteredUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    const newUserObj = {
      email,
      role,
      allowed_tabs,
      created_at: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      users[existingIndex] = newUserObj;
    } else {
      users.push(newUserObj);
    }
    registeredUsers = users;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    toast(`Usuario ${email} registrado con éxito (${role.toUpperCase()})`, 'success');
    document.getElementById('newUserForm').reset();
    handleRolePresetChange('locutor');
    await renderUsersTable();

  } catch (err) {
    console.error("Error creating user:", err);
    toast('Error al registrar usuario: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// ─── PUBLICIDAD / TICKER MULTI-ANUNCIO MANAGEMENT ────────────
let currentAdTicker = {
  enabled: true,
  badgeText: "PUBLICIDAD",
  speed: "medium",
  items: [
    {
      id: "ad-1",
      message: "★ ESPACIO DISPONIBLE PARA PUBLICIDAD • POTENCIA TU MARCA EN AKMOV MEDIA ★",
      ctaText: "CONTÁCTANOS AQUÍ",
      ctaUrl: "https://akmovmedia.com",
      bgColor: "#00FF00",
      textColor: "#000000",
      active: true
    }
  ]
};

async function loadAdTicker() {
  try {
    const res = await fetch(CONFIG.API_BASE + '/api/ad-ticker');
    if (res.ok) {
      currentAdTicker = await res.json();
    }
  } catch (e) {
    console.warn("No se pudo conectar a /api/ad-ticker, usando fallback local:", e);
    const local = localStorage.getItem('akmov_ad_ticker');
    if (local) {
      try { currentAdTicker = JSON.parse(local); } catch(err){}
    }
  }
  
  if (!Array.isArray(currentAdTicker.items)) {
    currentAdTicker.items = [];
  }
  
  renderAdTickerGlobalUI();
  renderAdItemsTable();
  updateRotationPreview();
}

function renderAdTickerGlobalUI() {
  const globalEnabled = document.getElementById('adGlobalEnabled');
  const globalEnabledSlider = document.getElementById('adGlobalEnabledSlider');
  const liveStatusBadge = document.getElementById('adTickerLiveStatus');
  const liveStatusText = document.getElementById('adTickerLiveStatusText');
  const globalBadgeText = document.getElementById('adGlobalBadgeText');
  const globalSpeed = document.getElementById('adGlobalSpeed');
  const countDisplay = document.getElementById('adCountDisplay');

  if (globalEnabled) globalEnabled.checked = currentAdTicker.enabled !== false;
  if (globalBadgeText) globalBadgeText.value = currentAdTicker.badgeText || 'PUBLICIDAD';
  if (globalSpeed) globalSpeed.value = currentAdTicker.speed || 'medium';
  if (countDisplay) countDisplay.textContent = currentAdTicker.items.length;

  if (globalEnabled && globalEnabledSlider) {
    if (globalEnabled.checked) {
      globalEnabledSlider.style.backgroundColor = 'var(--neon)';
      if (liveStatusBadge) liveStatusBadge.className = 'autodj-badge running';
      if (liveStatusText) liveStatusText.textContent = 'EN VIVO (ACTIVA)';
    } else {
      globalEnabledSlider.style.backgroundColor = '#444';
      if (liveStatusBadge) liveStatusBadge.className = 'autodj-badge stopped';
      if (liveStatusText) liveStatusText.textContent = 'DESACTIVADA';
    }
  }
}

function renderAdItemsTable() {
  const tbody = document.getElementById('adItemsTableBody');
  const countDisplay = document.getElementById('adCountDisplay');
  if (!tbody) return;
  
  if (countDisplay) countDisplay.textContent = currentAdTicker.items.length;
  tbody.innerHTML = '';

  if (currentAdTicker.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
          No hay anuncios registrados. Haz clic en <strong>+ NUEVO ANUNCIO</strong> para agregar el primero.
        </td>
      </tr>
    `;
    return;
  }

  currentAdTicker.items.forEach((ad, index) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-border)';
    
    const clickCount = ad.clicks || 0;

    tr.innerHTML = `
      <td style="padding: 12px 10px;">
        <label style="position: relative; display: inline-block; width: 38px; height: 20px; cursor: pointer;">
          <input type="checkbox" ${ad.active !== false ? 'checked' : ''} onchange="toggleAdItem('${ad.id}')" style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: ${ad.active !== false ? 'var(--neon)' : '#444'}; border-radius: 20px; transition: .3s;"></span>
        </label>
      </td>
      <td style="padding: 12px 10px; max-width: 300px;">
        <div style="font-weight: 700; color: #fff; font-size: 0.85rem; word-break: break-word;">${ad.message}</div>
      </td>
      <td style="padding: 12px 10px;">
        <a href="${ad.ctaUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--neon); text-decoration: underline; font-weight: 700; font-size: 0.78rem; display: inline-block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${ad.ctaText || 'LINK'} ↗
        </a>
      </td>
      <td style="padding: 12px 10px; text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); padding: 3px 8px; border-radius: 4px;">
          <span style="font-size: 0.85rem; font-weight: 800; color: var(--neon); font-family: monospace;">${clickCount}</span>
          ${clickCount > 0 ? `<button onclick="resetAdClicks('${ad.id}')" title="Reiniciar contador a 0" style="background: none; border: none; color: #888; cursor: pointer; font-size: 0.65rem; padding: 0 2px;">↺</button>` : ''}
        </div>
      </td>
      <td style="padding: 12px 10px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 18px; height: 18px; background: ${ad.bgColor}; border: 1px solid #fff; border-radius: 2px;" title="Fondo: ${ad.bgColor}"></span>
          <span style="display: inline-block; width: 18px; height: 18px; background: ${ad.textColor}; border: 1px solid #fff; border-radius: 2px;" title="Texto: ${ad.textColor}"></span>
        </div>
      </td>
      <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
        <button onclick="openEditAdModal('${ad.id}')" class="action-btn" style="padding: 5px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--bg-card); border: 1px solid var(--neon); color: var(--neon); cursor: pointer; margin-right: 6px;">
          ✏️ EDITAR
        </button>
        <button onclick="deleteAdItem('${ad.id}')" class="action-btn btn-stop" style="padding: 5px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--red); color: #fff; cursor: pointer; border: none;">
          🗑️ ELIMINAR
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateRotationPreview() {
  const badgeTag = document.getElementById('adPreviewBadgeTag');
  const scrollText = document.getElementById('adPreviewScrollText');
  if (badgeTag) badgeTag.textContent = currentAdTicker.badgeText || 'PUBLICIDAD';
  
  if (!scrollText) return;
  
  const activeItems = currentAdTicker.items.filter(i => i.active !== false);
  if (activeItems.length === 0) {
    scrollText.innerHTML = '<span style="color: #666;">(Sin anuncios activos para mostrar)</span>';
    return;
  }

  let html = '';
  activeItems.forEach(item => {
    html += `
      <span style="background-color: ${item.bgColor}; color: ${item.textColor}; padding: 3px 12px; margin-right: 18px; border-radius: 2px; display: inline-flex; align-items: center; gap: 8px;">
        <span>${item.message}</span>
        <span style="text-decoration: underline; font-weight: 800;">${item.ctaText}</span>
      </span>
    `;
  });
  scrollText.innerHTML = html;
}

window.openCreateAdModal = function() {
  const modal = document.getElementById('adEditModal');
  const title = document.getElementById('adModalTitle');
  const form = document.getElementById('adModalForm');
  if (!modal || !form) return;

  title.textContent = 'NUEVO ANUNCIO PUBLICITARIO';
  form.reset();
  document.getElementById('modalAdId').value = '';
  document.getElementById('modalAdBgColor').value = '#00FF00';
  document.getElementById('modalAdBgColorHex').value = '#00FF00';
  document.getElementById('modalAdTextColor').value = '#000000';
  document.getElementById('modalAdTextColorHex').value = '#000000';
  document.getElementById('modalAdActive').checked = true;

  modal.classList.remove('hidden');
};

window.openEditAdModal = function(id) {
  const ad = currentAdTicker.items.find(i => i.id === id);
  if (!ad) return;

  const modal = document.getElementById('adEditModal');
  const title = document.getElementById('adModalTitle');
  if (!modal) return;

  title.textContent = 'EDITAR ANUNCIO PUBLICITARIO';
  document.getElementById('modalAdId').value = ad.id;
  document.getElementById('modalAdMessage').value = ad.message || '';
  document.getElementById('modalAdCtaText').value = ad.ctaText || '';
  document.getElementById('modalAdCtaUrl').value = ad.ctaUrl || '';
  document.getElementById('modalAdBgColor').value = ad.bgColor || '#00FF00';
  document.getElementById('modalAdBgColorHex').value = ad.bgColor || '#00FF00';
  document.getElementById('modalAdTextColor').value = ad.textColor || '#000000';
  document.getElementById('modalAdTextColorHex').value = ad.textColor || '#000000';
  document.getElementById('modalAdActive').checked = ad.active !== false;

  modal.classList.remove('hidden');
};

window.closeAdModal = function() {
  const modal = document.getElementById('adEditModal');
  if (modal) modal.classList.add('hidden');
};

window.submitAdModalForm = async function() {
  const id = document.getElementById('modalAdId').value;
  const message = document.getElementById('modalAdMessage').value.trim();
  const ctaText = document.getElementById('modalAdCtaText').value.trim();
  const ctaUrl = document.getElementById('modalAdCtaUrl').value.trim();
  const bgColor = document.getElementById('modalAdBgColor').value;
  const textColor = document.getElementById('modalAdTextColor').value;
  const active = document.getElementById('modalAdActive').checked;

  if (!message || !ctaText) {
    alert('Por favor completa el mensaje y texto del botón.');
    return;
  }

  if (id) {
    // Editar existente (preservar clicks existentes)
    const idx = currentAdTicker.items.findIndex(i => i.id === id);
    if (idx >= 0) {
      currentAdTicker.items[idx] = {
        ...currentAdTicker.items[idx],
        message,
        ctaText,
        ctaUrl,
        bgColor,
        textColor,
        active,
        clicks: currentAdTicker.items[idx].clicks || 0
      };
    }
  } else {
    // Crear nuevo
    const newAd = {
      id: 'ad-' + Date.now(),
      message,
      ctaText,
      ctaUrl,
      bgColor,
      textColor,
      active,
      clicks: 0
    };
    currentAdTicker.items.unshift(newAd);
  }

  closeAdModal();
  renderAdItemsTable();
  updateRotationPreview();
  await persistAdTickerConfig('Anuncio guardado y actualizado con éxito.');
};

window.resetAdClicks = async function(id) {
  const ad = currentAdTicker.items.find(i => i.id === id);
  if (ad) {
    if (!confirm(`¿Deseas reiniciar a 0 el contador de clicks del anuncio "${ad.ctaText}"?`)) return;
    ad.clicks = 0;
    renderAdItemsTable();
    await persistAdTickerConfig('Contador de clicks reiniciado a 0.');
  }
};

window.deleteAdItem = async function(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este anuncio?')) return;
  currentAdTicker.items = currentAdTicker.items.filter(i => i.id !== id);
  renderAdItemsTable();
  updateRotationPreview();
  await persistAdTickerConfig('Anuncio eliminado.');
};

window.toggleAdItem = async function(id) {
  const ad = currentAdTicker.items.find(i => i.id === id);
  if (ad) {
    ad.active = !ad.active;
    renderAdItemsTable();
    updateRotationPreview();
    await persistAdTickerConfig(ad.active ? 'Anuncio activado.' : 'Anuncio pausado.');
  }
};

window.saveAdTickerGlobalSettings = async function() {
  currentAdTicker.enabled = document.getElementById('adGlobalEnabled')?.checked ?? true;
  currentAdTicker.badgeText = document.getElementById('adGlobalBadgeText')?.value.trim() || 'PUBLICIDAD';
  currentAdTicker.speed = document.getElementById('adGlobalSpeed')?.value || 'medium';

  renderAdTickerGlobalUI();
  updateRotationPreview();
  await persistAdTickerConfig('Ajustes generales de marquesina guardados.');
};

async function persistAdTickerConfig(successMsg) {
  localStorage.setItem('akmov_ad_ticker', JSON.stringify(currentAdTicker));
  try {
    const res = await fetch(CONFIG.API_BASE + '/api/ad-ticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentAdTicker)
    });
    const data = await res.json();
    if (data.success) {
      toast(successMsg || 'Marquesina actualizada.', 'success');
    }
  } catch (err) {
    toast('Guardado en caché local (API offline).', 'success');
  }
}

// Sincronizar selectores de color del modal
document.addEventListener('input', (e) => {
  if (e.target.id === 'modalAdBgColor') {
    const hex = document.getElementById('modalAdBgColorHex');
    if (hex) hex.value = e.target.value;
  } else if (e.target.id === 'modalAdBgColorHex') {
    const picker = document.getElementById('modalAdBgColor');
    if (picker && /^#[0-9A-F]{6}$/i.test(e.target.value)) picker.value = e.target.value;
  } else if (e.target.id === 'modalAdTextColor') {
    const hex = document.getElementById('modalAdTextColorHex');
    if (hex) hex.value = e.target.value;
  } else if (e.target.id === 'modalAdTextColorHex') {
    const picker = document.getElementById('modalAdTextColor');
    if (picker && /^#[0-9A-F]{6}$/i.test(e.target.value)) picker.value = e.target.value;
  }
});

// ─── LIVE EVENTS CALENDAR MANAGEMENT ─────────────────────────
let liveEventsData = [];

async function loadLiveEvents() {
  try {
    const res = await fetch(CONFIG.API_BASE + '/schedule');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.liveEvents)) {
        liveEventsData = data.liveEvents;
      }
    }
  } catch (e) {
    console.warn("No se pudo conectar a /schedule, usando fallback local:", e);
    const local = localStorage.getItem('akmov_live_events');
    if (local) {
      try { liveEventsData = JSON.parse(local); } catch(err){}
    }
  }
  renderLiveEventsTable();
}

function renderLiveEventsTable() {
  const tbody = document.getElementById('liveEventsTableBody');
  const countBadge = document.getElementById('liveEventsCount');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = liveEventsData.length;
  tbody.innerHTML = '';

  if (liveEventsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
          No hay eventos en vivo programados. Haz clic en <strong>+ PROGRAMAR EVENTO EN VIVO</strong>.
        </td>
      </tr>
    `;
    return;
  }

  // Ordenar por fecha y hora
  const sorted = [...liveEventsData].sort((a, b) => {
    const dtA = (a.date || '') + ' ' + (a.start || '');
    const dtB = (b.date || '') + ' ' + (b.start || '');
    return dtA.localeCompare(dtB);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  sorted.forEach(event => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-border)';

    let statusHtml = '<span class="schedule-tag" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid #555;">PROGRAMADO</span>';
    if (event.date === todayStr) {
      statusHtml = '<span class="schedule-tag" style="background: var(--red); color: #fff; font-weight: bold; animation: pulse-live 1.5s infinite;">¡HOY EN VIVO!</span>';
    } else if (event.date < todayStr) {
      statusHtml = '<span class="schedule-tag" style="background: transparent; color: #666; border: 1px solid #333;">FINALIZADO</span>';
    }

    tr.innerHTML = `
      <td style="padding: 12px 10px; font-family: monospace; font-weight: bold; color: var(--neon);">
        ${event.date || '—'}
      </td>
      <td style="padding: 12px 10px; font-weight: 700; color: #fff;">
        ${event.start} → ${event.end}
      </td>
      <td style="padding: 12px 10px;">
        <div style="font-weight: 800; color: #fff; font-size: 0.88rem;">${event.title}</div>
        ${event.desc ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${event.desc}</div>` : ''}
      </td>
      <td style="padding: 12px 10px; color: var(--text-muted); font-size: 0.82rem;">
        ${event.host ? `🎙️ ${event.host}` : '—'}
      </td>
      <td style="padding: 12px 10px;">
        ${statusHtml}
      </td>
      <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
        <button onclick="openEditLiveEventModal('${event.id}')" class="action-btn" style="padding: 5px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--bg-card); border: 1px solid var(--neon); color: var(--neon); cursor: pointer; margin-right: 6px;">
          ✏️ EDITAR
        </button>
        <button onclick="deleteLiveEvent('${event.id}')" class="action-btn btn-stop" style="padding: 5px 10px; font-size: 0.72rem; display: inline-flex; width: auto; background: var(--red); color: #fff; cursor: pointer; border: none;">
          🗑️ ELIMINAR
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openCreateLiveEventModal = function() {
  const modal = document.getElementById('liveEventModal');
  const title = document.getElementById('liveEventModalTitle');
  const form = document.getElementById('liveEventForm');
  if (!modal || !form) return;

  title.textContent = 'PROGRAMAR EVENTO EN VIVO';
  form.reset();
  document.getElementById('modalEventId').value = '';
  document.getElementById('modalEventDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalEventStart').value = '20:00';
  document.getElementById('modalEventEnd').value = '22:00';

  modal.classList.remove('hidden');
};

window.openEditLiveEventModal = function(id) {
  const ev = liveEventsData.find(i => i.id === id);
  if (!ev) return;

  const modal = document.getElementById('liveEventModal');
  const title = document.getElementById('liveEventModalTitle');
  if (!modal) return;

  title.textContent = 'EDITAR EVENTO EN VIVO';
  document.getElementById('modalEventId').value = ev.id;
  document.getElementById('modalEventDate').value = ev.date || '';
  document.getElementById('modalEventStart').value = ev.start || '';
  document.getElementById('modalEventEnd').value = ev.end || '';
  document.getElementById('modalEventTitle').value = ev.title || '';
  document.getElementById('modalEventHost').value = ev.host || '';
  document.getElementById('modalEventDesc').value = ev.desc || '';

  modal.classList.remove('hidden');
};

window.closeLiveEventModal = function() {
  const modal = document.getElementById('liveEventModal');
  if (modal) modal.classList.add('hidden');
};

window.submitLiveEventForm = async function() {
  const id = document.getElementById('modalEventId').value;
  const date = document.getElementById('modalEventDate').value;
  const start = document.getElementById('modalEventStart').value;
  const end = document.getElementById('modalEventEnd').value;
  const title = document.getElementById('modalEventTitle').value.trim().toUpperCase();
  const host = document.getElementById('modalEventHost').value.trim();
  const desc = document.getElementById('modalEventDesc').value.trim();

  if (!date || !start || !end || !title) {
    alert('Por favor completa la fecha, hora inicio, hora fin y título.');
    return;
  }

  if (id) {
    const idx = liveEventsData.findIndex(i => i.id === id);
    if (idx >= 0) {
      liveEventsData[idx] = { id, date, start, end, title, host, desc, type: 'live' };
    }
  } else {
    liveEventsData.push({
      id: 'event-' + Date.now(),
      date,
      start,
      end,
      title,
      host,
      desc,
      type: 'live'
    });
  }

  closeLiveEventModal();
  renderLiveEventsTable();
  await persistLiveEventsSchedule('Evento en vivo guardado con éxito.');
};

window.deleteLiveEvent = async function(id) {
  if (!confirm('¿Deseas eliminar este evento programado?')) return;
  liveEventsData = liveEventsData.filter(i => i.id !== id);
  renderLiveEventsTable();
  await persistLiveEventsSchedule('Evento eliminado.');
};

window.persistLiveEventsSchedule = async function(customMsg) {
  localStorage.setItem('akmov_live_events', JSON.stringify(liveEventsData));

  try {
    const res = await fetch(CONFIG.API_BASE + '/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule: scheduleData,
        liveEvents: liveEventsData
      })
    });
    const data = await res.json();
    if (data.success) {
      toast(customMsg || 'Calendario de eventos publicado en la web.', 'success');
    }
  } catch (err) {
    toast('Guardado en caché local (API offline).', 'success');
  }
};

// ─── INIT PANEL ──────────────────────────────────────────────
async function initPanel() {
  const allowedTabs = JSON.parse(sessionStorage.getItem('akmov_user_tabs') || '["pauta"]');

  if (allowedTabs.includes('stream-control')) {
    await loadSchedule();
    renderSchedule();
    startPolling();
  } else {
    stopPolling();
  }

  if (allowedTabs.includes('live-events')) {
    await loadLiveEvents();
  }

  if (allowedTabs.includes('ad-ticker')) {
    await loadAdTicker();
  }

  if (allowedTabs.includes('vod-config')) {
    await loadYoutubeChannels();
  }

  if (allowedTabs.includes('users')) {
    await renderUsersTable();
  }
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    slotModal.classList.add('hidden');
    clearModal();
  }
});

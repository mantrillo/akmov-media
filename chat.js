/* ============================================================
   AKMOV MEDIA — Social Chat con Facebook Login + Firebase
   ============================================================
   🔧 CONFIGURACIÓN: Reemplaza los valores YOUR_* con los tuyos.
   Sigue la guía paso a paso para obtenerlos.
   ============================================================ */

// ─── 1. CREDENCIALES — REEMPLAZA ESTOS VALORES ─────────────────────────────

const FACEBOOK_APP_ID = '1773787660284363'; // ✅ Nueva App ID (sin restricción de negocio)

const firebaseConfig = {
  apiKey:            "AIzaSyAZnIyKZ0iIL5xol8o1n1Pvr3Z6DzSpThs",
  authDomain:        "akmov-media-chat.firebaseapp.com",
  databaseURL:       "https://akmov-media-chat-default-rtdb.firebaseio.com",
  projectId:         "akmov-media-chat",
  storageBucket:     "akmov-media-chat.firebasestorage.app",
  messagingSenderId: "202591679985",
  appId:             "1:202591679985:web:5e20a01add098747dfc050"
};

// ─── 2. CONSTANTES ─────────────────────────────────────────────────────────

const MAX_MESSAGES     = 100;  // Máximo de mensajes visibles
const MAX_MSG_LENGTH   = 500;  // Límite de caracteres por mensaje
const MESSAGES_TO_LOAD = 50;   // Cuántos mensajes cargar al iniciar

// ─── 3. ESTADO GLOBAL ─────────────────────────────────────────────────────

let firebaseApp   = null;
let firebaseDB    = null;
let firebaseAuth  = null;
let currentUser   = null;
let messagesRef   = null;
let isSending     = false;

// ─── 4. INICIALIZACIÓN ────────────────────────────────────────────────────

function initSocialChat() {
  // Verificar que las credenciales han sido configuradas
  if (FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID' || firebaseConfig.apiKey === 'YOUR_API_KEY') {
    renderConfigWarning();
    return;
  }

  try {
    // Inicializar Firebase (usando el SDK compat cargado en el HTML)
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(firebaseConfig);
    } else {
      firebaseApp = firebase.app();
    }

    firebaseDB   = firebase.database();
    firebaseAuth = firebase.auth();

    // Escuchar cambios de autenticación
    firebaseAuth.onAuthStateChanged(handleAuthStateChange);

    // Conectar al stream de mensajes
    connectToMessages();

    // Inicializar Facebook SDK
    window.fbAsyncInit = function () {
      FB.init({
        appId:   FACEBOOK_APP_ID,
        cookie:  true,
        xfbml:   true,
        version: 'v21.0'
      });
    };

    // Cargar el SDK de Facebook dinámicamente
    loadFacebookSDK();

    // Configurar listeners de la UI
    setupChatUI();

    console.log('✅ AKMOV Chat: Inicializado correctamente');
  } catch (error) {
    console.error('❌ AKMOV Chat: Error al inicializar:', error);
    renderError('Error al inicializar el chat. Intenta recargar la página.');
  }
}

// ─── 5. FACEBOOK SDK ──────────────────────────────────────────────────────

function loadFacebookSDK() {
  if (document.getElementById('facebook-jssdk')) return;
  const js  = document.createElement('script');
  js.id     = 'facebook-jssdk';
  js.src    = 'https://connect.facebook.net/es_LA/sdk.js';
  js.async  = true;
  js.defer  = true;
  const fjs = document.getElementsByTagName('script')[0];
  fjs.parentNode.insertBefore(js, fjs);
}

// ─── 6. AUTENTICACIÓN ─────────────────────────────────────────────────────

function loginWithFacebook() {
  const btn = document.getElementById('social-chat-fb-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="chat-spinner"></span> Conectando...';
  }

  const provider = new firebase.auth.FacebookAuthProvider();
  provider.addScope('public_profile');

  firebaseAuth.signInWithPopup(provider)
    .then(result => {
      // Actualizar foto de perfil con resolución más alta
      const credential = result.credential;
      const token      = credential.accessToken;
      const user       = result.user;

      // Intentar obtener foto HD desde Facebook Graph API
      if (token && user) {
        fetch(`https://graph.facebook.com/me/picture?width=200&height=200&access_token=${token}`, { redirect: 'follow' })
          .then(res => {
            if (res.ok) {
              // La URL final es la foto HD
              const photoURL = res.url;
              updateUserPhoto(user.uid, photoURL);
            }
          })
          .catch(() => {}); // Silenciar error, usa foto por defecto
      }
    })
    .catch(err => {
      console.error('Error al iniciar sesión:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" class="chat-btn-icon"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Continuar con Facebook`;
      }
      let errorMsg = 'Error al iniciar sesión. Intenta nuevamente.';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'Ventana cerrada. Intenta nuevamente.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMsg = 'Popup bloqueado. Permite popups para este sitio.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMsg = 'Ya existe una cuenta con este correo.';
      }
      showLoginError(errorMsg);
    });
}

function updateUserPhoto(uid, photoURL) {
  // Actualizar la UI si el usuario ya está logueado
  const avatars = document.querySelectorAll('[data-uid="' + uid + '"]');
  avatars.forEach(img => { img.src = photoURL; });
}

function logout() {
  firebaseAuth.signOut().then(() => {
    // Limpiar mensajes del DOM al cerrar sesión (solo visualmente)
    const container = document.getElementById('social-chat-messages');
    if (container) container.innerHTML = '';
  }).catch(err => console.error('Error al cerrar sesión:', err));
}

function handleAuthStateChange(user) {
  currentUser = user;
  if (user) {
    renderChatMain(user);
    // Actualizar avatar en el campo de input
    const inputAvatar = document.getElementById('chat-input-avatar');
    if (inputAvatar) {
      inputAvatar.src    = user.photoURL || 'logo.svg';
      inputAvatar.onerror = () => { inputAvatar.src = 'logo.svg'; };
    }
  } else {
    renderLoginPanel();
  }
}

// ─── 7. FIREBASE REALTIME DATABASE ────────────────────────────────────────

function connectToMessages() {
  if (!firebaseDB) return;

  messagesRef = firebaseDB.ref('chat/messages');

  // Limpiar listener anterior si existe
  messagesRef.off();

  // Cargar últimos N mensajes y escuchar nuevos en tiempo real
  messagesRef.limitToLast(MESSAGES_TO_LOAD).on('child_added', snapshot => {
    const msg = snapshot.val();
    const key = snapshot.key;
    if (msg) {
      appendMessageToDOM(msg, key);
    }
  });
}

function sendMessage() {
  if (isSending) return;

  const input = document.getElementById('chat-message-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text || !currentUser) return;
  if (text.length > MAX_MSG_LENGTH) {
    showInputError(`Máximo ${MAX_MSG_LENGTH} caracteres`);
    return;
  }

  isSending = true;
  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const message = {
    userId:    currentUser.uid,
    name:      currentUser.displayName || 'Usuario',
    photoURL:  currentUser.photoURL || '',
    text:      text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  messagesRef.push(message)
    .then(() => {
      input.value = '';
      updateCharCounter(0);
      // Mantener foco en el input
      input.focus();
    })
    .catch(err => {
      console.error('Error al enviar mensaje:', err);
      showInputError('No se pudo enviar. Intenta nuevamente.');
    })
    .finally(() => {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
    });
}

// ─── 8. RENDERIZADO DEL DOM ───────────────────────────────────────────────

function setupChatUI() {
  // El wrapper ya existe en el HTML, solo configuramos los eventos
  const wrapper = document.getElementById('social-chat-wrapper');
  if (!wrapper) return;

  // Input — enviar con Enter
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement === document.getElementById('chat-message-input')) {
      if (!e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }
  });

  // Input — contador de caracteres
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.addEventListener('input', () => {
      updateCharCounter(input.value.length);
      clearInputError();
    });
  }
}

function renderLoginPanel() {
  const loginPanel = document.getElementById('social-chat-login');
  const mainPanel  = document.getElementById('social-chat-main');
  const headerUser = document.getElementById('chat-header-user');

  if (loginPanel) loginPanel.style.display = 'flex';
  if (mainPanel)  mainPanel.style.display  = 'none';
  if (headerUser) headerUser.style.display = 'none';

  // Resetear botón de login
  const btn = document.getElementById('social-chat-fb-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" class="chat-btn-icon">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
      Continuar con Facebook
    `;
  }
}

function renderChatMain(user) {
  const loginPanel = document.getElementById('social-chat-login');
  const mainPanel  = document.getElementById('social-chat-main');
  const headerUser = document.getElementById('chat-header-user');

  if (loginPanel) loginPanel.style.display = 'none';
  if (mainPanel)  mainPanel.style.display  = 'flex';

  // Mostrar info del usuario en el header
  if (headerUser) {
    headerUser.style.display = 'flex';
    const avatar = headerUser.querySelector('.chat-header-avatar');
    const name   = headerUser.querySelector('.chat-header-name');
    if (avatar) {
      avatar.src    = user.photoURL || 'logo.svg';
      avatar.onerror = () => { avatar.src = 'logo.svg'; };
    }
    if (name) name.textContent = user.displayName || 'Usuario';
  }

  // Actualizar avatar en el input area
  const inputAvatar = document.getElementById('chat-input-avatar');
  if (inputAvatar) {
    inputAvatar.src    = user.photoURL || 'logo.svg';
    inputAvatar.onerror = () => { inputAvatar.src = 'logo.svg'; };
  }

  // Scroll al final
  setTimeout(scrollChatToBottom, 100);
}

function appendMessageToDOM(msg, key) {
  const container = document.getElementById('social-chat-messages');
  if (!container) return;

  // Evitar duplicados
  if (document.getElementById('msg-' + key)) return;

  const isOwn = currentUser && msg.userId === currentUser.uid;
  const time  = msg.timestamp ? formatTimestamp(msg.timestamp) : '';

  const el = document.createElement('div');
  el.className = 'chat-msg' + (isOwn ? ' chat-msg--own' : '');
  el.id        = 'msg-' + key;
  el.innerHTML = `
    <img
      src="${sanitizeUrl(msg.photoURL) || 'logo.svg'}"
      alt="${escapeHtml(msg.name)}"
      class="chat-msg-avatar"
      onerror="this.src='logo.svg'"
      data-uid="${escapeHtml(msg.userId)}"
    >
    <div class="chat-msg-content">
      <div class="chat-msg-bubble">
        <span class="chat-msg-name">${escapeHtml(msg.name)}</span>
        <p class="chat-msg-text">${escapeHtml(msg.text)}</p>
      </div>
      <span class="chat-msg-time">${time}</span>
    </div>
  `;

  container.appendChild(el);

  // Limitar cantidad de mensajes en DOM
  while (container.children.length > MAX_MESSAGES) {
    container.removeChild(container.firstChild);
  }

  scrollChatToBottom();
}

function renderError(msg) {
  const wrapper = document.getElementById('social-chat-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="chat-error-state">
      <span class="chat-error-icon">⚠️</span>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function renderConfigWarning() {
  const wrapper = document.getElementById('social-chat-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="chat-config-warning">
      <span style="font-size:2rem;">🔧</span>
      <p style="font-weight:700;margin-bottom:4px;">Chat pendiente de configuración</p>
      <p style="font-size:0.78rem;opacity:0.7;">Agrega tu Facebook App ID y Firebase Config en <code>chat.js</code></p>
    </div>
  `;
}

// ─── 9. UTILIDADES DE UI ──────────────────────────────────────────────────

function scrollChatToBottom() {
  const container = document.getElementById('social-chat-messages');
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }
}

function updateCharCounter(count) {
  const counter = document.getElementById('chat-char-counter');
  if (!counter) return;
  counter.textContent = `${count}/${MAX_MSG_LENGTH}`;
  counter.classList.toggle('chat-char-counter--warn', count > MAX_MSG_LENGTH * 0.9);
  counter.classList.toggle('chat-char-counter--over', count >= MAX_MSG_LENGTH);
}

function showLoginError(msg) {
  const err = document.getElementById('chat-login-error');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => { err.style.display = 'none'; }, 5000);
  }
}

function showInputError(msg) {
  const err = document.getElementById('chat-input-error');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
  }
}

function clearInputError() {
  const err = document.getElementById('chat-input-error');
  if (err) err.style.display = 'none';
}

// ─── 10. UTILIDADES GENERALES ─────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function sanitizeUrl(url) {
  if (!url) return '';
  // Solo permitir URLs de dominios conocidos
  try {
    const parsed = new URL(url);
    const allowed = ['graph.facebook.com', 'lookaside.fbsbx.com', 'platform-lookaside.fbsbx.com', 'scontent.fscl1-1.fna.fbcdn.net'];
    if (allowed.some(d => parsed.hostname.includes(d)) || parsed.hostname.includes('fbcdn.net')) {
      return url;
    }
  } catch (_) {}
  return '';
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now  = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── 11. ARRANQUE ─────────────────────────────────────────────────────────

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSocialChat);
} else {
  initSocialChat();
}

// Exponer funciones al scope global (llamadas desde HTML)
window.loginWithFacebook = loginWithFacebook;
window.logout            = logout;
window.sendMessage       = sendMessage;

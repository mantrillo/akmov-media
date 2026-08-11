/**
 * AKMOV MEDIA — Admin API Server
 * ================================
 * Servidor Node.js Express que expone endpoints REST para controlar
 * el servicio AutoDJ (systemd) desde el panel web.
 *
 * INSTALACIÓN EN EL SERVIDOR UBUNTU:
 *   1. npm install express cors
 *   2. node admin-api.js &   (o configurar como servicio)
 */

const express    = require('express');
const cors       = require('cors');
const { exec }   = require('child_process');
const fs         = require('fs');
const path       = require('path');

const app  = express();
const PORT = 3001;

// ─── CARGAR VARIABLES DE ENTORNO (.env) DE MANERA NATIVA ───────
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    // Ignorar comentarios y líneas vacías
    if (!line || line.startsWith('#')) return;
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

// ─── CORS: Permitir acceso general para evitar problemas de origen ─────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ─── INTEGRACIÓN OWNCAST CHAT (Multichat Bot Token) ─────────────────
const OWNCAST_ADMIN_TOKEN = process.env.OWNCAST_ADMIN_TOKEN || '41f531ea-ba61-419b-a010-8bfa8795db28';
const OWNCAST_API_URL     = process.env.OWNCAST_API_URL     || 'http://localhost:8080';
const FACEBOOK_PAGE_TOKEN  = process.env.FACEBOOK_PAGE_TOKEN  || '';

/**
 * Función interna para publicar mensajes en el chat de Owncast
 */
async function sendToOwncastChat(platform, username, message) {
  if (!username || !message) return;
  const formattedBody = `[${platform}] **${username}**: ${message}`;
  try {
    const response = await fetch(`${OWNCAST_API_URL}/api/integrations/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OWNCAST_ADMIN_TOKEN}`
      },
      body: JSON.stringify({ body: formattedBody })
    });
    if (!response.ok) {
      console.error(`[Owncast Multichat Error ${platform}]`, response.status, await response.text());
    } else {
      console.log(`[Multichat Reenviado ${platform}] ${username}: ${message}`);
    }
  } catch (error) {
    console.error(`[Owncast Multichat Exception ${platform}]`, error.message);
  }
}

/**
 * Endpoint REST manual para recibir comentarios
 */
app.post('/owncast/send-chat', async (req, res) => {
  const { platform, username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ success: false, error: 'username y message son requeridos' });
  }
  await sendToOwncastChat(platform || 'Social', username, message);
  return res.json({ success: true });
});

// ─── LISTENERS AUTOMÁTICOS MULTICAT (Twitch, Kick, Facebook) ───────
const WebSocket = require('ws');

// 1. TWITCH CHAT LISTENER (IRC WebSocket)
function initTwitchListener(channelName = 'akmovmedia') {
  try {
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.on('open', () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send(`NICK justinfan${Math.floor(100000 + Math.random() * 900000)}`);
      ws.send(`JOIN #${channelName.toLowerCase()}`);
      console.log(`[Twitch Chat] Conectado al canal #${channelName}`);
    });

    ws.on('message', (data) => {
      const msgStr = data.toString();
      if (msgStr.startsWith('PING')) {
        ws.send('PONG :tmi.twitch.tv');
        return;
      }
      if (msgStr.includes('PRIVMSG')) {
        const match = msgStr.match(/:([^!]+)!.*PRIVMSG #[^ ]+ :(.*)/);
        if (match) {
          const user = match[1];
          const text = match[2].trim();
          sendToOwncastChat('Twitch', user, text);
        }
      }
    });

    ws.on('error', (err) => console.error('[Twitch Chat Error]', err.message));
    ws.on('close', () => {
      console.log('[Twitch Chat] Desconectado. Reintentando en 10s...');
      setTimeout(() => initTwitchListener(channelName), 10000);
    });
  } catch (e) {
    console.error('[Twitch Chat Init Exception]', e.message);
  }
}

// 2. KICK CHAT LISTENER (Pusher WebSocket)
async function initKickListener(channelSlug = 'akmovmedia') {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${channelSlug}`);
    if (!res.ok) return;
    const data = await res.json();
    const chatroomId = data.chatroom?.id;
    if (!chatroomId) return;

    const ws = new WebSocket('wss://ws-us2.pusher.com/app/eb1d5f283082f78b7754?protocol=7&client=js&version=7.6.0&flash=false');
    ws.on('open', () => {
      ws.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
      }));
      console.log(`[Kick Chat] Conectado al chatroom ID ${chatroomId}`);
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.event === 'App\\Events\\ChatMessageEvent') {
          const chatData = JSON.parse(parsed.data);
          const sender = chatData.sender?.username || 'Usuario Kick';
          const text = chatData.content;
          sendToOwncastChat('Kick', sender, text);
        }
      } catch (e) {}
    });

    ws.on('error', (err) => console.error('[Kick Chat Error]', err.message));
    ws.on('close', () => {
      console.log('[Kick Chat] Desconectado. Reintentando en 10s...');
      setTimeout(() => initKickListener(channelSlug), 10000);
    });
  } catch (e) {
    console.error('[Kick Chat Exception]', e.message);
  }
}

// Iniciar listeners de fondo al arrancar el servidor
setTimeout(() => {
  initTwitchListener('akmovmedia');
  initKickListener('akmovmedia');
}, 3000);


// ─── STATIC FILE SERVING: Overlays & Control Panel via HTTPS ───────────────────
app.use(express.static(path.join(__dirname)));

// ─── OBS LOCAL STATUS STORAGE ─────────────────────────────────
let lastObsStatus = {
  online: false,
  scene: '—',
  streaming: false,
  lastUpdate: null
};

// ─── REAL-TIME ALERTS SSE STORAGE ─────────────────────────────
let alertClients = [];

// Endpoint to subscribe to real-time alerts (SSE)
app.get('/alerts/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  alertClients.push(res);

  req.on('close', () => {
    alertClients = alertClients.filter(client => client !== res);
  });
});

// Endpoint to trigger a new alert manually or via webhooks
app.post('/alert', (req, res) => {
  const { user, type } = req.body;
  if (!user || !type) {
    return res.status(400).json({ success: false, error: 'Faltan campos user o type' });
  }

  const alertPayload = JSON.stringify({ user, type });
  alertClients.forEach(client => {
    client.write(`data: ${alertPayload}\n\n`);
  });

  console.log(`[Alert] Triggered: ${type} by ${user}`);
  res.json({ success: true });
});

// Endpoint to receive Owncast webhooks and stream chat messages to overlays
app.post('/owncast-webhook', (req, res) => {
  const { type, eventData } = req.body;
  
  if (type === 'CHAT' && eventData) {
    const chatPayload = JSON.stringify({
      dataType: 'CHAT',
      user: eventData.user.displayName,
      text: eventData.body
    });
    alertClients.forEach(client => {
      client.write(`data: ${chatPayload}\n\n`);
    });
    console.log(`[Owncast Chat Webhook] ${eventData.user.displayName}: ${eventData.body}`);
  }
  
  res.json({ success: true });
});

// ─── NOW PLAYING METADATA STORAGE ─────────────────────────────
let currentTrack = {
  artist: '',
  title: 'Transmisión Online',
  cover: ''
};

// Endpoint to get current playing song info
app.get('/now-playing', (req, res) => {
  res.json(currentTrack);
});

// Endpoint to update current playing song info from the local automation script
app.post('/now-playing', (req, res) => {
  const { artist, title, cover } = req.body;
  currentTrack = {
    artist: artist || '',
    title: title || 'Transmisión Online',
    cover: cover || ''
  };

  // Broadcast the update to SSE clients in case they listen to it in real-time
  const alertPayload = JSON.stringify({
    dataType: 'NOW_PLAYING',
    ...currentTrack
  });
  alertClients.forEach(client => {
    client.write(`data: ${alertPayload}\n\n`);
  });

  console.log(`[Now Playing] Updated: ${currentTrack.artist} - ${currentTrack.title}`);
  res.json({ success: true, currentTrack });
});

// ─── DISCORD WEBHOOK INTEGRATION HELPERS ──────────────────────
async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl || webhookUrl.includes('YOUR_') || !webhookUrl.startsWith('https://')) {
    console.warn('[Discord Webhook] Ignorado: URL no configurada o inválida.');
    return;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error(`[Discord Webhook] Error respuesta HTTP: ${response.status}`);
    }
  } catch (err) {
    console.error('[Discord Webhook] Error al realizar fetch:', err.message);
  }
}

// Determinar programa actual basado en la hora para los embeds
function getProgramForEmbed() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    const schedule = data.schedule || [];
    if (schedule.length === 0) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let activeSlots = [];
    for (const slot of schedule) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const s = sh * 60 + sm;
      const e = eh * 60 + em;

      if (e < s) { // Cruza medianoche
        if (currentMinutes >= s || currentMinutes < e) activeSlots.push(slot);
      } else {
        if (currentMinutes >= s && currentMinutes < e) activeSlots.push(slot);
      }
    }
    
    if (activeSlots.length === 0) return null;
    // Prioridad absoluta a los programas EN VIVO (type === 'live')
    const liveSlot = activeSlots.find(slot => slot.type === 'live');
    return liveSlot || activeSlots[0];
  } catch (e) {
    console.error('[Discord Webhook] Error leyendo programación:', e.message);
  }
  return null;
}

let lastStreamLiveState = null; // 'live', 'autodj', o 'offline'
let lastNotifiedLiveTitle = null; // Título del último programa en vivo notificado
let lastNotifiedAutoDJDate = null; // Fecha de la última notificación de AutoDJ (ej: 'Wed Jul 08 2026')

async function checkAndNotifyStreamStatus() {
  let isOwncastActive = false;
  let isLiveOnline = false;

  try {
    const response = await fetch('http://localhost:8080/api/status');
    if (response.ok) {
      const data = await response.json();
      isLiveOnline = data.online || false;
      isOwncastActive = true;
    }
  } catch (e) {
    // Si falla localmente, intentamos verificar via systemctl
  }

  if (!isOwncastActive) {
    // Fallback: verificar con systemctl
    try {
      await new Promise((resolve) => {
        exec('systemctl is-active owncast', (err, stdout) => {
          isOwncastActive = stdout.trim() === 'active';
          resolve();
        });
      });
    } catch (e) {}
  }

  const currentSlot = getProgramForEmbed();
  const isSlotLive = currentSlot && currentSlot.type === 'live';

  let currentState = 'offline';
  if (isOwncastActive) {
    // Si Owncast está transmitiendo, determinamos si es un programa en vivo o AutoDJ basado en la parrilla
    if (isLiveOnline) {
      currentState = isSlotLive ? 'live' : 'autodj';
    } else {
      currentState = 'autodj'; // Si no está online, consideramos que está en AutoDJ o listo para transmitir
    }
  }

  const webhookUrl = process.env.DISCORD_LIVE_WEBHOOK_URL;
  const mention = process.env.DISCORD_LIVE_MENTION || '@everyone';
  const todayDateString = new Date().toDateString();

  if (currentState === 'live') {
    const programTitle = currentSlot ? currentSlot.title : 'PROGRAMA EN VIVO';
    const programDesc = currentSlot ? currentSlot.desc : 'Sintoniza nuestra transmisión oficial.';
    const programHost = (currentSlot && currentSlot.host) ? currentSlot.host : '';
    const programStart = currentSlot ? currentSlot.start : '';
    const programEnd = currentSlot ? currentSlot.end : '';
    const timeStr = (programStart && programEnd) ? ` de ${programStart} a ${programEnd}` : '';

    // Notificar SOLO si no hemos notificado ya este programa en vivo (evita spam por desconexiones micro)
    if (lastNotifiedLiveTitle !== programTitle) {
      console.log(`[Stream Status Monitor] Notificando inicio de programa en vivo: "${programTitle}"`);
      
      let descriptionText = `¡Ya estamos al aire con el programa **${programTitle}**${timeStr}! 🎉\n\n`;
      if (programHost) {
        descriptionText += `🎙️ **Locutor:** ${programHost}\n`;
      }
      descriptionText += `📝 **Detalles:** ${programDesc}\n\nConéctate ahora mismo para escuchar la transmisión en alta definición y participar en el chat en vivo.`;

      const payload = {
        content: `${mention} **¡AKMOV Media está EN VIVO!** 🔴`,
        embeds: [
          {
            title: `🔴 ¡En Vivo: ${programTitle}!`,
            description: descriptionText,
            color: 65280, // Verde Neón (#00FF00)
            fields: [
              { name: '📻 Señal Online', value: '[Escuchar en la Web](https://akmovmedia.com)', inline: true },
              { name: '💬 Chat del Stream', value: '[Abrir Chat](https://stream.akmovmedia.com)', inline: true }
            ],
            thumbnail: {
              url: 'https://api.akmovmedia.com/logo.png'
            },
            footer: {
              text: 'AKMOV Media - El megáfono cultural del Valle del Huasco'
            },
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      await sendDiscordWebhook(webhookUrl, payload);
      lastNotifiedLiveTitle = programTitle;
      lastStreamLiveState = 'live';
    }
  } else if (currentState === 'autodj') {
    // Si cambió de vivo a AutoDJ, o si es la primera vez en el día que lo notificamos
    const shouldNotifyAutoDJ = (lastStreamLiveState === 'live') || (lastNotifiedAutoDJDate !== todayDateString);
    
    if (shouldNotifyAutoDJ && lastStreamLiveState !== 'autodj') {
      const blockTitle = currentSlot ? currentSlot.title : 'MÚSICA CONTINUA';
      const blockDesc = currentSlot ? currentSlot.desc : 'Disfrutando de la mejor selección musical regional y los clásicos de siempre en transmisión automática.';
      const blockStart = currentSlot ? currentSlot.start : '';
      const blockEnd = currentSlot ? currentSlot.end : '';
      const timeStr = (blockStart && blockEnd) ? ` (${blockStart} a ${blockEnd})` : '';

      console.log(`[Stream Status Monitor] Notificando modo Auto DJ (Límite: una vez al día o tras transmisión en vivo)`);
      
      const payload = {
        embeds: [
          {
            title: '📻 AKMOV Radio | Auto DJ Activo',
            description: `Hemos entrado al bloque **${blockTitle}**${timeStr}.\n\n*${blockDesc}*\n\n¡Te invitamos a sintonizar y escuchar nuestra señal online ahora mismo! 🎧`,
            color: 65280, // Verde Neón
            footer: {
              text: 'AKMOV Media - Transmisión Digital Continua'
            },
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      await sendDiscordWebhook(webhookUrl, payload);
      lastNotifiedAutoDJDate = todayDateString;
      lastStreamLiveState = 'autodj';
      lastNotifiedLiveTitle = null; // Reiniciamos para habilitar la alerta del siguiente en vivo
    }
  } else if (currentState === 'offline') {
    if (lastStreamLiveState !== 'offline') {
      console.log('[Stream Status Monitor] Señal offline.');
      lastStreamLiveState = 'offline';
      lastNotifiedLiveTitle = null;
    }
  }
}

// Iniciar monitoreo continuo cada 30 segundos
setInterval(checkAndNotifyStreamStatus, 30000);

// ─── STATUS (Owncast service status + Live stream data + OBS status) ───────
app.get('/status', (req, res) => {
  exec('systemctl is-active owncast', async (err, stdout) => {
    let serviceActive = stdout.trim() === 'active';
    let liveData = { online: false, viewerCount: 0 };
    
    // Intentar conectar al API local de Owncast siempre
    try {
      const response = await fetch('http://localhost:8080/api/status');
      if (response.ok) {
        const data = await response.json();
        liveData = {
          online: data.online || false,
          viewerCount: data.viewerCount || 0,
          lastConnectTime: data.lastConnectTime || null,
          overallMaxViewerCount: data.overallMaxViewerCount || 0,
        };
        // Si el puerto responde, Owncast definitivamente está activo
        serviceActive = true;
      }
    } catch (e) {
      // Si falla la conexión HTTP y systemd dice inactivo, entonces sí está caído
      console.log('Owncast HTTP API offline');
    }

    // Comprobar si el notebook del AutoDJ local se desconectó (ej. más de 30 segs sin reporte)
    const obsOnline = lastObsStatus.lastUpdate && 
                      (new Date() - new Date(lastObsStatus.lastUpdate) < 30000);

    // Disparar chequeo de estado de manera reactiva para notificaciones veloces
    checkAndNotifyStreamStatus();

    res.json({
      active: serviceActive,
      live: liveData,
      obs: {
        online: !!obsOnline,
        scene: lastObsStatus.scene,
        streaming: lastObsStatus.streaming,
        lastUpdate: lastObsStatus.lastUpdate
      },
      timestamp: new Date().toISOString()
    });
  });
});

// ─── OBS STATUS ENDPOINTS ─────────────────────────────────────
app.post('/obs/status', (req, res) => {
  const { scene, streaming } = req.body;
  lastObsStatus = {
    online: true,
    scene: scene || '—',
    streaming: !!streaming,
    lastUpdate: new Date().toISOString()
  };
  
  // Si tenemos un reinicio de Owncast pendiente y detectamos que OBS se ha desconectado limpiamente
  if (restartPending && !streaming) {
    console.log('[Bypass] OBS disconnected cleanly. Triggering Owncast restart now.');
    triggerOwncastRestart();
  }

  res.json({ success: true });
});

app.get('/obs/status', (req, res) => {
  res.json(lastObsStatus);
});

// Endpoint to bypass CORS and register to Owncast chat on behalf of the overlays
app.get('/owncast/chat-token', async (req, res) => {
  try {
    const registerResponse = await fetch('http://localhost:8080/api/chat/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'OBS_Overlay_Viewer' })
    });
    if (!registerResponse.ok) throw new Error('Owncast local API registration failed');
    const data = await registerResponse.json();
    res.json({ success: true, accessToken: data.accessToken });
  } catch (error) {
    // If local fails, try registering using the public domain (if accessible from server)
    try {
      const registerResponse = await fetch('https://stream.akmovmedia.com/api/chat/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'OBS_Overlay_Viewer' })
      });
      if (!registerResponse.ok) throw new Error('Owncast public API registration failed');
      const data = await registerResponse.json();
      res.json({ success: true, accessToken: data.accessToken });
    } catch (pubErr) {
      console.error('[Owncast Chat Token Error] Registration failed:', pubErr.message);
      res.status(500).json({ success: false, error: pubErr.message });
    }
  }
});


let bypassActiveUntil = 0;
let restartPending = false;
let restartTimeout = null;

function triggerOwncastRestart() {
  if (!restartPending) return;
  restartPending = false;
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  console.log('[Bypass] Restarting Owncast docker container...');
  const exec = require('child_process').exec;
  exec('docker restart owncast || sudo docker restart owncast', (err, stdout, stderr) => {
    if (err) {
      console.error('Error restarting owncast during bypass:', stderr || err.message);
    } else {
      console.log('[Bypass] Owncast container restarted successfully.');
    }
  });
}

// ─── SCHEDULE PERSISTENCE ENDPOINTS ───────────────────────────
const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');

app.get('/schedule', (req, res) => {
  fs.readFile(SCHEDULE_FILE, 'utf8', (err, data) => {
    let scheduleObj = { schedule: [] };
    if (!err) {
      try {
        scheduleObj = JSON.parse(data);
      } catch (e) {}
    }
    
    // Si hay un bypass activo (temporal de 5 min para dar tiempo al locutor en vivo),
    // inyectamos un bloque prioritario 'live' para que la automatización de Python
    // detenga su transmisión y espere sin intentar reanudarla.
    if (Date.now() < bypassActiveUntil) {
      if (!scheduleObj.schedule) scheduleObj.schedule = [];
      scheduleObj.schedule = [
        {
          start: "00:00",
          end: "23:59",
          title: "Bypass Temporal - Esperando Locutor",
          type: "live",
          desc: "Bypass activo por 5 minutos."
        },
        ...scheduleObj.schedule
      ];
    }
    
    res.json(scheduleObj);
  });
});

// Función para enviar la parrilla de programación a Discord
function notifyDiscordSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) return;
  
  const sorted = [...schedule].sort((a, b) => a.start.localeCompare(b.start));
  
  let tableMarkdown = "### 📅 PROGRAMACIÓN DE AKMOV MEDIA\n";
  tableMarkdown += "| Horario | Programa | Tipo | Descripción |\n";
  tableMarkdown += "| :--- | :--- | :--- | :--- |\n";
  
  sorted.forEach(slot => {
    const typeLabels = { live: 'EN VIVO 🔴', next: 'Siguiente 🟢', autodj: 'AutoDJ 📻', repeat: 'Repetición 🔁' };
    const typeStr = typeLabels[slot.type] || slot.type.toUpperCase();
    const descStr = slot.desc ? slot.desc.replace(/\|/g, '\\|') : '—';
    const titleStr = slot.host ? `${slot.title} *(Locutor: ${slot.host})*` : slot.title;
    tableMarkdown += `| **${slot.start} - ${slot.end}** | ${titleStr} | ${typeStr} | ${descStr} |\n`;
  });
  
  const payload = {
    embeds: [
      {
        title: "📅 Parrilla Programática Actualizada",
        description: tableMarkdown + "\n\n[Escuchar en vivo en la Web](https://akmovmedia.com)",
        color: 65280, // Verde Neón
        footer: {
          text: "AKMOV Media - El megáfono cultural del Valle del Huasco"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  sendDiscordWebhook(process.env.DISCORD_CALENDAR_WEBHOOK_URL, payload);
}

app.post('/schedule', (req, res) => {
  const data = JSON.stringify(req.body, null, 2);
  fs.writeFile(SCHEDULE_FILE, data, 'utf8', (err) => {
    if (err) {
      console.error('Error saving schedule:', err);
      return res.status(500).json({ success: false, error: 'No se pudo guardar la programación.' });
    }
    
    // Notificar a Discord sobre la nueva programación
    notifyDiscordSchedule(req.body.schedule);
    
    res.json({ success: true });
  });
});

app.post('/owncast/restart', (req, res) => {
  // Activar bypass temporal de 5 minutos
  bypassActiveUntil = Date.now() + 5 * 60 * 1000;
  restartPending = true;
  
  // Si OBS ya no está transmitiendo, podemos reiniciar de inmediato
  if (lastObsStatus && lastObsStatus.streaming === false) {
    triggerOwncastRestart();
    return res.json({ success: true, message: 'Señal liberada (Owncast reiniciado de inmediato).' });
  }

  // Si OBS está transmitiendo, esperamos a que el script de Python detecte el cambio de grilla
  // y apague el stream limpiamente. Establecemos un timeout de respaldo de 45 segundos por si acaso.
  console.log('[Bypass] OBS is streaming. Delaying Owncast restart until OBS disconnects cleanly...');
  
  restartTimeout = setTimeout(() => {
    if (restartPending) {
      console.warn('[Bypass] Backup timeout reached. Forcing Owncast restart...');
      triggerOwncastRestart();
    }
  }, 45000);

  res.json({ success: true, message: 'Señal liberada (OBS se desconectará limpiamente en unos segundos).' });
});

// ─── INSCRIPCIONES ENDPOINT (POST) ────────────────────────────
app.post('/inscripciones', (req, res) => {
  const data = req.body;
  
  if (!data.Nombre || !data.Contacto) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios (Nombre y Contacto)' });
  }

  const intereses = Array.isArray(data.Intereses) ? data.Intereses.join(', ') : (data.Intereses || 'Ninguno');
  const interesesOtro = data.Intereses_Otro ? ` (Otro: ${data.Intereses_Otro})` : '';
  const interesesFull = intereses + interesesOtro;
  
  const herramientas = Array.isArray(data.Herramientas) ? data.Herramientas.join(', ') : (data.Herramientas || 'Ninguna');

  const fields = [
    { name: '👤 Nombre Completo', value: data.Nombre, inline: true },
    { name: '🎂 Edad', value: data.Edad ? String(data.Edad) : 'No especificada', inline: true },
    { name: '📍 Residencia', value: data.Ciudad || 'No especificada', inline: true },
    { name: '📞 Contacto (WA/Email)', value: data.Contacto, inline: true },
    { name: '📱 Red Social', value: data.RedSocial || '—', inline: true },
    { name: '💼 Experiencia Previa', value: data.Experiencia || '—', inline: true },
    { name: '🎙️ Programa Propuesto', value: data.NombrePrograma || '—', inline: false },
    { name: '💡 Idea de Programa', value: data.Idea || '—', inline: false },
    { name: '👥 Coanimador', value: data.Coanimador || '—', inline: true },
    { name: '⚙️ Modalidad', value: data.Modalidad || '—', inline: true },
    { name: '🎵 Intereses Temáticos', value: interesesFull, inline: false },
    { name: '🛠️ Herramientas Disponibles', value: herramientas, inline: false },
    { name: '⏰ Disponibilidad Horaria', value: data.Disponibilidad || '—', inline: false }
  ];

  if (data.EnlacePitch) {
    fields.push({ name: '🔗 Enlace Pitch (Drive/YouTube)', value: data.EnlacePitch, inline: false });
  }

  const payload = {
    embeds: [
      {
        title: `🎙️ Nueva Inscripción: ${data.Nombre}`,
        description: 'Se ha recibido una nueva postulación para sumarse a AKMOV Media desde el formulario web.',
        color: 65280, // Verde Neón
        fields: fields,
        footer: {
          text: 'Auditoría de Inscripciones - AKMOV Media Staff'
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  sendDiscordWebhook(process.env.DISCORD_INSCRIPCIONES_WEBHOOK_URL, payload)
    .then(() => {
      res.json({ success: true, message: 'Inscripción recibida y enviada a Discord exitosamente.' });
    })
    .catch(err => {
      console.error('Error al enviar webhook de inscripción:', err);
      res.status(500).json({ success: false, error: 'No se pudo reportar a Discord.' });
    });
});

// ─── YOUTUBE ON DEMAND CHANNELS CONFIGURATION ─────────────────
const YOUTUBE_CHANNELS_FILE = path.join(__dirname, 'youtube_channels.json');

function getYoutubeChannels() {
  try {
    if (fs.existsSync(YOUTUBE_CHANNELS_FILE)) {
      const content = fs.readFileSync(YOUTUBE_CHANNELS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading youtube_channels.json:', err);
  }
  return [{ handle: '@lafukinrecords', count: 3 }];
}

function saveYoutubeChannels(channels) {
  try {
    fs.writeFileSync(YOUTUBE_CHANNELS_FILE, JSON.stringify(channels, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing youtube_channels.json:', err);
    return false;
  }
}

// Helper to fetch and parse the recent videos of a channel
async function getRecentVideosFromChannel(handle, maxCount = 3) {
  const url = `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}/videos`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) throw new Error(`HTTP error status ${res.status}`);
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.+?});<\/script>/) || html.match(/window\["ytInitialData"\] = ({.+?});/);
    if (!match) return [];
    
    const data = JSON.parse(match[1]);
    const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs;
    if (!tabs) return [];
    
    let videoTabContent = null;
    for (const tab of tabs) {
      if (tab.tabRenderer?.content?.richGridRenderer) {
        videoTabContent = tab.tabRenderer.content.richGridRenderer.contents;
        break;
      }
    }
    if (!videoTabContent) return [];
    
    const videos = [];
    for (const item of videoTabContent) {
      const lockup = item.richItemRenderer?.content?.lockupViewModel;
      if (!lockup) continue;
      
      const videoId = lockup.contentId;
      const metaVM = lockup.metadata?.lockupMetadataViewModel;
      if (!videoId || !metaVM) continue;
      
      const title = metaVM.title?.content || 'YouTube Video';
      const parts = metaVM.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts || [];
      const views = parts[0]?.text?.content || '';
      const published = parts[1]?.text?.content || '';
      
      const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      
      videos.push({
        id: videoId,
        title: title,
        thumbnail: thumbnail,
        published: published,
        views: views,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        channel: handle
      });
      
      if (videos.length === maxCount) break;
    }
    return videos;
  } catch (err) {
    console.error(`Error fetching videos for channel ${handle}:`, err);
    return [];
  }
}

app.get('/api/youtube/channels', (req, res) => {
  res.json(getYoutubeChannels());
});

app.post('/api/youtube/channels', (req, res) => {
  const { channels } = req.body;
  if (!channels || !Array.isArray(channels)) {
    return res.status(400).json({ success: false, error: 'Falta campo channels (array)' });
  }
  const success = saveYoutubeChannels(channels);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: 'No se pudo guardar la configuración.' });
  }
});

app.get('/youtube/videos', async (req, res) => {
  try {
    const channels = getYoutubeChannels();
    const allVideosPromises = channels.slice(0, 3).map(ch => {
      const handle = typeof ch === 'string' ? ch : ch.handle;
      const count = typeof ch === 'string' ? 3 : (ch.count || 3);
      return getRecentVideosFromChannel(handle, count);
    });
    const results = await Promise.all(allVideosPromises);
    const combinedVideos = results.flat();
    res.json({ success: true, videos: combinedVideos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DISCORD BOT FOR WELCOMES (guildMemberAdd) ────────────────
if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_WELCOME_CHANNEL_ID) {
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
      ]
    });

    client.on('guildMemberAdd', (member) => {
      const channelId = process.env.DISCORD_WELCOME_CHANNEL_ID;
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) {
        console.warn(`[Discord Bot] No se encontró el canal de bienvenida con ID: ${channelId}`);
        return;
      }

      const welcomeEmbed = {
        title: `👋 ¡Bienvenido/a a AKMOV MEDIA, ${member.user.username}!`,
        description: `¡Hola ${member}! Qué alegría que te sumes a nuestra comunidad. 🎸\n\nAquí compartimos música, streaming, cultura y gaming del Valle del Huasco y la Región de Atacama.\n\n📌 Date una vuelta por el servidor y saluda en el chat general. ¡Disfruta de la sintonía!`,
        color: 65280, // Verde Neón
        thumbnail: {
          url: member.user.displayAvatarURL({ dynamic: true, size: 256 })
        },
        footer: {
          text: `Eres el miembro #${member.guild.memberCount}`
        },
        timestamp: new Date().toISOString()
      };

      channel.send({ content: `¡Un nuevo oyente ha aterrizado! 🎧 ${member}`, embeds: [welcomeEmbed] })
        .then(() => console.log(`[Discord Bot] Bienvenida enviada a ${member.user.username}`))
        .catch(err => console.error('[Discord Bot] Error enviando bienvenida:', err));
    });

    client.login(process.env.DISCORD_BOT_TOKEN)
      .then(() => console.log('🤖 Bot de Discord conectado para escuchar bienvenidas.'))
      .catch(err => console.error('❌ Error al iniciar sesión en el bot de Discord:', err.message));

  } catch (err) {
    console.warn('⚠️ No se pudo cargar el cliente de Discord Bot (¿Falta instalar "discord.js"?).');
  }
}

// ─── BANNERS MANAGEMENT SYSTEM ──────────────────────────────────
const BANNERS_DIR = path.join(__dirname, 'banners');
if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

// Get list of banners
app.get('/api/banners', (req, res) => {
  try {
    if (!fs.existsSync(BANNERS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BANNERS_DIR);
    const imageFiles = files.filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
    res.json(imageFiles);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload a banner (base64)
app.post('/api/banners/upload', (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ success: false, error: 'Faltan filename o data (base64)' });
    }
    const matches = data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const destPath = path.join(BANNERS_DIR, safeFilename);
    fs.writeFileSync(destPath, buffer);
    console.log(`[Banners] Subido: ${safeFilename}`);
    res.json({ success: true, filename: safeFilename });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a banner
app.delete('/api/banners/:name', (req, res) => {
  try {
    const safeName = path.basename(req.params.name);
    const targetPath = path.join(BANNERS_DIR, safeName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`[Banners] Eliminado: ${safeName}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ service: 'AKMOV Media Admin API', status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AKMOV Admin API corriendo en http://0.0.0.0:${PORT}`);
});

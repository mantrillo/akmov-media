# Overlay AKMOV Media

Sistema modular de escenas y panel de control para streaming / OBS de **AKMOV Media**.

## 🚀 Contenido del Proyecto

- **Panel de Control del Streamer:** [`streamer.html`](streamer.html) (Control en tiempo real vía `BroadcastChannel` / `localStorage`)
- **Escenas OBS / Navegador:**
  - [`overlay.html`](overlay.html) - Overlay principal / Banner
  - [`scene-camara-chat.html`](scene-camara-chat.html) - Cámara principal con chat integrado y tickers
  - [`scene-escritorio.html`](scene-escritorio.html) - Vista de escritorio / pantalla completa
  - [`scene-invitado.html`](scene-invitado.html) - Escena dual / invitado
  - [`scene-reaccion.html`](scene-reaccion.html) - Escena para reacciones con PIP
  - [`scene-ya-comenzamos.html`](scene-ya-comenzamos.html) - Pantalla de inicio con cuenta regresiva
  - [`scene-nos-vemos-pronto.html`](scene-nos-vemos-pronto.html) - Pantalla de cierre de transmisión
  - [`scene-cam1.html`](scene-cam1.html) a [`scene-cam4.html`](scene-cam4.html) - Cámaras individuales
- **Lógica y Estilos:**
  - [`app.js`](app.js) - Controlador global, sincronización y eventos
  - [`styles.css`](styles.css) - Sistema de diseño oscuro y estilos responsive

## ⚙️ Uso en OBS

1. Añadir una fuente de navegador (*Browser Source*).
2. Seleccionar archivo local y apuntar a la escena deseada (o servir mediante un servidor web local).
3. Resolución recomendada: `1920x1080` (o la resolución nativa de tu lienzo).
4. Abrir [`streamer.html`](streamer.html) en tu navegador para controlar alertas, noticias, banners y temas en vivo.

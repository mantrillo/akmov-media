/* ============================================================
   AKMOV MEDIA — PANEL: ESTADÍSTICAS DE STREAM
   ============================================================
   Pestaña "ESTADÍSTICAS": audiencia en vivo, buscador por
   fecha + hora de inicio/término de un programa, gráficos e
   informe descargable (PDF / imagen / CSV).
   Datos servidos por stats-module.js (/api/stats/*).
   ============================================================ */

(function () {
  const API = AKMOV_API_BASE;
  const el = (id) => document.getElementById(id);

  const tabBtn = document.querySelector('.tab-btn[data-tab="stats"]');
  const form   = el('statsForm');
  if (!tabBtn || !form) return;

  // color: pantalla (fondo oscuro) · print: informe (fondo blanco)
  const SERIES = [
    { key: 'ov',    label: 'Owncast (web)',  color: '#00ff00', print: '#087a08' },
    { key: 'tv',    label: 'Twitch',         color: '#a970ff', print: '#6d28d9' },
    { key: 'kv',    label: 'Kick',           color: '#ffb000', print: '#b45309' },
    { key: 'total', label: 'Total stream',   color: '#ffffff', print: '#000000', dashed: [2, 3] },
    { key: 'w',     label: 'Visitantes web', color: '#38bdf8', print: '#0369a1', dashed: [6, 4] }
  ];
  const MAX_POINTS = 240;

  let charts = [];
  let lastResult = null;
  let nowTimer = null;
  let programs = [];
  let printMode = false;

  // ─── UTILIDADES DE FECHA (hora local del navegador) ─────────
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hours = (viewerMinutes) => (viewerMinutes / 60).toFixed(1);

  function formatDuration(minutes) {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return h ? `${h} h ${pad(m)} min` : `${m} min`;
  }

  function formatMoment(t, withDay) {
    const d = new Date(t);
    return (withDay ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ` : '') + localTime(d);
  }

  // ─── AUDIENCIA EN ESTE MOMENTO ──────────────────────────────
  function paintNow(id, source, on, viewers) {
    const node = el(id);
    if (source && !source.configured) {
      node.textContent = 'SIN CONFIGURAR';
      node.style.color = 'var(--text-dim)';
    } else if (source && !source.ok) {
      node.textContent = 'ERROR';
      node.title = source.error || '';
      node.style.color = 'var(--red)';
    } else if (on) {
      node.textContent = `${viewers} 👁  EN VIVO`;
      node.style.color = 'var(--neon)';
    } else {
      node.textContent = 'OFFLINE';
      node.style.color = 'var(--text-dim)';
    }
  }

  async function loadNow() {
    try {
      const res = await fetch(API + '/api/stats/now');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { sample, sources } = await res.json();
      if (!sample) return;
      paintNow('statsNowOwncast', sources.owncast, sample.o, sample.ov);
      paintNow('statsNowTwitch',  sources.twitch,  sample.tw, sample.tv);
      paintNow('statsNowKick',    sources.kick,    sample.k,  sample.kv);
      el('statsNowWeb').textContent = sample.w;
      el('statsNowUpdated').textContent = 'ACTUALIZADO ' + localTime(new Date(sample.t));
    } catch (e) {
      el('statsNowUpdated').textContent = 'SIN CONEXIÓN CON LA API';
    }
  }

  // ─── SELECTOR DE PROGRAMAS (desde la parrilla) ──────────────
  async function loadPrograms() {
    const select = el('statsProgram');
    try {
      const res = await fetch(API + '/schedule');
      if (!res.ok) return;
      const data = await res.json();
      const slots = (data.schedule || []).filter(s => !/^Bypass Temporal/.test(s.title || ''));
      programs = [...(data.liveEvents || []), ...slots]
        .filter(p => p.start && p.end)
        .sort((a, b) => ((b.date || '') + b.start).localeCompare((a.date || '') + a.start));

      select.length = 1;
      programs.forEach((p, i) => {
        const when = p.date ? p.date : 'Diario';
        select.add(new Option(`${when} · ${p.start}–${p.end} · ${p.title || 'Sin título'}`, String(i)));
      });
    } catch (e) {
      console.warn('No se pudo cargar la parrilla para estadísticas:', e);
    }
  }

  el('statsProgram').addEventListener('change', (e) => {
    const p = programs[Number(e.target.value)];
    if (e.target.value === '' || !p) return;
    if (p.date) el('statsDate').value = p.date;
    el('statsStart').value = p.start;
    el('statsEnd').value = p.end;
  });

  function selectedProgramTitle() {
    const value = el('statsProgram').value;
    const p = value === '' ? null : programs[Number(value)];
    return p ? (p.title || 'Sin título') : 'Horario manual';
  }

  // ─── DATOS DE PRUEBA (generados en el navegador) ────────────
  function summarize(samples, valueKey, onKey) {
    const withData = samples.filter(s => s[valueKey] !== null && s[valueKey] !== undefined);
    if (withData.length === 0) return null;
    let peak = -1, peakAt = null, sum = 0, live = 0;
    for (const s of withData) {
      sum += s[valueKey];
      if (s[valueKey] > peak) { peak = s[valueKey]; peakAt = s.t; }
      if (onKey && s[onKey]) live++;
    }
    return {
      peak, peakAt,
      avg: Math.round((sum / withData.length) * 10) / 10,
      viewerMinutes: sum,
      liveMinutes: onKey ? live : null,
      samples: withData.length
    };
  }

  function buildDemoData(from, to) {
    const minutes = Math.max(2, Math.round((to - from) / 60000));
    const samples = [];
    let drift = 0;
    for (let i = 0; i < minutes; i++) {
      const x = i / minutes;
      // Sube al empezar, se mantiene y cae al final, con algo de ruido
      const shape = Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + x * 0.95)), 0.7);
      drift = drift * 0.9 + (Math.random() - 0.5) * 2;
      const twitchLive = x > 0.04, kickLive = x > 0.07 && x < 0.96;
      samples.push({
        t: from + i * 60000,
        o: 1,              ov: Math.max(0, Math.round(5 + 34 * shape + drift * 2)),
        tw: +twitchLive,   tv: twitchLive ? Math.max(0, Math.round(3 + 21 * shape + drift)) : 0,
        k: +kickLive,      kv: kickLive ? Math.max(0, Math.round(2 + 13 * shape - drift)) : 0,
        w: Math.max(0, Math.round(14 + 48 * shape + drift * 3)),
        wn: Math.random() < 0.25 + 0.5 * shape ? 1 + Math.floor(Math.random() * 3) : 0
      });
    }

    const total = samples.map(s => ({ t: s.t, v: s.ov + s.tv + s.kv }));
    const web = summarize(samples, 'w', null);
    web.newSessions = samples.reduce((acc, s) => acc + s.wn, 0);

    const size = Math.ceil(samples.length / MAX_POINTS) || 1;
    const series = [];
    for (let i = 0; i < samples.length; i += size) {
      const chunk = samples.slice(i, i + size);
      const maxOf = (key) => Math.max(...chunk.map(s => s[key]));
      series.push({ t: chunk[0].t, ov: maxOf('ov'), tv: maxOf('tv'), kv: maxOf('kv'), w: maxOf('w') });
    }

    return {
      success: true, demo: true, from, to,
      sampleCount: samples.length,
      summary: {
        owncast: summarize(samples, 'ov', 'o'),
        twitch:  summarize(samples, 'tv', 'tw'),
        kick:    summarize(samples, 'kv', 'k'),
        total:   summarize(total, 'v', null),
        web
      },
      series
    };
  }

  // ─── GRÁFICOS ───────────────────────────────────────────────
  const colorOf = (s) => (printMode ? s.print : s.color);

  // Línea vertical que sigue al cursor sobre el gráfico de líneas
  const crosshair = {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const active = chart.tooltip && chart.tooltip.getActiveElements();
      if (!active || !active.length) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.strokeStyle = printMode ? '#999999' : '#555555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(active[0].element.x, chartArea.top);
      ctx.lineTo(active[0].element.x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };

  function renderCharts(data) {
    if (typeof Chart === 'undefined') return;
    charts.forEach(c => c.destroy());
    charts = [];

    const withDay = data.to - data.from > 20 * 60 * 60 * 1000;
    const textColor = printMode ? '#222222' : '#cccccc';
    const tickColor = printMode ? '#444444' : '#888888';
    const gridColor = printMode ? '#dddddd' : '#1c1c1c';
    const animation = printMode ? false : { duration: 600 };

    const points = data.series.map(p => ({
      ...p,
      total: (p.ov || 0) + (p.tv || 0) + (p.kv || 0)
    }));

    charts.push(new Chart(el('statsChart'), {
      type: 'line',
      plugins: [crosshair],
      data: {
        labels: points.map(p => formatMoment(p.t, withDay)),
        datasets: SERIES.map(s => ({
          label: s.label,
          data: points.map(p => p[s.key]),
          borderColor: colorOf(s),
          backgroundColor: colorOf(s) + (s.dashed ? '00' : '22'),
          fill: !s.dashed,
          borderWidth: 2,
          borderDash: s.dashed || [],
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.3
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor, usePointStyle: true, boxHeight: 7 } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y ?? '—'}` } }
        },
        scales: {
          x: { ticks: { color: tickColor, maxTicksLimit: 12 }, grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { color: tickColor, precision: 0 }, grid: { color: gridColor } }
        }
      }
    }));

    const platforms = [
      { s: SERIES[0], sum: data.summary.owncast },
      { s: SERIES[1], sum: data.summary.twitch },
      { s: SERIES[2], sum: data.summary.kick }
    ].filter(p => p.sum && p.sum.viewerMinutes > 0);

    charts.push(new Chart(el('statsShareChart'), {
      type: 'doughnut',
      data: {
        labels: platforms.map(p => p.s.label),
        datasets: [{
          data: platforms.map(p => Number(hours(p.sum.viewerMinutes))),
          backgroundColor: platforms.map(p => colorOf(p.s)),
          borderColor: printMode ? '#ffffff' : '#161616',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation,
        cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, boxHeight: 7 } },
          tooltip: {
            callbacks: {
              label: (c) => {
                const sum = c.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${c.label}: ${c.parsed} h (${Math.round((c.parsed / sum) * 100)} %)`;
              }
            }
          }
        }
      }
    }));
  }

  // ─── RESULTADOS ─────────────────────────────────────────────
  function kpiHtml(label, value, sub) {
    return `<div class="stats-kpi">
      <span class="status-key">${label}</span>
      <span class="stats-kpi-val">${value}</span>
      <span class="stats-kpi-sub">${sub}</span>
    </div>`;
  }

  function rowHtml(label, color, s, opts = {}) {
    if (!s) {
      return `<tr><td>${label}</td><td colspan="5" style="text-align: right; color: var(--text-dim);">${opts.missing || 'Sin datos en este rango'}</td></tr>`;
    }
    const dot = color ? `<span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>` : '';
    const num = 'text-align: right; font-family: var(--font-mono);';
    return `<tr>
      <td>${dot}${label}</td>
      <td style="${num} font-weight: 700; color: var(--neon);">${s.peak}</td>
      <td style="${num}">${formatMoment(s.peakAt, opts.withDay)}</td>
      <td style="${num}">${s.avg}</td>
      <td style="${num}">${opts.lastCol !== undefined ? opts.lastCol : hours(s.viewerMinutes)}</td>
      <td style="${num}">${s.liveMinutes === null ? '—' : formatDuration(s.liveMinutes)}</td>
    </tr>`;
  }

  function renderResult(data) {
    const withDay = data.to - data.from > 20 * 60 * 60 * 1000;
    const from = new Date(data.from), to = new Date(data.to);
    const minutes = Math.round((data.to - data.from) / 60000);

    el('statsReportProgram').textContent = data.programTitle;
    el('statsResultTitle').textContent =
      `${pad(from.getDate())}/${pad(from.getMonth() + 1)}/${from.getFullYear()} · ${localTime(from)} → ${localTime(to)} · ${formatDuration(minutes)}`;
    el('statsDemoFlag').classList.toggle('hidden', !data.demo);
    el('statsResultCard').classList.remove('hidden');

    const empty = data.sampleCount === 0;
    el('statsEmptyMsg').classList.toggle('hidden', !empty);
    el('statsResultBody').classList.toggle('hidden', empty);
    document.querySelector('#statsResultCard .stats-actions').classList.toggle('hidden', empty);
    if (empty) {
      el('statsEmptyMsg').textContent = 'No hay registros en este horario. Las estadísticas se guardan minuto a minuto desde que se activó el módulo en el servidor; los programas anteriores a esa fecha no tienen datos. Puedes usar "VER CON DATOS DE PRUEBA" para ver cómo se verá el informe.';
      return;
    }

    const s = data.summary;
    el('statsKpis').innerHTML =
      kpiHtml('PICO DE ESPECTADORES', s.total.peak, `a las ${formatMoment(s.total.peakAt, withDay)} · todas las plataformas`) +
      kpiHtml('PROMEDIO DE ESPECTADORES', s.total.avg, 'por minuto durante el programa') +
      kpiHtml('HORAS VISTAS', hours(s.total.viewerMinutes), 'suma de Owncast + Twitch + Kick') +
      kpiHtml('VISITAS A LA WEB', s.web ? s.web.newSessions : '—', s.web ? `pico de ${s.web.peak} visitantes a la vez` : 'sin datos');

    const dot = (i) => colorOf(SERIES[i]);
    const notConfigured = 'Sin datos (plataforma sin configurar en ese horario)';
    el('statsTableBody').innerHTML =
      rowHtml('Owncast (web)', dot(0), s.owncast, { withDay }) +
      rowHtml('Twitch', dot(1), s.twitch, { withDay, missing: notConfigured }) +
      rowHtml('Kick', dot(2), s.kick, { withDay, missing: notConfigured }) +
      rowHtml('<b>TOTAL STREAM</b>', '', s.total, { withDay }) +
      rowHtml('Visitantes web', dot(4), s.web, {
        withDay,
        lastCol: s.web ? `${s.web.newSessions} visitas` : '—'
      });

    el('statsFootnote').innerHTML =
      `<b>Horas vistas</b> = suma de espectadores por minuto ÷ 60. <b>Total stream</b> suma Owncast + Twitch + Kick en el mismo minuto. ` +
      `<b>Visitantes web</b> son pestañas de akmovmedia.com abiertas (vean o no el reproductor). ` +
      `Registros: ${data.sampleCount} de ${minutes} minutos del rango. Informe generado el ${new Date().toLocaleString('es-CL')}.`;

    renderCharts(data);
  }

  function readRange() {
    const date = el('statsDate').value, start = el('statsStart').value, end = el('statsEnd').value;
    if (!date || !start || !end) {
      toast('Completa la fecha, la hora de inicio y la hora de término.', 'error');
      return null;
    }
    const from = new Date(`${date}T${start}:00`);
    const to   = new Date(`${date}T${end}:00`);
    if (to <= from) to.setDate(to.getDate() + 1); // el programa cruzó la medianoche
    return { from: from.getTime(), to: to.getTime() };
  }

  function show(data) {
    data.programTitle = selectedProgramTitle();
    lastResult = data;
    renderResult(data);
    el('statsResultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const range = readRange();
    if (!range) return;

    const btn = el('statsSearchBtn');
    btn.disabled = true;
    btn.textContent = 'CONSULTANDO...';
    try {
      const res = await fetch(`${API}/api/stats/range?from=${range.from}&to=${range.to}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      show(data);
    } catch (err) {
      toast('No se pudieron obtener las estadísticas: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'CONSULTAR';
    }
  });

  el('statsDemoBtn').addEventListener('click', () => {
    const range = readRange();
    if (range) show(buildDemoData(range.from, range.to));
  });

  // ─── DESCARGAS: PDF / IMAGEN / CSV ──────────────────────────
  const fileBase = () => {
    const from = new Date(lastResult.from);
    return `akmov-audiencia-${localDate(from)}-${localTime(from).replace(':', '')}`;
  };
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function setPrintMode(on) {
    printMode = on;
    document.body.classList.toggle('stats-print-mode', on);
    if (lastResult) renderResult(lastResult);
  }

  // El navegador abre su diálogo de impresión: ahí se elige "Guardar como PDF"
  el('statsPdfBtn').addEventListener('click', async () => {
    if (!lastResult) return;
    setPrintMode(true);
    await nextFrame();
    window.print();
  });
  window.addEventListener('afterprint', () => { if (printMode) setPrintMode(false); });

  el('statsPngBtn').addEventListener('click', async () => {
    if (!lastResult) return;
    if (typeof html2canvas === 'undefined') {
      toast('No se pudo cargar el generador de imágenes. Revisa tu conexión.', 'error');
      return;
    }
    const btn = el('statsPngBtn');
    btn.disabled = true;
    try {
      const canvas = await html2canvas(el('statsResultCard'), {
        backgroundColor: '#111111',
        scale: 2,
        ignoreElements: (node) => node.classList && node.classList.contains('no-print')
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = fileBase() + '.png';
      link.click();
    } catch (err) {
      toast('No se pudo generar la imagen: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  el('statsCsvBtn').addEventListener('click', () => {
    if (!lastResult || !lastResult.series.length) return;
    const cell = (v) => (v === null || v === undefined ? '' : v);
    const lines = ['fecha,hora,owncast,twitch,kick,visitantes_web'];
    lastResult.series.forEach(p => {
      const d = new Date(p.t);
      lines.push([localDate(d), localTime(d), cell(p.ov), cell(p.tv), cell(p.kv), cell(p.w)].join(','));
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    link.download = fileBase() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  // ─── ACTIVACIÓN DE LA PESTAÑA ───────────────────────────────
  function setDefaults() {
    if (el('statsDate').value) return;
    const now = new Date(), hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    el('statsDate').value  = localDate(hourAgo);
    el('statsStart').value = localTime(hourAgo);
    el('statsEnd').value   = localTime(now);
  }

  tabBtn.addEventListener('click', () => {
    setDefaults();
    loadPrograms();
    loadNow();
    if (!nowTimer) {
      nowTimer = setInterval(() => {
        if (el('tab-stats').classList.contains('active')) loadNow();
      }, 30000);
    }
  });
})();

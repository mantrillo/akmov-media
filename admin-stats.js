/* ============================================================
   AKMOV MEDIA — PANEL: ESTADÍSTICAS DE STREAM
   ============================================================
   Pestaña "ESTADÍSTICAS": audiencia en vivo y buscador por
   fecha + hora de inicio/término de un programa.
   Datos servidos por stats-module.js (/api/stats/*).
   ============================================================ */

(function () {
  const API = AKMOV_API_BASE;
  const el = (id) => document.getElementById(id);

  const tabBtn = document.querySelector('.tab-btn[data-tab="stats"]');
  const form   = el('statsForm');
  if (!tabBtn || !form) return;

  const SERIES = [
    { key: 'ov', label: 'Owncast (web)',     color: '#00ff00' },
    { key: 'tv', label: 'Twitch',            color: '#a970ff' },
    { key: 'kv', label: 'Kick',              color: '#ffb000' },
    { key: 'w',  label: 'Visitantes web',    color: '#38bdf8', dashed: true }
  ];

  let chart = null;
  let lastResult = null;
  let nowTimer = null;
  let programs = [];

  // ─── UTILIDADES DE FECHA (hora local del navegador) ─────────
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
      const events = (data.liveEvents || []).map(ev => ({ ...ev, isEvent: true }));
      const slots  = (data.schedule || []).filter(s => !/^Bypass Temporal/.test(s.title || ''));
      programs = [...events, ...slots]
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

  // ─── CONSULTA DE UN RANGO ───────────────────────────────────
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
      <td style="${num}">${opts.lastCol !== undefined ? opts.lastCol : (s.viewerMinutes / 60).toFixed(1)}</td>
      <td style="${num}">${s.liveMinutes === null ? '—' : formatDuration(s.liveMinutes)}</td>
    </tr>`;
  }

  function renderChart(series, withDay) {
    if (typeof Chart === 'undefined') return;
    if (chart) chart.destroy();
    chart = new Chart(el('statsChart'), {
      type: 'line',
      data: {
        labels: series.map(p => formatMoment(p.t, withDay)),
        datasets: SERIES.map(s => ({
          label: s.label,
          data: series.map(p => p[s.key]),
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: 2,
          borderDash: s.dashed ? [5, 4] : [],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.25,
          spanGaps: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#cccccc', usePointStyle: true, boxHeight: 7 } }
        },
        scales: {
          x: { ticks: { color: '#888888', maxTicksLimit: 12 }, grid: { color: '#1c1c1c' } },
          y: { beginAtZero: true, ticks: { color: '#888888', precision: 0 }, grid: { color: '#1c1c1c' } }
        }
      }
    });
  }

  function renderResult(data) {
    const withDay = data.to - data.from > 20 * 60 * 60 * 1000;
    const from = new Date(data.from), to = new Date(data.to);
    el('statsResultTitle').textContent = `${localDate(from)} · ${localTime(from)} → ${localTime(to)}`;
    el('statsResultCard').classList.remove('hidden');

    const empty = data.sampleCount === 0;
    el('statsEmptyMsg').classList.toggle('hidden', !empty);
    el('statsResultBody').classList.toggle('hidden', empty);
    el('statsCsvBtn').classList.toggle('hidden', empty);
    if (empty) {
      el('statsEmptyMsg').textContent = 'No hay registros en este horario. Las estadísticas se guardan minuto a minuto desde que se activó el módulo en el servidor; los programas anteriores a esa fecha no tienen datos.';
      return;
    }

    const s = data.summary;
    const notConfigured = 'Sin datos (plataforma sin configurar en ese horario)';
    el('statsTableBody').innerHTML =
      rowHtml('Owncast (web)', SERIES[0].color, s.owncast, { withDay }) +
      rowHtml('Twitch', SERIES[1].color, s.twitch, { withDay, missing: notConfigured }) +
      rowHtml('Kick', SERIES[2].color, s.kick, { withDay, missing: notConfigured }) +
      rowHtml('<b>TOTAL STREAM</b>', '', s.total, { withDay }) +
      rowHtml('Visitantes web', SERIES[3].color, s.web, {
        withDay,
        lastCol: s.web ? `${s.web.newSessions} visitas` : '—'
      });

    const expected = Math.round((data.to - data.from) / 60000);
    el('statsFootnote').innerHTML =
      `<b>Horas vistas</b> = suma de espectadores por minuto ÷ 60. <b>Total stream</b> suma Owncast + Twitch + Kick en el mismo minuto. ` +
      `<b>Visitantes web</b> son pestañas de akmovmedia.com abiertas (vean o no el reproductor). ` +
      `Registros: ${data.sampleCount} de ${expected} minutos del rango.`;

    renderChart(data.series, withDay);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = el('statsDate').value, start = el('statsStart').value, end = el('statsEnd').value;
    if (!date || !start || !end) return;

    const from = new Date(`${date}T${start}:00`);
    const to   = new Date(`${date}T${end}:00`);
    if (to <= from) to.setDate(to.getDate() + 1); // el programa cruzó la medianoche

    const btn = el('statsSearchBtn');
    btn.disabled = true;
    btn.textContent = 'CONSULTANDO...';
    try {
      const res = await fetch(`${API}/api/stats/range?from=${from.getTime()}&to=${to.getTime()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      lastResult = data;
      renderResult(data);
    } catch (err) {
      toast('No se pudieron obtener las estadísticas: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'CONSULTAR';
    }
  });

  // ─── EXPORTAR CSV ───────────────────────────────────────────
  el('statsCsvBtn').addEventListener('click', () => {
    if (!lastResult || !lastResult.series.length) return;
    const cell = (v) => (v === null || v === undefined ? '' : v);
    const lines = ['fecha,hora,owncast,twitch,kick,visitantes_web'];
    lastResult.series.forEach(p => {
      const d = new Date(p.t);
      lines.push([localDate(d), localTime(d), cell(p.ov), cell(p.tv), cell(p.kv), cell(p.w)].join(','));
    });
    const from = new Date(lastResult.from);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    link.download = `akmov-stats-${localDate(from)}-${localTime(from).replace(':', '')}.csv`;
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

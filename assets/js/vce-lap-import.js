/* Shared file viewer for coached training and the Telemetry Tour workspace. */
(() => {
  'use strict';

  const root = document.querySelector('[data-vce-lap-import]');
  if (!root) return;

  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return '—';
    const ms = Math.round(seconds * 1000);
    return Math.floor(ms / 60000) + ':' + String(Math.floor(ms % 60000 / 1000)).padStart(2, '0') +
      '.' + String(ms % 1000).padStart(3, '0');
  };
  const display = (value, unit = '', digits = 0) => Number.isFinite(value) ? value.toFixed(digits) + unit : '—';
  const svgTag = (name, attrs = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };

  root.innerHTML = `
    <div class="vce-lap-heading">
      <div><h2>Importer un tour</h2><p>Analyse une archive VCE JSON, un CSV ou un tracé GPX. Le fichier reste dans ce navigateur.</p></div>
      <label class="vce-lap-picker">Choisir un fichier<input data-role="file" type="file" accept=".json,.csv,.gpx"></label>
    </div>
    <p data-role="status" role="status" hidden></p>
    <div data-role="details" hidden>
      <div class="vce-lap-selection">
        <label data-role="sessions-label">Session<select data-role="session"></select></label>
        <label>Tour ou segment<select data-role="lap"></select></label>
        <div><small data-role="track-label">Circuit</small><strong data-role="track"></strong></div>
        <div><small data-role="time-label">Chrono</small><strong data-role="time"></strong></div>
        <button data-role="apply" type="button" hidden>Reporter dans la fiche de suivi</button>
      </div>
      <div class="vce-lap-panels">
        <section aria-label="Trajectoire">
          <h3>Trajectoire <small data-role="source"></small></h3>
          <svg data-role="map" viewBox="0 0 520 300" role="img" aria-label="Trajectoire et position du véhicule"></svg>
          <p data-role="gps"></p>
        </section>
        <section aria-label="Commandes du pilote">
          <h3>Commandes et vitesse</h3>
          <div class="vce-lap-meters">
            <div class="vce-lap-throttle"><small>Accélérateur</small><strong data-role="throttle"></strong><progress data-role="throttle-bar" max="1" value="0" aria-label="Accélérateur"></progress></div>
            <div class="vce-lap-brake"><small>Frein</small><strong data-role="brake"></strong><progress data-role="brake-bar" max="1" value="0" aria-label="Frein"></progress></div>
            <div><small>Vitesse</small><strong data-role="speed"></strong></div>
            <div><small>Rapport</small><strong data-role="gear"></strong></div>
          </div>
          <svg data-role="chart" viewBox="0 0 520 154" role="img" aria-label="Courbes d’accélérateur, frein et vitesse"></svg>
          <p class="vce-lap-legend"><span>Accélérateur</span><span>Frein</span><span>Vitesse</span></p>
        </section>
      </div>
      <div class="vce-lap-scrub">
        <label>Explorer le tour<input data-role="seek" type="range" min="0" max="0" value="0"></label>
        <output data-role="position"></output>
      </div>
    </div>`;

  const get = name => root.querySelector('[data-role="' + name + '"]');
  const set = (name, value) => { get(name).textContent = value; };
  const form = {track: document.getElementById('vceCircuit'), time: document.getElementById('vceChrono')};
  const status = get('status');
  const seek = get('seek');
  let sessions = [], current, mapPoints, mapDot, chartLine, catalogue, request = 0;

  function showStatus(message, error = false) {
    status.hidden = !message;
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function path(svg, points, color, width) {
    let drawing = false;
    let commands = '';
    for (const point of points) {
      if (!point) { drawing = false; continue; }
      commands += (drawing ? 'L' : 'M') + point.map(value => value.toFixed(2)).join(' ') + ' ';
      drawing = true;
    }
    svg.append(svgTag('path', {d: commands, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
  }

  function placeholder(svg, message, y) {
    const text = svgTag('text', {x: 260, y, 'text-anchor': 'middle', fill: '#a8bbd1', 'font-size': 15});
    text.textContent = message;
    svg.append(text);
  }

  function drawMap(points) {
    const svg = get('map');
    svg.replaceChildren();
    mapDot = null;
    const map = window.VCELapImportData.project(points);
    mapPoints = [];
    set('source', map?.type || '');
    if (!map) { placeholder(svg, 'Trajectoire indisponible', 155); return; }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of map.positions.filter(Boolean)) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const scale = Math.min(468 / Math.max(1, maxX - minX), 248 / Math.max(1, maxZ - minZ));
    mapPoints = map.positions.map(p => p ? [
      260 + (p[0] - (maxX + minX) / 2) * scale,
      150 - (p[1] - (maxZ + minZ) / 2) * scale
    ] : null);
    path(svg, mapPoints, '#294863', 10);
    path(svg, mapPoints, '#66c9ff', 3);
    mapDot = svgTag('circle', {r: 6, fill: '#ff5275', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden'});
    svg.append(mapDot);
  }

  function drawChart(points) {
    const svg = get('chart');
    svg.replaceChildren();
    chartLine = null;
    const channels = [['throttle', '#45e2aa', 1], ['brake', '#ff5275', 1], ['speed', '#66c9ff', 0]];
    if (!channels.some(([key]) => points.some(point => point[key] !== null))) {
      placeholder(svg, 'Courbes indisponibles', 82);
      return;
    }
    for (const y of [18, 57, 97, 136]) svg.append(svgTag('line', {x1: 12, x2: 508, y1: y, y2: y, stroke: '#263a53'}));
    for (const [key, color, max] of channels) {
      const scale = max || points.reduce((peak, p) => Math.max(peak, p[key] ?? 0), 1);
      path(svg, points.map((p, i) => p[key] === null ? null : [chartX(i, points.length), 136 - 118 * p[key] / scale]), color, 2);
    }
    chartLine = svgTag('line', {y1: 12, y2: 142, stroke: '#e5eeff', 'stroke-dasharray': '4 4'});
    svg.append(chartLine);
  }

  function chartX(index, length) {
    return 12 + 496 * index / Math.max(1, length - 1);
  }

  function updatePosition() {
    const i = Number(seek.value);
    const point = current.points[i];
    set('position', point ? [formatTime(point.t), display(point.progress === null ? null : point.progress * 100, ' %'),
      (i + 1) + ' / ' + current.points.length].join(' · ') : '—');
    seek.setAttribute('aria-valuetext', get('position').textContent);
    for (const key of ['throttle', 'brake']) {
      const value = point?.[key];
      set(key, display(Number.isFinite(value) ? value * 100 : null, ' %'));
      get(key + '-bar').value = value ?? 0;
      get(key + '-bar').hidden = value == null;
    }
    set('speed', display(point?.speed, ' km/h'));
    set('gear', point?.gear === -1 ? 'R' : point?.gear === 0 ? 'N' : display(point?.gear));
    const gps = Number.isFinite(point?.lat) && Number.isFinite(point?.lon);
    set('gps', gps ? [display(point.lat, '°', 5), display(point.lon, '°', 5),
      Number.isFinite(point.alt) ? display(point.alt, ' m') : null].filter(Boolean).join(' · ') : '');
    if (mapDot) {
      const coords = mapPoints[i];
      mapDot.setAttribute('visibility', coords ? 'visible' : 'hidden');
      if (coords) {
        mapDot.setAttribute('cx', coords[0]);
        mapDot.setAttribute('cy', coords[1]);
      }
    }
    if (chartLine) {
      const x = chartX(i, current.points.length);
      chartLine.setAttribute('x1', x);
      chartLine.setAttribute('x2', x);
    }
  }

  function selectLap() {
    const session = sessions[+get('session').value];
    current = session.laps[+get('lap').value];
    set('track-label', session.gps ? 'Nom du tracé GPS' : session.inferred ? 'Circuit · d’après le nom du fichier' : 'Circuit');
    set('track', [session.track, session.layout].filter(Boolean).join(' · ') || 'Non renseigné');
    set('time-label', current.time !== null ? 'Chrono' : 'Durée enregistrée');
    set('time', formatTime(current.time ?? current.duration));
    get('apply').hidden = !form.track || !form.time || ((!session.track || session.gps) && current.time === null);
    seek.max = String(Math.max(0, current.points.length - 1));
    seek.value = '0';
    seek.disabled = current.points.length < 2;
    drawMap(current.points);
    drawChart(current.points);
    updatePosition();
    document.dispatchEvent(new CustomEvent('vce-video-lap', {
      detail: {lap:current,track:session.track,game:session.game,car:session.car}
    }));
  }

  function selectSession() {
    const session = sessions[+get('session').value];
    get('lap').replaceChildren(...session.laps.map((lap, i) => new Option([
      lap.name || 'Tour ' + lap.number,
      lap.partial ? 'Partiel' : lap.valid === false ? 'Invalide' : '',
      lap.time !== null ? formatTime(lap.time) : ''
    ].filter(Boolean).join(' · '), i)));
    selectLap();
  }

  get('session').addEventListener('change', selectSession);
  get('lap').addEventListener('change', selectLap);
  seek.addEventListener('input', updatePosition);
  get('apply').addEventListener('click', () => {
    const session = sessions[+get('session').value];
    const values = [session.gps ? '' : session.track, current.time === null ? '' : formatTime(current.time)];
    [form.track, form.time].forEach((field, index) => {
      if (!values[index]) return;
      field.value = values[index];
      field.dispatchEvent(new Event('input', {bubbles: true}));
    });
    showStatus('Données reportées dans la fiche de suivi.');
  });
  get('file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const id = ++request;
    event.target.value = '';
    document.dispatchEvent(new CustomEvent('vce-video-lap'));
    showStatus('Lecture du fichier…');
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error('Le fichier dépasse 150 Mo. Exporte une session plus courte.');
      const contents = await file.text();
      if (id !== request) return;
      const parsed = window.VCELapImportData.parse(contents, file.name);
      if (parsed.length === 1 && !parsed[0].gps && !parsed[0].track) {
        catalogue ??= fetch('data/longueurs-circuits.json')
          .then(response => response.ok ? response.json() : {})
          .then(data => Object.keys(data.circuits || {}))
          .catch(() => []);
        const track = window.VCELapImportData.circuitFromFilename(file.name, await catalogue);
        if (id !== request) return;
        if (track) Object.assign(parsed[0], {track, inferred: true});
      }
      sessions = parsed;
      get('session').replaceChildren(...sessions.map((s, i) =>
        new Option([s.game, s.track, s.car].filter(Boolean).join(' · ') || 'Session ' + (i + 1), i)));
      get('sessions-label').hidden = sessions.length < 2;
      selectSession();
      get('details').hidden = false;
      showStatus(file.name + ' · ' + sessions.reduce((sum, s) => sum + s.laps.length, 0) + ' tour(s) ou segment(s)');
    } catch (error) {
      if (id !== request) return;
      get('details').hidden = true;
      showStatus('Import impossible. ' + (error instanceof SyntaxError ? 'Le fichier JSON est illisible.' : error.message), true);
    }
  });
})();

/* Read telemetry archives locally and normalize the channels used by the lap viewer. */
(() => {
  'use strict';

  const number = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const first = (...values) => values.map(number).find(value => value !== null) ?? null;
  const bounded = (value, min, max) => value !== null && value >= min && value <= max ? value : null;
  const scaled = (value, scale) => value === null ? null : value * scale;
  const label = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
  const positive = value => value !== null && value > 0 ? value : null;

  function sample(row) {
    return {
      t: first(scaled(first(row.elapsed_ms, row.t_ms, row.time_ms), .001), row.t, row.elapsed_s, row.time_s, row.timestamp, scaled(number(row.lap_time_ms), .001)),
      speed: bounded(first(row.speed_kmh, row.speed_kph, row.speed, scaled(number(row.speed_mps), 3.6)), 0, 900),
      throttle: bounded(first(scaled(number(row.throttle_pct), .01), row.throttle, row.accelerator), 0, 1),
      brake: bounded(first(scaled(number(row.brake_pct), .01), row.brake), 0, 1),
      gear: bounded(number(row.gear), -1, 30),
      progress: bounded(first(row.lap_pos, row.progress, row.distance), 0, 1),
      x: first(row.world_x, row.x),
      z: first(row.world_z, row.z, row.y),
      lat: bounded(first(row.latitude, row.lat, row.gps_latitude, row.gps_lat), -90, 90),
      lon: bounded(first(row.longitude, row.lon, row.lng, row.gps_longitude, row.gps_lon), -180, 180),
      alt: first(row.altitude_m, row.altitude, row.elevation, row.ele)
    };
  }

  function lap(raw, index) {
    const points = (raw.samples || []).filter(row => row && typeof row === 'object').map(sample);
    const origin = points.find(point => point.t !== null)?.t ?? 0;
    for (const point of points) if (point.t !== null) point.t -= origin;
    const duration = positive(points.reduce((max, point) => Math.max(max, point.t ?? 0), 0));
    return {
      number: first(raw.lap_number, raw.number) ?? index + 1,
      name: label(raw.name),
      time: raw.partial === true ? null : positive(first(scaled(number(raw.lap_time_ms), .001), raw.time, raw.lap_time_s)),
      partial: raw.partial === true,
      valid: raw.valid,
      duration,
      points
    };
  }

  function json(text) {
    const parsed = JSON.parse(text);
    const files = Array.isArray(parsed?.sessions) ? parsed.sessions : Array.isArray(parsed) ? [{samples: parsed}] : [parsed];
    return files.filter(item => item && typeof item === 'object').map(item => {
      const meta = item.session || item;
      const laps = [item.raw_laps, item.laps, meta.laps].find(value => Array.isArray(value) && value.length);
      return {
        track: label(meta.track, meta.circuit, meta.track_name, item.track),
        layout: label(meta.layout, meta.track_layout),
        game: label(meta.game),
        car: label(meta.car),
        laps: (laps || (Array.isArray(item.samples) ? [item] : []))
          .filter(entry => entry && Array.isArray(entry.samples)).map(lap)
      };
    });
  }

  function csv(text) {
    const header = text.split(/\r?\n/, 1)[0];
    const separators = [',', ';', '\t'];
    const delimiter = separators.reduce((best, option) => header.split(option).length > header.split(best).length ? option : best, ',');
    const sessions = new Map();
    let columns, row = [], cell = '', quoted = false;
    function nextRow() {
      row.push(cell);
      cell = '';
      if (!columns) columns = row.map(key => key.trim().toLowerCase().replace(/[ -]+/g, '_'));
      else if (row.some(value => value.trim())) {
        const entry = Object.fromEntries(columns.map((key, i) => [key, row[i] ?? '']));
        const track = label(entry.track, entry.circuit, entry.track_name);
        const key = JSON.stringify([track, entry.layout, entry.game, entry.car, entry.session_id]);
        if (!sessions.has(key)) sessions.set(key, {track, layout: entry.layout, game: entry.game, car: entry.car, laps: new Map()});
        const laps = sessions.get(key).laps;
        const id = first(entry.lap_number, entry.lap) ?? 1;
        if (!laps.has(id)) laps.set(id, {lap_number: id, lap_time_ms: null, lap_time_s: null, samples: []});
        const current = laps.get(id);
        current.lap_time_ms = positive(number(entry.completed_lap_time_ms)) ?? current.lap_time_ms;
        current.lap_time_s = positive(number(entry.lap_time_s)) ?? current.lap_time_s;
        current.samples.push(entry);
      }
      row = [];
    }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && char === delimiter) {
        row.push(cell);
        cell = '';
      } else if (!quoted && (char === '\n' || char === '\r')) {
        nextRow();
        if (char === '\r' && text[i + 1] === '\n') i++;
      } else cell += char;
    }
    if (quoted) throw new Error('CSV incomplet ou guillemets mal fermés.');
    if (cell || row.length) nextRow();
    return [...sessions.values()].map(session => ({...session, laps: [...session.laps.values()].map(lap)}));
  }

  function gpx(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.documentElement.localName !== 'gpx' || xml.querySelector('parsererror')) {
      throw new Error('Le fichier GPX est illisible.');
    }
    const read = (node, name) => [...node.children].find(child => child.localName === name)?.textContent;
    const descendants = (node, name) => [...node.getElementsByTagNameNS('*', name)];
    return descendants(xml, 'trk').map(track => ({
      track: label(read(track, 'name')),
      gps: true,
      laps: descendants(track, 'trkseg').map((segment, index) => lap({
        name: 'Segment GPS ' + (index + 1),
        samples: descendants(segment, 'trkpt').map(point => ({
          latitude: point.getAttribute('lat'),
          longitude: point.getAttribute('lon'),
          altitude: read(point, 'ele'),
          t: Date.parse(read(point, 'time')) / 1000,
          speed_mps: read(point, 'speed') ?? descendants(point, 'speed')[0]?.textContent
        }))
      }, index))
    }));
  }

  function circuitFromFilename(filename, catalogue) {
    // Match whole filename tokens and prefer the most specific known circuit name.
    const words = text => ' ' + text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const base = words(filename.replace(/\.[^.]+$/, ''));
    const candidates = catalogue.filter(name => base.includes(words(name))).sort((a, b) => b.length - a.length);
    if (candidates[1] && !words(candidates[0]).includes(words(candidates[1]))) return '';
    return candidates[0] || '';
  }

  function parse(text, filename) {
    const extension = filename.split('.').at(-1).toLowerCase();
    const parsers = {json, csv, gpx};
    if (!Object.hasOwn(parsers, extension)) throw new Error('Sélectionne un fichier JSON VCE, CSV ou GPX.');
    const sessions = parsers[extension](text.replace(/^\uFEFF/, '')).map(session => ({
      ...session, laps: session.laps.filter(tour => tour.time !== null || tour.points.some(p =>
        p.speed !== null || p.throttle !== null || p.brake !== null || p.gear !== null ||
        p.progress !== null || (p.x !== null && p.z !== null) || (p.lat !== null && p.lon !== null)))
    })).filter(session => session.laps.length);
    if (!sessions.length) throw new Error('Aucun tour, chrono ou canal reconnu dans ce fichier.');
    return sessions;
  }

  function project(points) {
    const hasPair = (point, a, b) => point[a] !== null && point[b] !== null;
    let origin = points.find(point => hasPair(point, 'lat', 'lon'));
    let positions = origin ? points.map(point => hasPair(point, 'lat', 'lon') ? [
      ((point.lon - origin.lon + 540) % 360 - 180) * Math.cos(origin.lat * Math.PI / 180) * 111195,
      (point.lat - origin.lat) * 111195
    ] : null) : [];
    const distinct = values => {
      origin = values.find(Boolean);
      return origin && values.some(p => p && Math.hypot(p[0] - origin[0], p[1] - origin[1]) > .05);
    };
    if (distinct(positions)) return {positions, type: 'GPS'};
    positions = points.map(point => hasPair(point, 'x', 'z') ? [point.x, point.z] : null);
    return distinct(positions) ? {positions, type: 'X/Z SIMULATEUR'} : null;
  }

  window.VCELapImportData = {parse, project, circuitFromFilename};
})();

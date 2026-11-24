/* One sporting result feeds both profile panels and the shared leaderboard. */
(() => {
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  function delta(row) {
    const race = row.race || {}, result = row.result || {};
    if (race.ratingEnabled === false || ['none', 'manual'].includes(race.ratingMode) || race.competitionType === 'event') return 0;
    if (/DNF|ABANDON/.test(norm(result.status || result.statut))) return -25;
    const pos = Number(result.position);
    return !Number.isInteger(pos) || pos < 1 ? 0 : pos === 1 ? 100 : pos <= 3 ? 80 : pos <= 8 ? 25 : pos <= 12 ? 10 : pos <= 18 ? -10 : -25;
  }
  function signature(row, driver) {
    return [norm(driver), String(row.result.resultDate || row.race.date || '').slice(0, 10), norm(row.race.event), norm(row.race.circuit)].join('|');
  }
  function merge(publication, accepted) {
    const rows = [];
    for (const preset of publication?.presets || []) {
      if (!preset.published || !preset.data) continue;
      for (const result of preset.data.results || []) {
        const lead = [result.firstName, result.lastName].filter(Boolean).join(' ').trim() || result.pilot || result.name || '';
        const drivers = [...new Map([lead, ...(Array.isArray(result.drivers) ? result.drivers : [])].filter(Boolean).map(name => [norm(name), name])).values()];
        rows.push({preset: preset.id, race: preset.data, result, drivers});
      }
    }
    // A separately published official result takes precedence over its accepted proposal.
    const official = new Set(rows.flatMap(row => row.drivers.map(driver => signature(row, driver))));
    const linked = new Set(rows.flatMap(row => row.drivers.map(driver => [row.result.submissionId || row.race.submissionId || '', norm(driver)].join('|'))));
    const seen = new Set();
    for (const item of accepted || []) {
      if (item.status && item.status !== 'accepted') continue;
      const row = {preset: 'submission:' + item.id, submissionId: item.id,
        race: {event: item.event_name, date: item.race_date, circuit: item.track, competitionType:item.category==='rally'?'rally':'race',mode: item.category === 'endurance' ? 'endurance' : 'individuel'},
        result: {position: item.finishing_position, car: item.car}, drivers: [item.pilot_slug]};
      const key = signature(row, item.pilot_slug);
      if (official.has(key) || linked.has([item.id, norm(item.pilot_slug)].join('|')) || seen.has(key)) continue;
      seen.add(key); rows.push(row);
    }
    return rows;
  }
  window.VCERaceRating = {delta, merge, norm};
})();

/* One sporting result feeds both profile panels and the shared leaderboard. */
(() => {
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const types = {
    championship: {label:'Course championnat',points:[80,65,50,35,20,8,2]},
    daily: {label:'Course Daily / OPEN',points:[50,40,30,20,10,3,1]},
    hotlap: {label:'Hotlap / time attack',points:[100,85,70,50,30,10,1]},
    esport_qualifying: {label:'Esport · qualifications',points:[110,90,75,55,35,15,2]},
    esport_race: {label:'Esport · course',points:[120,100,85,65,45,15,3]},
    rally: {label:'Rallye',points:[100,85,70,50,30,10,2]}
  };
  const aliases={sprint:'daily',esport:'esport_race',qualification:'esport_qualifying',endurance:'championship',special:'championship'};
  const eventType=value=>types[value]?value:aliases[value]||null;
  function legacyDelta(row){
    const result=row.result||{};
    if (/DNF|ABANDON/.test(norm(result.status || result.statut))) return -25;
    const pos=Number(result.position);
    return !Number.isInteger(pos)||pos<1?0:pos===1?100:pos<=3?80:pos<=8?25:pos<=12?10:pos<=18?-10:-25;
  }
  function breakdown(row){
    const race=row.race||{},result=row.result||{};
    if(race.ratingEnabled===false||['none','manual'].includes(race.ratingMode)||race.competitionType==='event')return {points:0,reason:'Épreuve sans rating'};
    if(Number(result.scoringVersion??race.scoringVersion??1)<2)return {points:legacyDelta(row),version:1,reason:'Barème historique'};
    const type=eventType(result.eventType||race.eventType||race.competitionType),pos=Number(result.position),starters=Number(result.starters??race.starters);
    if(!type)return {points:0,version:2,reason:'Type d’épreuve à confirmer'};
    if(!Number.isInteger(starters)||starters<2||starters>5000||!Number.isInteger(pos)||pos<1||pos>starters)return {points:0,version:2,reason:'Position et nombre de participants à confirmer'};
    if(/DNF|ABANDON/.test(norm(result.status||result.statut)))return {points:0,version:2,type,reason:'Abandon · aucun point retiré'};
    const percentile=100*(pos-1)/(starters-1);
    const band=[1,5,10,25,50,75,100].findIndex(limit=>percentile<=limit+1e-10);
    const factor=Math.min(1,Math.sqrt((starters-1)/19));
    return {points:Math.max(1,Math.round(types[type].points[band]*factor)),version:2,type,position:pos,starters,percentile,band:[1,5,10,25,50,75,100][band],factor};
  }
  function delta(row){return breakdown(row).points}
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
        rows.push({preset: preset.id, race: {...preset.data}, result: {...result}, drivers});
      }
    }
    for(const row of rows){
      const approved=(accepted||[]).find(item=>(!item.status||item.status==='accepted')&&Number(item.scoring_version)>=2&&row.drivers.some(driver=>signature(row,driver)===signature({race:{event:item.event_name,date:item.race_date,circuit:item.track},result:{}},item.pilot_slug)));
      if(approved){row.race.scoringVersion=2;row.race.competitionType=approved.category;row.result.position=approved.finishing_position;row.result.starters=approved.starters;row.result.submissionId=approved.id;}
    }
    // A separately published official result takes precedence over its accepted proposal.
    const official = new Set(rows.flatMap(row => row.drivers.map(driver => signature(row, driver))));
    const linked = new Set(rows.flatMap(row => row.drivers.map(driver => [row.result.submissionId || row.race.submissionId || '', norm(driver)].join('|'))));
    const seen = new Set();
    for (const item of accepted || []) {
      if (item.status && item.status !== 'accepted') continue;
      const row = {preset: 'submission:' + item.id, submissionId: item.id,
        race: {event: item.event_name, date: item.race_date, circuit: item.track, competitionType:Number(item.scoring_version)>=2?item.category:item.category==='rally'?'rally':'race',scoringVersion:Number(item.scoring_version)||1,starters:item.starters,mode: item.category === 'endurance' ? 'endurance' : 'individuel'},
        result: {position: item.finishing_position, car: item.car}, drivers: [item.pilot_slug]};
      const key = signature(row, item.pilot_slug);
      if (official.has(key) || linked.has([item.id, norm(item.pilot_slug)].join('|')) || seen.has(key)) continue;
      seen.add(key); rows.push(row);
    }
    return rows;
  }
  window.VCERaceRating = {delta, breakdown, merge, norm, types, eventType};
})();

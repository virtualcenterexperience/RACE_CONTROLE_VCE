/* One sporting result feeds both profile panels and the shared leaderboard. */
(() => {
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  // V3: reward the level of engagement, field size and sporting result separately.
  const types = {
    hotlap: {label:'Challenge Hotlap',max:60},
    daily: {label:'Daily Race',max:80},
    open: {label:'Open · course libre',max:100},
    esport_qualifying: {label:'Qualifications Event',max:130},
    championship: {label:'Course championnat · manche',max:160},
    endurance: {label:'Endurance',max:200},
    championship_overall: {label:'Championnat · classement final de saison',max:240},
    esport_race: {label:'Course Esport · compétition officielle',max:320},
    rally: {label:'Rallye',max:160}
  };
  const v2Points={championship:[80,65,50,35,20,8,2],daily:[50,40,30,20,10,3,1],hotlap:[100,85,70,50,30,10,1],esport_qualifying:[110,90,75,55,35,15,2],esport_race:[120,100,85,65,45,15,3],rally:[100,85,70,50,30,10,2]};
  const aliases={sprint:'daily',esport:'esport_race',qualification:'esport_qualifying',special:'championship'};
  const eventType=value=>Object.hasOwn(types,value)?value:aliases[value]||null;
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
    const version=Number(result.scoringVersion??race.scoringVersion??1);
    let type=eventType(result.eventType||race.eventType||race.competitionType);
    if(version===2&&type==='endurance')type='championship';
    const pos=Number(result.position),starters=Number(result.starters??race.starters);
    if(!type)return {points:0,version,reason:'Type d’épreuve à confirmer'};
    if(!Number.isInteger(starters)||starters<2||starters>5000||!Number.isInteger(pos)||pos<1||pos>starters)return {points:0,version,reason:'Position et nombre de participants à confirmer'};
    if(/DNF|ABANDON/.test(norm(result.status||result.statut)))return {points:0,version,type,reason:'Abandon · aucun point retiré'};
    const percentile=100*(pos-1)/(starters-1);
    const band=[1,5,10,25,50,75,100].findIndex(limit=>percentile<=limit+1e-10);
    const factor=Math.min(1,Math.sqrt((starters-1)/19));
    const scale=version===2?v2Points[type]?.[band]:types[type].max*(pos===1?1:pos===2?.9:pos===3?.82:[.75,.65,.55,.4,.25,.08,.01][band]);
    if(!Number.isFinite(scale))return {points:0,version,reason:'Type d’épreuve à confirmer'};
    return {points:Math.max(1,Math.round(scale*factor)),version,type,position:pos,starters,percentile,band:[1,5,10,25,50,75,100][band],factor};
  }
  function delta(row){return breakdown(row).points}
  function signature(row, driver) {
    return [norm(driver), String(row.result.resultDate || row.race.date || '').slice(0, 10), norm(row.race.event), norm(row.race.circuit),String(row.result.raceNumber??row.race.raceNumber??'')].join('|');
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
      const approved=(accepted||[]).find(item=>(!item.status||item.status==='accepted')&&Number(item.scoring_version)>=2&&row.drivers.some(driver=>(String(row.result.submissionId||row.race.submissionId||'')===String(item.id)&&norm(driver)===norm(item.pilot_slug))||signature(row,driver)===signature({race:{event:item.event_name,date:item.race_date,circuit:item.track,raceNumber:item.race_number},result:{}},item.pilot_slug)));
      if(approved){row.race.scoringVersion=Number(approved.scoring_version);row.result.scoringVersion=Number(approved.scoring_version);row.result.eventType=approved.category;row.race.competitionType=approved.category;row.race.raceNumber=approved.race_number;row.result.position=approved.finishing_position;row.result.starters=approved.starters;row.result.submissionId=approved.id;}
    }
    // A separately published official result takes precedence over its accepted proposal.
    const official = new Set(rows.flatMap(row => row.drivers.map(driver => signature(row, driver))));
    const linked = new Set(rows.flatMap(row => row.drivers.map(driver => [row.result.submissionId || row.race.submissionId || '', norm(driver)].join('|'))));
    const seen = new Set();
    for (const item of accepted || []) {
      if (item.status && item.status !== 'accepted') continue;
      const row = {preset: 'submission:' + item.id, submissionId: item.id,
        race: {event: item.event_name, date: item.race_date, circuit: item.track, competitionType:Number(item.scoring_version)>=2?item.category:item.category==='rally'?'rally':'race',scoringVersion:Number(item.scoring_version)||1,starters:item.starters,raceNumber:item.race_number,mode: item.category === 'endurance' ? 'endurance' : 'individuel'},
        result: {position: item.finishing_position, car: item.car}, drivers: [item.pilot_slug]};
      const key = signature(row, item.pilot_slug);
      if (official.has(key) || linked.has([item.id, norm(item.pilot_slug)].join('|')) || seen.has(key)) continue;
      seen.add(key); rows.push(row);
    }
    return rows;
  }
  window.VCERaceRating = {delta, breakdown, merge, norm, types, eventType};
})();

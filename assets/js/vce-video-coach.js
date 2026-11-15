/* Evidence-based driving review for a sampled HUD or synchronized lap archive. */
(() => {
  'use strict';

  const known = Number.isFinite;
  const titles = {
    coast: 'Temps sans frein ni accélérateur',
    overlap: 'Frein et accélérateur simultanés',
    lift: 'Remise des gaz interrompue',
    speedTrough: 'Ralentissement suivi d’une reprise de vitesse'
  };
  const tips = {
    coast: 'Revois l’entrée du virage. Vérifie si la transition est volontaire, puis teste un relâché du frein plus progressif ou une reprise des gaz plus tôt si la voiture est placée.',
    overlap: 'Vérifie le mouvement des deux pieds. Si le chevauchement est involontaire, essaie de finir de relâcher le frein avant la remise des gaz.',
    lift: 'Revois la sortie. Si la correction suit une remise des gaz trop tôt, attends que le volant s’ouvre davantage avant de réaccélérer.',
    speedTrough: 'Revois ce passage. Si la sortie se referme, teste un point de corde plus tardif au tour suivant et compare la vitesse de sortie. Le HUD seul ne situe pas la voiture sur la piste.'
  };

  function hudSamples(rows) {
    const number = value => value == null || value === '' ? null : Number(value);
    return rows.map(({time, values}) => ({
      t:time, speed:number(values.speed), brake:values.brake == null ? null : number(values.brake)/100,
      throttle:values.throttle == null ? null : number(values.throttle)/100
    }));
  }

  function hudClock(values) {
    const match=String(values.chrono??'').match(/^(\d+):(\d{2}\.\d{3})$/);
    return match?Number(match[1])*60+Number(match[2]):null;
  }

  function splitHudLaps(rows) {
    if (!rows.length) return [];
    const segments=[];
    let start=0, label=null, lastClock=null;
    for(const [index,row] of rows.entries()){
      const clock=hudClock(row.values);
      const observed=row.values.lap;
      const confirmed=observed!=null&&String(rows[index+1]?.values.lap)===String(observed);
      const newLap=confirmed&&label!=null&&Number(observed)===Number(label)+1;
      const reset=clock!==null&&lastClock!==null&&lastClock>15&&clock<3;
      if(index-start>=3&&(newLap||reset)){
        segments.push({number:label,rows:rows.slice(start,index)});
        start=index;
        label=null;
      }
      if(confirmed)label=observed;
      if(clock!==null)lastClock=clock;
    }
    segments.push({number:label,rows:rows.slice(start)});
    return segments;
  }

  function startFromHud(rows, lap) {
    const segments=splitHudLaps(rows);
    const matchingLap=segments.filter(segment=>segment.number!=null&&Number(segment.number)===Number(lap.number));
    if(segments.length>1 && matchingLap.length!==1) return null;
    if(matchingLap.length===1) rows=matchingLap[0].rows;
    const readings = rows.flatMap(({time, values}) => {
      const lapTime=hudClock(values);
      if(lapTime===null)return [];
      if (lapTime <= 0 || lapTime > (lap.duration ?? 0)+.5) return [];
      return [{time, lapTime, offset:time-lapTime}];
    });
    if (readings.length < 3) return null;
    const offsets = readings.map(row=>row.offset).sort((a,b)=>a-b);
    const median = offsets[Math.floor(offsets.length/2)];
    const matching = readings.filter(row=>Math.abs(row.offset-median)<=.25);
    if (matching.length < 3 || matching.length < readings.length*.75 ||
        matching.at(-1).lapTime-matching[0].lapTime < 2) return null;
    return median;
  }

  function speedReview(points) {
    const events=[];
    for(let i=2;i+2<points.length;i++){
      const [entry,before,apex,after,exit]=points.slice(i-2,i+3);
      if(![entry,before,apex,after,exit].every(point=>known(point.speed)) ||
         exit.t-entry.t<3.9 || exit.t-entry.t>4.1 || apex.speed<45 ||
         entry.speed-before.speed<12 || before.speed-apex.speed<8 ||
         after.speed-apex.speed<5 || exit.speed-apex.speed<15) continue;
      if(events.length&&entry.t-events.at(-1).end<3)continue;
      events.push({kind:'speedTrough',start:entry.t,end:exit.t,speed:apex.speed});
    }
    return events.slice(0,12);
  }

  function diagnose(samples,{archive=false}={}) {
    const points=samples.filter(p=>known(p.t)).sort((a,b)=>a.t-b.t);
    const usable=points.filter(p=>known(p.brake)&&known(p.throttle)&&known(p.speed));
    // A fully flat zero channel is common when a HUD region was selected wrongly.
    if (usable.length < 4 || !usable.some(p=>p.brake>.2) || !usable.some(p=>p.throttle>.3)) {
      const events=archive?[]:speedReview(points);
      return {usable:usable.length,events,sufficient:events.length>0};
    }
    const intervals=points.map((p,i)=>i ? p.t-points[i-1].t : 0).filter(t=>t>0).sort((a,b)=>a-b);
    const gap=archive ? Math.min(.65,Math.max(.13,(intervals[Math.floor(intervals.length/2)]||.03)*4)) : 1.1;
    const minimum=archive ? {coast:.65,overlap:.4} : {coast:2,overlap:2};
    const events=[];
    let active=null,last=null,lastBrake=-Infinity,lastPower=-Infinity;
    function flush() {
      if (active && active.end-active.start>=minimum[active.kind]) events.push(active);
      active=null;
    }
    for (const [index,p] of points.entries()) {
      if (last===null || p.t-last>gap) {flush();lastBrake=-Infinity;lastPower=-Infinity}
      last=p.t;
      if (!known(p.brake)||!known(p.throttle)||!known(p.speed)||p.speed<45) {
        flush();lastBrake=-Infinity;lastPower=-Infinity;continue;
      }
      if (p.brake>=.2) lastBrake=p.t;
      if (p.throttle>=.4) lastPower=p.t;
      const kind=p.brake>=.18&&p.throttle>=.20?'overlap':
        p.brake<=.04&&p.throttle<=.05&&p.t-lastBrake<4?'coast':null;
      if (active?.kind!==kind) flush();
      if (kind && !active) active={kind,start:p.t,end:p.t,speed:p.speed,progress:p.progress};
      else if (active) active.end=p.t;
      if (archive && !kind && p.brake<.1 && p.throttle>=.10 && p.throttle<.25 &&
          p.t-lastPower>.15 && p.t-lastPower<.65 && p.t-lastBrake<3) {
        const later=points.slice(index+1,index+13).find(next=>next.t-p.t>=.08);
        if(later && later.t-p.t<=gap && later.throttle>=.10 && later.throttle<.25 && later.brake!==null && later.brake<.1 &&
           !events.some(e=>e.kind==='lift'&&p.t-e.start<3))
          events.push({kind:'lift',start:p.t,end:later.t,speed:p.speed,progress:p.progress});
      }
    }
    flush();
    return {usable:usable.length,sufficient:true,events:events.sort((a,b)=>a.start-b.start).slice(0,12)};
  }
  window.VCEVideoCoach={hudSamples,startFromHud,diagnose,splitHudLaps,titles,tips};
})();

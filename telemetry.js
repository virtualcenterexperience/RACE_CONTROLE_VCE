(()=>{'use strict';const $=id=>document.getElementById(id);let data=null,lap=null,ref=null,channel='throttle';const fmt=n=>Number.isFinite(n)?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';const delta=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(3)+'s':'—';const name=decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||'');$('pilot').value=name||'Profil non sélectionné';$('back').href='pilote.html'+(name?'#'+encodeURIComponent(name):'');const fields={throttle:'ACCÉLÉRATION',brake:'FREIN',steering:'VOLANT',slip:'GLISSE',gear:'RAPPORT',speed:'VITESSE'};for(const [k,v] of Object.entries(fields)){const b=document.createElement('button');b.textContent=v;b.onclick=()=>{channel=k;renderChart()};$('channels').append(b)}function hasTime(l){return typeof l?.time==='number'&&Number.isFinite(l.time)&&l.time>0}function safeLap(l){return l&&l.valid!==false&&(hasTime(l)||(Array.isArray(l.samples)&&l.samples.length>=10))}function sameCombo(a,b){return (a.track||'')===(b.track||'')&&(a.layout||'')===(b.layout||'')};function load(source='import'){const prev=window.vceSession?.id;window.vceTelemetryData=data;const sessions=Array.isArray(data.sessions)?data.sessions:[data];$('session').replaceChildren(...sessions.map((s,i)=>new Option((s.game||'Jeu')+' · '+(s.track||'Circuit')+' · '+(s.car||'Voiture')+' · '+(s.date||''),String(i))));const index=sessions.findIndex(s=>s.id===prev);$('session').value=String(index>=0?index:0);$('session').onchange=selectSession;selectSession()}function selectSession(){const sessions=Array.isArray(data.sessions)?data.sessions:[data];const s=sessions[+$('session').value];if(!s)return;window.vceSession=s;const laps=(s.laps||[]).filter(safeLap);$('lap').replaceChildren(...laps.map((l,i)=>new Option('Tour '+(l.number??i+1)+' · '+(hasTime(l)?fmt(l.time):'chrono indisponible'),String(i))));$('reference').replaceChildren(...laps.map((l,i)=>new Option('Tour '+(l.number??i+1)+' · '+(hasTime(l)?fmt(l.time):'chrono indisponible'),String(i))));const best=laps.filter(hasTime).reduce((a,b)=>!a||b.time<a.time?b:a,null)||laps[0]||null;const ext=window.VCEexternalReferenceLap;const useExternal=ext&&ext.baseId===s.id;if(useExternal)$('reference').add(new Option('AUTRE PILOTE · '+ext.pilot+' · '+(hasTime(ext.lap)?fmt(ext.lap.time):'télémétrie'),'external'));$('reference').value=useExternal?'external':String(laps.indexOf(best));$('lap').onchange=render;$('reference').onchange=render;$('combo').textContent=[s.game,s.car,s.track].filter(Boolean).join(' / ')||'Non renseigné';$('status').textContent=source==='cloud'?'● DONNÉES SUPABASE · '+(s.status==='in_progress'?'SESSION EN COURS':'SESSION TERMINÉE'):'● SESSION IMPORTÉE · HORS LIGNE';render()}function timeAtProgress(lap,progress){
 const pts=(lap?.samples||[]).filter(p=>p.distance!==null&&p.distance!==undefined&&p.t!==null&&p.t!==undefined&&Number.isFinite(+p.distance)&&Number.isFinite(+p.t))
 .sort((a,b)=>a.distance-b.distance);
 if(pts.length<4||progress<pts[0].distance||progress>pts.at(-1).distance)return null;
 let low=0,high=pts.length-1;
 while(low<high){let mid=(low+high)>>1;if(+pts[mid].distance<progress)low=mid+1;else high=mid}
 const b=pts[low],a=pts[Math.max(0,low-1)];
 if(+a.distance===+b.distance)return +b.t;
 return +a.t+(+b.t-(+a.t))*(progress-(+a.distance))/(+b.distance-(+a.distance));
}
function render(){const s=window.vceSession;if(!s)return;const laps=(s.laps||[]).filter(safeLap);lap=laps[+$('lap').value];ref=$('reference').value==='external'?window.VCEexternalReferenceLap?.lap:laps[+$('reference').value];if(!lap||!ref){$('position').textContent=s.live?.position??'—';$('currentLap').textContent=s.live?.lap??'—';$('liveTime').textContent='—';return;}$('lapTime').textContent=hasTime(lap)?fmt(lap.time):'—';$('refTime').textContent=hasTime(ref)?fmt(ref.time):'—';const d=hasTime(lap)&&hasTime(ref)?lap.time-ref.time:NaN;$('delta').textContent=delta(d);$('delta').className=Number.isFinite(d)?d<=0?'gain':'loss':'';$('position').textContent=s.live?.position??'—';$('currentLap').textContent=s.live?.lap??'—';$('liveTime').textContent=Number.isFinite(+s.live?.elapsed)?fmt(+s.live.elapsed):'—';const bests=[];for(const l of laps)for(const [i,t] of (l.sectors||[]).entries())if(Number.isFinite(+t)&&+t>0)bests[i]=Math.min(bests[i]??Infinity,+t);$('ideal').textContent=bests.length&&bests.every(Number.isFinite)?fmt(bests.reduce((a,b)=>a+b,0)):'—';const n=Math.max(lap.sectors?.length||0,ref.sectors?.length||0);$('sectorCount').textContent=n+' secteurs';$('sectors').replaceChildren();for(let i=0;i<n;i++){const a=+lap.sectors?.[i],b=+ref.sectors?.[i],d=a-b;const e=document.createElement('div');e.className='sector';for(const [txt,cls] of [['S'+(i+1),''],[a>0?fmt(a):'—',''],[b>0?fmt(b):'—',''],[a>0&&b>0?delta(d):'—',d<=0?'gain':'loss']]){const x=document.createElement('span');x.textContent=txt;x.className=cls;e.append(x)}$('sectors').append(e)}
 if(n===0){
   const segments=[];
   for(let i=0;i<10;i++){
     const start=i/10,end=(i+1)/10;
     const a0=timeAtProgress(lap,start),a1=timeAtProgress(lap,end),
       b0=timeAtProgress(ref,start),b1=timeAtProgress(ref,end);
     if([a0,a1,b0,b1].some(x=>!Number.isFinite(x)))continue;
     const diff=(a1-a0)-(b1-b0);
     if(!Number.isFinite(diff))continue;
     segments.push({label:(i*10)+'–'+((i+1)*10)+' %',a:a1-a0,b:b1-b0,d:diff});
   }
   $('sectorCount').textContent=segments.length+' zones de piste estimées';
   for(const seg of segments){
     const e=document.createElement('div');e.className='sector';
     for(const [value,cls] of [
      ['Zone '+seg.label,''],[fmt(seg.a),''],[fmt(seg.b),''],
      [delta(seg.d),seg.d<=0?'gain':'loss']]){
       const cell=document.createElement('span');cell.textContent=value;cell.className=cls;e.append(cell);
     }
     $('sectors').append(e)
   }
   if(segments.length===0){const p=document.createElement('p');p.className='muted';
     p.textContent='Pas de secteurs enregistrés. Une analyse des zones sera disponible lorsque les deux tours auront des positions et des temps cohérents.';$('sectors').append(p)}
 }
 drawMap(lap,ref);renderChart()}function drawMap(a,b){
 const svg=$('map');svg.replaceChildren();
 const ns='http://www.w3.org/2000/svg';
 const pts=l=>Array.isArray(l.samples)?l.samples.filter(p=>p.x!==null&&p.x!==undefined&&p.y!==null&&p.y!==undefined&&Number.isFinite(+p.x)&&Number.isFinite(+p.y)):[];
 const aa=pts(a),bb=pts(b),all=[...aa,...bb];
 if(all.length<2){const t=document.createElementNS(ns,'text');t.setAttribute('x',450);t.setAttribute('y',255);t.setAttribute('text-anchor','middle');t.setAttribute('fill','#91a7c0');t.textContent='Coordonnées XY du tracé non disponibles';svg.append(t);return}
 const minx=Math.min(...all.map(p=>+p.x)),maxx=Math.max(...all.map(p=>+p.x)),miny=Math.min(...all.map(p=>+p.y)),maxy=Math.max(...all.map(p=>+p.y));
 const xy=p=>[45+(+p.x-minx)/Math.max(1,maxx-minx)*810,45+(+p.y-miny)/Math.max(1,maxy-miny)*440];
 const poly=(arr,color,width=5)=>{if(arr.length<2)return;const el=document.createElementNS(ns,'polyline');el.setAttribute('points',arr.map(p=>xy(p).join(',')).join(' '));el.setAttribute('fill','none');el.setAttribute('stroke',color);el.setAttribute('stroke-width',width);el.setAttribute('stroke-linejoin','round');el.setAttribute('stroke-linecap','round');svg.append(el)};
 poly(bb,'#4d9dff',5);poly(aa,'#ff911d',6);
 // Colour each 10%-of-lap segment using its LOCAL time difference, not total cumulative delta.
 // Only display a gain/loss when both laps contain comparable position/time samples.
 const epsilon=0.005,comparable=a!==b&&aa.length>=10&&bb.length>=10;
 let gain=0,loss=0,neutral=0;
 if(comparable){
  for(let i=0;i<10;i++){
   const lo=i/10,hi=(i+1)/10;
   const a0=timeAtProgress(a,lo),a1=timeAtProgress(a,hi),b0=timeAtProgress(b,lo),b1=timeAtProgress(b,hi);
   if(![a0,a1,b0,b1].every(Number.isFinite))continue;
   const diff=(a1-a0)-(b1-b0);
   const color=diff < -epsilon?'#22c55e':diff > epsilon?'#ef4444':'#ff911d';
   const segment=aa.filter(p=>Number.isFinite(+p.distance)&&+p.distance>=lo&&+p.distance<=hi);
   if(segment.length<2)continue;
   poly(segment,color,8);
   if(diff < -epsilon)gain++;else if(diff > epsilon)loss++;else neutral++;
  }
 }
 const caption=$('mapCaption');
 caption.textContent=comparable?(gain+' zones en gain · '+loss+' zones en perte · '+neutral+' zones neutres (10 % du tour)'):'Orange : tour pilote · Bleu : référence · Sélectionne deux tours distincts pour voir les gains et pertes';
}
function renderChart(){[...$('channels').children].forEach((b,i)=>b.classList.toggle('active',Object.keys(fields)[i]===channel));$('plots').replaceChildren();const c=document.createElement('canvas');c.width=1300;c.height=280;$('plots').append(c);const ctx=c.getContext('2d');ctx.strokeStyle='#33465a';for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(45,20+i*55);ctx.lineTo(1270,20+i*55);ctx.stroke()}let values=[...(lap?.samples||[]),...(ref?.samples||[])].map(p=>p[channel]).filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)).map(Number);const low=channel==='steering'?Math.min(-1,...values):Math.min(0,...values),high=Math.max(1,...values);for(const [l,color] of [[ref,'#3687dc'],[lap,'#f28b28']]){const pts=(l?.samples||[]).filter(p=>p[channel]!==null&&p[channel]!==undefined&&p[channel]!==''&&Number.isFinite(+p[channel]));if(pts.length<2)continue;ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>{const x=45+i/(pts.length-1)*1225,y=240-(+p[channel]-low)/Math.max(.001,high-low)*215;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}ctx.fillStyle='#a3b8d0';ctx.font='13px Segoe UI';ctx.fillText(fields[channel]+' · données disponibles : '+(lap?.samples?.length||0)+' échantillons',45,270)}window.VCEsetOtherPilotReference=(pilot,lapObj,baseId)=>{window.VCEexternalReferenceLap={pilot,lap:lapObj,baseId};selectSession();$('reference').value='external';render();document.dispatchEvent(new Event('vce-cloud-update'))};window.VCEloadTelemetry=(payload,opts={})=>{if(!payload||(!Array.isArray(payload.laps)&&!Array.isArray(payload.sessions)))return;data=payload;load(opts.source||'cloud')};$('file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{data=JSON.parse(await f.text());if(!data||(!Array.isArray(data.laps)&&!Array.isArray(data.sessions)))throw Error('Format attendu : laps[] ou sessions[]');load('import');document.dispatchEvent(new Event('vce-cloud-update'))}catch(err){alert('Import impossible : '+err.message)}};renderChart()})();
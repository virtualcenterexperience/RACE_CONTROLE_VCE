(()=>{'use strict';const $=id=>document.getElementById(id);let data=null,lap=null,ref=null,channel='throttle',viewStart=0,viewEnd=1;const fmt=n=>Number.isFinite(n)?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';const delta=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(3)+'s':'—';const name=decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||'');$('pilot').value=name||'Profil non sélectionné';$('back').href='pilote.html'+(name?'#'+encodeURIComponent(name):'');const fields={throttle:'ACCÉLÉRATION',brake:'FREIN',steering:'VOLANT',slip:'GLISSE',gear:'RAPPORT',speed:'VITESSE'};for(const [k,v] of Object.entries(fields)){const b=document.createElement('button');b.textContent=v;b.onclick=()=>{channel=k;renderChart()};$('channels').append(b)}function hasTime(l){return typeof l?.time==='number'&&Number.isFinite(l.time)&&l.time>0}function safeLap(l){return l&&(hasTime(l)||(Array.isArray(l.samples)&&l.samples.length>=2)||Number.isInteger(l.number))}function sameCombo(a,b){return (a.track||'')===(b.track||'')&&(a.layout||'')===(b.layout||'')};function load(source='import'){const prev=window.vceSession?.id;window.vceTelemetryData=data;const sessions=Array.isArray(data.sessions)?data.sessions:[data];$('session').replaceChildren(...sessions.map((s,i)=>new Option((s.game||'Jeu')+' · '+(s.track||'Circuit')+' · '+(s.car||'Voiture')+' · '+(s.date||''),String(i))));const index=sessions.findIndex(s=>s.id===prev);$('session').value=String(index>=0?index:0);$('session').onchange=selectSession;selectSession()}function selectSession(source='cloud'){const sessions=Array.isArray(data.sessions)?data.sessions:[data];const s=sessions[+$('session').value];if(!s)return;const previousSession=window.vceSession;const previousLaps=(previousSession?.laps||[]).filter(safeLap).sort((a,b)=>(a.number??0)-(b.number??0));const previousIndex=Number($('lap').value);const previousLap=previousSession?.id===s.id?previousLaps[previousIndex]:null;const previousReference=previousSession?.id===s.id&&$('reference').value!=='external'?previousLaps[Number($('reference').value)]:null;window.vceSession=s;const laps=(s.laps||[]).filter(safeLap).sort((a,b)=>(a.number??0)-(b.number??0));$('lap').replaceChildren(...laps.map((l,i)=>new Option('Tour '+(l.number??i+1)+' · '+(l.valid===false?'INVALIDE · ':'VALIDE · ')+(hasTime(l)?fmt(l.time):'chrono indisponible'),String(i))));$('reference').replaceChildren(...laps.map((l,i)=>new Option('Tour '+(l.number??i+1)+' · '+(hasTime(l)?fmt(l.time):'chrono indisponible'),String(i))));const best=laps.filter(l=>l.valid!==false&&hasTime(l)).reduce((a,b)=>!a||b.time<a.time?b:a,null)||laps[0]||null;const ext=window.VCEexternalReferenceLap;const useExternal=ext&&ext.baseId===s.id;if(useExternal)$('reference').add(new Option('AUTRE PILOTE · '+ext.pilot+' · '+(hasTime(ext.lap)?fmt(ext.lap.time):'télémétrie'),'external'));const preservedLap=previousLap?laps.findIndex(x=>x.number===previousLap.number):-1;if(preservedLap>=0)$('lap').value=String(preservedLap);const preservedRef=previousReference?laps.findIndex(x=>x.number===previousReference.number):-1;$('reference').value=useExternal?'external':String(preservedRef>=0?preservedRef:laps.indexOf(best));$('lap').onchange=render;$('reference').onchange=render;$('combo').textContent=[s.game,s.car,s.track].filter(Boolean).join(' / ')||'Non renseigné';$('status').textContent=source==='cloud'?'● DONNÉES SUPABASE · '+(s.status==='in_progress'?'SESSION EN COURS':'SESSION TERMINÉE'):'● SESSION IMPORTÉE · HORS LIGNE';render()}function timeAtProgress(lap,progress){
 const pts=(lap?.samples||[]).filter(p=>p.distance!==null&&p.distance!==undefined&&p.t!==null&&p.t!==undefined&&Number.isFinite(+p.distance)&&Number.isFinite(+p.t))
 .sort((a,b)=>a.distance-b.distance);
 if(pts.length<4||progress<pts[0].distance||progress>pts.at(-1).distance)return null;
 let low=0,high=pts.length-1;
 while(low<high){let mid=(low+high)>>1;if(+pts[mid].distance<progress)low=mid+1;else high=mid}
 const b=pts[low],a=pts[Math.max(0,low-1)];
 if(+a.distance===+b.distance)return +b.t;
 return +a.t+(+b.t-(+a.t))*(progress-(+a.distance))/(+b.distance-(+a.distance));
}
function render(){const s=window.vceSession;if(!s)return;const laps=(s.laps||[]).filter(safeLap).sort((a,b)=>(a.number??0)-(b.number??0));lap=laps[+$('lap').value];ref=$('reference').value==='external'?window.VCEexternalReferenceLap?.lap:laps[+$('reference').value];if(!lap||!ref){$('position').textContent=s.live?.position??'—';$('currentLap').textContent=s.live?.lap??'—';$('liveTime').textContent='—';return;}$('lapTime').textContent=hasTime(lap)?fmt(lap.time):'—';$('refTime').textContent=hasTime(ref)?fmt(ref.time):'—';const d=hasTime(lap)&&hasTime(ref)?lap.time-ref.time:NaN;$('delta').textContent=delta(d);$('delta').className=Number.isFinite(d)?d<=0?'gain':'loss':'';$('position').textContent=s.live?.position??'—';$('currentLap').textContent=s.live?.lap??'—';$('liveTime').textContent=Number.isFinite(+s.live?.elapsed)?fmt(+s.live.elapsed):'—';const bests=[];for(const l of laps)for(const [i,t] of (l.sectors||[]).entries())if(Number.isFinite(+t)&&+t>0)bests[i]=Math.min(bests[i]??Infinity,+t);$('ideal').textContent=bests.length&&bests.every(Number.isFinite)?fmt(bests.reduce((a,b)=>a+b,0)):'—';const n=Math.max(lap.sectors?.length||0,ref.sectors?.length||0);$('sectorCount').textContent=n+' secteurs';$('sectors').replaceChildren();for(let i=0;i<n;i++){const a=+lap.sectors?.[i],b=+ref.sectors?.[i],d=a-b;const e=document.createElement('div');e.className='sector';for(const [txt,cls] of [['S'+(i+1),''],[a>0?fmt(a):'—',''],[b>0?fmt(b):'—',''],[a>0&&b>0?delta(d):'—',d<=0?'gain':'loss']]){const x=document.createElement('span');x.textContent=txt;x.className=cls;e.append(x)}$('sectors').append(e)}
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
 const svg=$('map'),caption=$('mapCaption');
 if(!window.VCETrack35){
  caption.textContent='Module carte indisponible — actualise la page.';
  return
 }
 const result=window.VCETrack35.svg(svg,a?.samples||[],b?.samples||[]);
 const chosen=result.primary,reference=result.ref;
 if(!chosen.ok&&!reference.ok){
  caption.textContent='Carte non générée : '+chosen.reason+'. Impossible de reconstruire le tracé sans X/Z réels.';
 }else if(!chosen.ok){
  caption.textContent='Tour sélectionné : '+chosen.reason+'. Bleu : trajectoire de référence uniquement.';
 }else {
  caption.textContent='Orange : tour '+(a?.number??'sélectionné')+' ('+chosen.n+' positions) · Bleu : référence'+(reference.ok?' ('+reference.n+' positions)':' absente')+' · échelle X/Z identique.';
 }
}
function renderChart(){
 [...$('channels').children].forEach((button,i)=>button.classList.toggle('active',Object.keys(fields)[i]===channel));
 $('plots').replaceChildren();
 const canvas=document.createElement('canvas');canvas.width=1300;canvas.height=250;$('plots').append(canvas);
 if(!window.VCEGraph35)return;
 const primary=lap?.samples||[],reference=ref?.samples||[];
 const windowed=p=>p.filter(x=>{
  const xval=x.distance??x.lap_pos;
  return typeof xval!=='number'||xval>=viewStart&&xval<=viewEnd;
 });
 const primaryFiltered=windowed(primary),referenceFiltered=windowed(reference);
 const key=channel;
 const hasChannel=window.VCEGraph35.channels[key];
 if(!hasChannel){
  const c=canvas.getContext('2d');c.fillStyle='#99b4cc';c.font='14px Segoe UI';c.fillText('Canal '+channel+' non disponible',40,90);return
 }
 window.VCEGraph35.draw(canvas,{key,primary:primaryFiltered,reference:referenceFiltered,axis:'distance'});
}
const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0';controls.innerHTML='<label>Début <input id="vce-chart-start" type="range" min="0" max="95" value="0"></label><label>Fin <input id="vce-chart-end" type="range" min="5" max="100" value="100"></label><button type="button" id="vce-chart-reset">Vue complète</button><span id="vce-chart-window">0–100 %</span>';$('plots').before(controls);const syncWindow=()=>{const a=+$('vce-chart-start').value,b=+$('vce-chart-end').value;viewStart=Math.min(a,b-5)/100;viewEnd=Math.max(b,a+5)/100;$('vce-chart-window').textContent=Math.round(viewStart*100)+'–'+Math.round(viewEnd*100)+' %';renderChart()};$('vce-chart-start').oninput=syncWindow;$('vce-chart-end').oninput=syncWindow;$('vce-chart-reset').onclick=()=>{$('vce-chart-start').value=0;$('vce-chart-end').value=100;syncWindow()};
window.VCEsetOtherPilotReference=(pilot,lapObj,baseId)=>{window.VCEexternalReferenceLap={pilot,lap:lapObj,baseId};selectSession();$('reference').value='external';render();document.dispatchEvent(new Event('vce-cloud-update'))};window.VCEloadTelemetry=(payload,opts={})=>{if(!payload||(!Array.isArray(payload.laps)&&!Array.isArray(payload.sessions)))return;data=payload;load(opts.source||'cloud')};$('file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{data=JSON.parse(await f.text());if(!data||(!Array.isArray(data.laps)&&!Array.isArray(data.sessions)))throw Error('Format attendu : laps[] ou sessions[]');load('import');document.dispatchEvent(new Event('vce-cloud-update'))}catch(err){alert('Import impossible : '+err.message)}};renderChart()})();
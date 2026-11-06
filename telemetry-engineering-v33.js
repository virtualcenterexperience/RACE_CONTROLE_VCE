/* VCE Race Engineering 3.3 — telemetry from real recorded/live samples only. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const defs=[
 ['speed','VITESSE','km/h','#8075ff',['speed','speed_kmh']],
 ['throttle','ACCÉLÉRATEUR','%','#18cf79',['throttle']],
 ['brake','FREIN','%','#ef4567',['brake']],
 ['steering','VOLANT','','#dfba62',['steering','steer']],
 ['rpm','RÉGIME','tr/min','#f8645b',['rpm']],
 ['gear','GEARS · RAPPORT','','#54aaff',['gear']],
 ['delta','DELTA CHRONO','s','#fa607c',['delta']],
 ['fuel','CARBURANT','L','#e3d164',['fuel_l','fuel']],
 ['suspension_fl','SUSPENSION AVG','mm','#29beae',['suspension_fl']],
 ['suspension_fr','SUSPENSION AVD','mm','#59b6f3',['suspension_fr']],
 ['suspension_rl','SUSPENSION ARG','mm','#e46baf',['suspension_rl']],
 ['suspension_rr','SUSPENSION ARD','mm','#ac89f7',['suspension_rr']],
 ['ride_height_front','GARDE AU SOL AV','mm','#4cdbd3',['ride_height_front']],
 ['ride_height_rear','GARDE AU SOL AR','mm','#f28c78',['ride_height_rear']],
 ['tyre_temp_fl','TEMP. PNEU AVG','°C','#29b982',['tyre_temp_fl']],
 ['tyre_temp_fr','TEMP. PNEU AVD','°C','#f96d7a',['tyre_temp_fr']],
 ['tyre_temp_rl','TEMP. PNEU ARG','°C','#38adfa',['tyre_temp_rl']],
 ['tyre_temp_rr','TEMP. PNEU ARD','°C','#e5b34c',['tyre_temp_rr']],
 ['g_long','G LONGITUDINAL','G','#ffa75b',['g_long']],
 ['g_lat','G LATÉRAL','G','#c5a2f5',['g_lat']],
 ['drag','TRAÎNÉE','N','#b0e968',['drag']],
 ['front_downforce','APPUI AVANT','N','#5ec2dd',['front_downforce']],
 ['rear_downforce','APPUI ARRIÈRE','N','#e68eaa',['rear_downforce']]
];
const val=(s,keys)=>{for(const k of keys)if(finite(s?.[k]))return s[k];return null};
const state={lap:null,live:false,liveData:[],selected:new Set(['throttle','brake','speed','gear','delta']),cursor:1};
const canvas=(id,w,h)=>{let c=document.createElement('canvas');c.id=id;c.width=w;c.height=h;return c};
const shell=()=>{
 const holder=document.createElement('section');holder.id='vce-engineering-v33';holder.className='panel';
 holder.innerHTML='<div class="vce-eng-title"><div><small>VCE ESPORT / RACE ENGINEERING</small><h2>DATA ANALYSIS · STYLE TÉLÉMÉTRIE PROFESSIONNELLE</h2></div><span id="vce-eng-status">EN ATTENTE DES MESURES</span></div>'+
 '<div class="vce-eng-layout"><aside class="vce-eng-side"><strong>TOURS / SÉANCES</strong><div id="vce-eng-laps"></div><strong>CANAUX</strong><div id="vce-eng-checks"></div></aside>'+
 '<div class="vce-eng-work"><div class="vce-eng-toolbar"><label>Mode <select id="vce-eng-mode"><option value="archive">Enregistré</option><option value="live">Direct LIVE</option></select></label>'+
 '<label>Abscisse <select id="vce-eng-x"><option value="distance">Position circuit</option><option value="time">Temps</option></select></label><span id="vce-eng-count">0 mesures</span></div>'+
 '<div class="vce-eng-upper"><div class="vce-eng-track"><strong>CARTE DES TRAJECTOIRES</strong><div id="vce-eng-mapwrap"></div><small id="vce-eng-maptext"></small></div><div class="vce-eng-values"><strong>MESURES DU CURSEUR</strong><div id="vce-eng-values"></div></div></div>'+
 '<strong class="vce-eng-plot-title">GRAPHIQUES SYNCHRONISÉS</strong><div id="vce-eng-curves"></div></div></div>'+
 '<p class="muted">Les canaux non transmis restent indisponibles. Les coordonnées X/Z doivent varier sur les deux axes pour former un circuit.</p>';
 holder.querySelector('#vce-eng-mapwrap').append(canvas('vce-eng-map',720,260));
 const target=$('vce-replay')||$('tt-circuit')||$('vce-stream');
 if(target)target.before(holder);else document.querySelector('main')?.append(holder);

};
function referenceLap(s,laps){
 if($('reference')?.value==='external'&&window.VCEexternalReferenceLap?.baseId===s?.id)
   return window.VCEexternalReferenceLap.lap;
 return laps[Number($('reference')?.value)]||null;
}
function withDelta(primary,reference){
 const points=(reference?.samples||[]).filter(p=>finite(p.distance)&&finite(p.t))
   .map(p=>[p.distance,p.t]).sort((a,b)=>a[0]-b[0]);
 if(points.length<4)return primary;
 const at=d=>{
   if(!finite(d)||d<points[0][0]||d>points.at(-1)[0])return null;
   let lo=0,hi=points.length-1;
   while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][0]<d)lo=mid;else hi=mid}
   const a=points[lo],b=points[hi],span=b[0]-a[0];
   return span>.0000001?a[1]+(b[1]-a[1])*(d-a[0])/span:b[1];
 };
 return primary.map(p=>({...p,delta:finite(p.t)?(at(p.distance)===null?null:p.t-at(p.distance)):null}));
}
function source(){
 const s=window.vceSession;
 const laps=(s?.laps||[]).filter(l=>l&&(Number.isFinite(l.time)&&l.time>0||l.samples?.length>=2||Number.isInteger(l.number)))
   .slice().sort((a,b)=>(a.number??0)-(b.number??0));
 const index=Number($('lap')?.value||0);
 state.lap=laps[index]||null;
 const raw=state.live?state.liveData:(state.lap?.samples||[]);
 const ref=referenceLap(s,laps);
 return {s,laps,selected:state.lap,reference:ref,data:state.live?raw:withDelta(raw,ref)}
}
function paintMap(data,reference){
 const canvas=$('vce-eng-map'),caption=$('vce-eng-maptext');
 if(!canvas||!window.VCETrack35)return;
 const result=window.VCETrack35.canvas(canvas,data,reference||[],{progress:state.cursor});
 if(!result.primary.ok&&result.ref.ok){
  caption.textContent='Tour sélectionné : '+result.primary.reason+' · affichage de la référence uniquement.';
 }else if(!result.primary.ok){
  caption.textContent='Carte indisponible : '+result.primary.reason+' · aucun circuit inventé.';
 }else{
  caption.textContent=result.primary.n+' coordonnées X/Z fiables · orange : tour pilote · bleu : référence · échelle identique.';
 }
}
function channelBounds(data,def){
 const values=data.map(s=>val(s,def[4])).filter(finite);if(!values.length)return null;
 let low=Infinity,high=-Infinity;for(const value of values){if(value<low)low=value;if(value>high)high=value}
 if(def[0]==='throttle'||def[0]==='brake')return [0,1];
 if(def[0]==='steering'){const m=Math.max(1,Math.abs(low),Math.abs(high));return [-m,m]}
 if(def[0]==='speed'||def[0]==='rpm')return [0,Math.max(1,Math.ceil(high/25)*25)];
 return [Math.min(0,low-(high-low)*.1),high+(high-low)*.1+.00001]
}
function curve(canvas,def,data,reference){
 if(!window.VCEGraph35)return;
 if(!window.VCEGraph35.channels[def[0]]){
  window.VCEGraph35.channels[def[0]]={label:def[1],unit:def[2],color:def[3],names:def[4]};
 }
 window.VCEGraph35.draw(canvas,{key:def[0],primary:data,reference:reference||[],axis:$('vce-eng-x')?.value||'distance',cursor:state.cursor});
}
function display(){
 const {s,laps,data,reference}=source(),list=$('vce-eng-laps');list.replaceChildren();
 for(const lap of laps){
  const b=document.createElement('button');b.type='button';b.className='vce-eng-lap'+(lap===state.lap?' active':'');
  b.textContent='TOUR '+lap.number+'  '+(finite(lap.time)?lap.time.toFixed(3)+' s':'—')+' · '+lap.samples.length+' pts';
  b.onclick=()=>{
   const index=laps.findIndex(x=>x.number===lap.number);
   if(index<0||!$('lap'))return;
   $('lap').value=String(index);
   $('lap').dispatchEvent(new Event('change',{bubbles:true}));
  };list.append(b)
 }
 if(!laps.length)list.textContent='Aucun tour enregistré';
 $('vce-eng-status').textContent=state.live?'● DIRECT':s?.track||'EN ATTENTE';
 $('vce-eng-count').textContent=data.length+' échantillons';
 paintMap(data,reference?.samples||[]);
 const area=$('vce-eng-values');area.replaceChildren();
 const point=data[Math.min(data.length-1,Math.floor(state.cursor*Math.max(0,data.length-1)))];
 for(const d of defs.filter(d=>state.selected.has(d[0])).slice(0,12)){
  const card=document.createElement('article'),small=document.createElement('small'),bold=document.createElement('b');
  small.textContent=d[1];const value=val(point,d[4]);
  bold.textContent=value===null?'—':(d[0]==='throttle'||d[0]==='brake'?(value*100).toFixed(0):value.toFixed(d[0]==='gear'?0:1))+(value===null?'':d[2]);
  card.append(small,bold);area.append(card)
 }
 const charts=$('vce-eng-curves');charts.replaceChildren();
 for(const d of defs.filter(d=>state.selected.has(d[0]))){
  const wrapper=document.createElement('div');wrapper.className='vce-eng-curve';
  const c=canvas('vce-eng-'+d[0],1200,155);wrapper.append(c);charts.append(wrapper);curve(c,d,data,state.live?[]:(reference?.samples||[]))
 }
}
/* Cursor updates repaint existing canvases only.
   Do not rebuild the entire list, charts and canvas DOM on every pointer movement. */
function cursorOnly(){
 const {data,reference}=source();
 const ref=reference?.samples||[];
 paintMap(data,ref);
 const index=data.length?Math.max(0,Math.min(data.length-1,Math.round(state.cursor*(data.length-1)))):-1;
 const point=index>=0?data[index]:null;
 const names=defs.filter(d=>state.selected.has(d[0])).slice(0,12);
 const values=$('vce-eng-values')?.querySelectorAll('article b')||[];
 names.forEach((d,i)=>{
  const value=val(point,d[4]);
  if(!values[i])return;
  values[i].textContent=value===null?'—':
   (d[0]==='throttle'||d[0]==='brake'?(value*100).toFixed(0):value.toFixed(d[0]==='gear'?0:1))+(d[2]||'');
 });
 for(const cv of $('vce-eng-curves')?.querySelectorAll('canvas')||[]){
  const d=defs.find(item=>'vce-eng-'+item[0]===cv.id);
  if(d)curve(cv,d,data,state.live?[]:ref)
 }
}
function mount(){
 shell();const checks=$('vce-eng-checks');
 for(const d of defs){
  const label=document.createElement('label');label.className='vce-eng-check';
  const chk=document.createElement('input');chk.type='checkbox';chk.checked=state.selected.has(d[0]);
  chk.onchange=()=>{chk.checked?state.selected.add(d[0]):state.selected.delete(d[0]);display()};
  const bar=document.createElement('i');bar.style.background=d[3];const name=document.createElement('span');name.textContent=d[1];
  label.append(chk,bar,name);checks.append(label)
 }
 $('vce-eng-mode').onchange=e=>{state.live=e.target.value==='live';display()};
 $('vce-eng-x').onchange=display;
 $('vce-eng-curves').addEventListener('pointermove',e=>{
  if(e.target.tagName!=='CANVAS')return;const box=e.target.getBoundingClientRect();
  const now=performance.now();
  if(now-(state.lastCursorAt||0)<70)return;
  state.lastCursorAt=now;
  const px=(e.clientX-box.left)*1200/Math.max(1,box.width);
  state.cursor=Math.max(0,Math.min(1,(px-78)/(1200-78-22)));cursorOnly()
 });
 document.addEventListener('vce-cloud-update',()=>{display()});
 for(const id of ['session','lap','reference'])$(id)?.addEventListener('change',()=>display());
 document.addEventListener('vce-live-frame',e=>{
  if(!state.live)return;
  const p=e.detail;if(!p?.samples?.length)return;
  // Never merge a previous pilot's/session's frames into the selected session.
  const selectedSession=window.vceSession?.id;
  if(p.session_id&&selectedSession&&p.session_id!==selectedSession)return;
  if(p.session_id!==state.liveSession){state.liveSession=p.session_id;state.liveData=[]}
  state.liveData.push(...p.samples.map(x=>({...x,speed:x.speed_kmh,steering:x.steer,x:x.world_x,y:x.world_z,distance:x.lap_pos})));
  if(state.liveData.length>2400)state.liveData.splice(0,state.liveData.length-2400);
  const now=performance.now();
  if(!state.lastLiveRender||now-state.lastLiveRender>=110){state.lastLiveRender=now;display()}
 });
 display()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount()
})();
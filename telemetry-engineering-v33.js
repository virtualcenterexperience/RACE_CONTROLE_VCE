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
 const css=document.createElement('style');css.textContent=
 '#vce-engineering-v33{background:#090e15;border-top:2px solid #f43f61;padding:14px}'+
 '.vce-eng-title,.vce-eng-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}'+
 '.vce-eng-title small{font-size:10px;color:#fb4d73}.vce-eng-title h2{color:#fff;font-size:16px;margin:3px 0 13px}'+
 '.vce-eng-title span,.vce-eng-toolbar span{font-size:11px;color:#8eb6d8}'+
 '.vce-eng-layout{display:grid;grid-template-columns:225px minmax(0,1fr);gap:12px}'+
 '.vce-eng-side{max-height:830px;overflow:auto;background:#101b2a;border:1px solid #35475c;border-radius:5px;padding:10px}'+
 '.vce-eng-side strong{display:block;font-size:11px;color:#69b4ff;margin:12px 0}'+
 '.vce-eng-lap{width:100%;display:block;margin:3px 0;padding:8px;background:#142337;border:1px solid #3a5167;border-radius:4px;color:#dcecff;font-size:11px;text-align:left;cursor:pointer}'+
 '.vce-eng-lap.active{border-color:#ff567a;background:#392139}'+
 '.vce-eng-check{display:flex;align-items:center;gap:6px;font-size:10px;color:#c8d9ec;margin:6px 0;cursor:pointer}'+
 '.vce-eng-check i{width:6px;height:16px;display:inline-block}.vce-eng-check input{accent-color:#f43f61}'+
 '.vce-eng-work{min-width:0}.vce-eng-toolbar{justify-content:flex-start;margin-bottom:12px}'+
 '.vce-eng-toolbar label{font-size:11px;color:#8eabc8;display:grid;gap:4px}'+
 '.vce-eng-toolbar select{padding:6px;background:#17263a;color:#fff;border:1px solid #37526c;border-radius:4px}'+
 '.vce-eng-upper{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr);gap:10px;margin-bottom:12px}'+
 '.vce-eng-track,.vce-eng-values{background:#090f19;border:1px solid #314257;border-radius:5px;padding:10px;min-width:0}'+
 '.vce-eng-track strong,.vce-eng-values strong,.vce-eng-plot-title{font-size:11px;color:#b9d5f4}'+
 '#vce-eng-map{width:100%;height:auto;display:block;margin:8px 0}'+
 '#vce-eng-maptext{font-size:10px;color:#8baccc}'+
 '#vce-eng-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:8px}'+
 '#vce-eng-values article{background:#172435;border:1px solid #344459;border-radius:4px;padding:7px;min-width:0}'+
 '#vce-eng-values small{display:block;font-size:10px;color:#8cabc8}'+
 '#vce-eng-values b{display:block;color:#eff7ff;font-size:16px}'+
 '.vce-eng-curve{background:#111922;border:1px solid #324253;margin:5px 0}.vce-eng-curve canvas{display:block;width:100%;height:105px}'+
 '@media(max-width:870px){.vce-eng-layout,.vce-eng-upper{grid-template-columns:1fr}.vce-eng-side{max-height:230px}}';
 document.head.append(css)
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
function paintMap(data){
 const canvas=$('vce-eng-map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#070d16';ctx.fillRect(0,0,w,h);
 const coords=data.map(p=>[val(p,['x','world_x']),val(p,['y','world_z'])]).filter(v=>v.every(finite));
 const xs=coords.map(x=>x[0]),ys=coords.map(x=>x[1]);
 if(coords.length<5||Math.max(...xs)-Math.min(...xs)<.5||Math.max(...ys)-Math.min(...ys)<.5){
  ctx.fillStyle='#94a9c1';ctx.font='16px Segoe UI';ctx.fillText('Tracé indisponible : X/Z insuffisants',20,110);
  $('vce-eng-maptext').textContent=coords.length+' coordonnées reçues (deux axes requis)';return
 }
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.max((maxX-minX)/(w-40),(maxY-minY)/(h-40)),mx=(maxX+minX)/2,my=(maxY+minY)/2;
 const xy=p=>[w/2+(p[0]-mx)/scale,h/2-(p[1]-my)/scale];
 ctx.strokeStyle='#4ad986';ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.beginPath();
 coords.forEach((p,i)=>{const [x,y]=xy(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.stroke();
 const idx=Math.min(coords.length-1,Math.max(0,Math.floor(state.cursor*(coords.length-1))));
 const marker=xy(coords[idx]);ctx.fillStyle='#f8486b';ctx.beginPath();ctx.arc(marker[0],marker[1],6,0,2*Math.PI);ctx.fill();
 $('vce-eng-maptext').textContent=coords.length+' positions enregistrées · largeur réelle inconnue'
}
function channelBounds(data,def){
 const values=data.map(s=>val(s,def[4])).filter(finite);if(!values.length)return null;
 const low=Math.min(...values),high=Math.max(...values);
 if(def[0]==='throttle'||def[0]==='brake')return [0,1];
 if(def[0]==='steering'){const m=Math.max(1,Math.abs(low),Math.abs(high));return [-m,m]}
 if(def[0]==='speed'||def[0]==='rpm')return [0,Math.max(1,Math.ceil(high/25)*25)];
 return [Math.min(0,low-(high-low)*.1),high+(high-low)*.1+.00001]
}
function curve(canvas,def,data){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#111923';ctx.fillRect(0,0,w,h);
 const bounds=channelBounds(data,def);
 ctx.fillStyle=def[3];ctx.font='bold 15px Segoe UI';ctx.fillText(def[1],12,19);
 if(!bounds){ctx.fillStyle='#849db6';ctx.font='12px Segoe UI';ctx.fillText('CANAL NON DISPONIBLE',w-220,19);return}
 const xAxis=$('vce-eng-x').value,axis=data.map((s,i)=>xAxis==='distance'?val(s,['distance','lap_pos']):val(s,['t']));
 const validAxis=axis.filter(finite),lo=validAxis.length?Math.min(...validAxis):0,hi=validAxis.length?Math.max(...validAxis):data.length-1;
 const x=i=>65+((finite(axis[i])?axis[i]:i)-lo)/Math.max(.0001,hi-lo)*(w-85);
 const y=v=>h-13-(v-bounds[0])/Math.max(.00001,bounds[1]-bounds[0])*(h-45);
 ctx.strokeStyle='#344358';for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(60,28+k*30);ctx.lineTo(w-20,28+k*30);ctx.stroke()}
 ctx.strokeStyle=def[3];ctx.lineWidth=2;ctx.beginPath();let pen=false;
 data.forEach((s,i)=>{const v=val(s,def[4]);if(v===null){pen=false;return}if(!pen){ctx.moveTo(x(i),y(v));pen=true}else if(def[0]==='gear'){const previous=val(data[i-1],def[4]);if(previous!==null)ctx.lineTo(x(i),y(previous));ctx.lineTo(x(i),y(v))}else ctx.lineTo(x(i),y(v))});ctx.stroke();
 ctx.fillStyle='#a2b4ca';ctx.font='12px Segoe UI';ctx.fillText(bounds[1].toFixed(1)+(def[2]||''),w-90,19);
}
function display(){
 const {s,laps,data}=source(),list=$('vce-eng-laps');list.replaceChildren();
 for(const lap of laps){
  const b=document.createElement('button');b.type='button';b.className='vce-eng-lap'+(lap===state.lap?' active':'');
  b.textContent='TOUR '+lap.number+'  '+(finite(lap.time)?lap.time.toFixed(3)+' s':'—')+' · '+lap.samples.length+' pts';
  b.onclick=()=>{
   const index=laps.findIndex(x=>x.number===lap.number);
   if(index<0||!$('lap'))return;
   $('lap').value=String(index);
   $('lap').dispatchEvent(new Event('change',{bubbles:true}));
   display();
  };list.append(b)
 }
 if(!laps.length)list.textContent='Aucun tour enregistré';
 $('vce-eng-status').textContent=state.live?'● DIRECT':s?.track||'EN ATTENTE';
 $('vce-eng-count').textContent=data.length+' échantillons';
 paintMap(data);
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
  const c=canvas('vce-eng-'+d[0],1200,105);wrapper.append(c);charts.append(wrapper);curve(c,d,data)
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
  state.cursor=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width));display()
 });
 document.addEventListener('vce-cloud-update',()=>{display()});
 for(const id of ['session','lap','reference'])$(id)?.addEventListener('change',()=>display());
 document.addEventListener('vce-live-frame',e=>{
  if(!state.live)return;
  const p=e.detail;if(!p?.samples?.length)return;
  state.liveData.push(...p.samples.map(x=>({...x,speed:x.speed_kmh,steering:x.steer,x:x.world_x,y:x.world_z,distance:x.lap_pos})));
  if(state.liveData.length>1000)state.liveData.splice(0,state.liveData.length-1000);
  display()
 });
 display()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount()
})();
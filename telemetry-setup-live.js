/* VCE Setup live engineering charts — measured native data only, never synthesized.
   Groups: suspension, aero, ride-height, tyre temp/wear, camber, brake temps, fuel. */
(()=>{'use strict';
const $=id=>document.getElementById(id),isNumber=v=>typeof v==='number'&&Number.isFinite(v);
const groups=[
 {id:'suspension',title:'DÉBATTEMENT DES SUSPENSIONS',unit:'mm',keys:[['suspension_fl','AVG'],['suspension_fr','AVD'],['suspension_rl','ARG'],['suspension_rr','ARD']]},
 {id:'aero',title:'CHARGE AÉRODYNAMIQUE & TRAÎNÉE',unit:'N',keys:[['front_downforce','Appui AV'],['rear_downforce','Appui AR'],['drag','Traînée']]},
 {id:'ride',title:'HAUTEUR DE CAISSE',unit:'mm',keys:[['ride_height_front','Avant'],['ride_height_rear','Arrière']]},
 {id:'tyres',title:'TEMPÉRATURE DES PNEUS',unit:'°C',keys:[['tyre_temp_fl','AVG'],['tyre_temp_fr','AVD'],['tyre_temp_rl','ARG'],['tyre_temp_rr','ARD']]},
 {id:'wear',title:'USURE DES PNEUS',unit:'%',keys:[['tyre_wear_fl','AVG'],['tyre_wear_fr','AVD'],['tyre_wear_rl','ARG'],['tyre_wear_rr','ARD']]},
 {id:'brake',title:'TEMPÉRATURE DES FREINS',unit:'°C',keys:[['brake_temp_fl','AVG'],['brake_temp_fr','AVD'],['brake_temp_rl','ARG'],['brake_temp_rr','ARD']]},
 {id:'camber',title:'CARROSSAGE MESURÉ',unit:'°',keys:[['camber_fl','AVG'],['camber_fr','AVD'],['camber_rl','ARG'],['camber_rr','ARD']]},
 {id:'fuel',title:'CARBURANT RESTANT',unit:'L',keys:[['fuel','Volume restant']]}
];
const palette=['#45c3f5','#f35c78','#9c8dff','#f6bb62'];
const aliases={fuel:['fuel_l','fuel_liters'],front_downforce:['aero_front_downforce'],rear_downforce:['aero_rear_downforce'],drag:['aero_drag'],
 tyre_wear_fl:['tire_wear_fl'],tyre_wear_fr:['tire_wear_fr'],tyre_wear_rl:['tire_wear_rl'],tyre_wear_rr:['tire_wear_rr']};
const get=(p,k)=>{
 for(const name of [k,...(aliases[k]||[])]){const x=p?.[name];if(isNumber(x))return x}
 return null;
};
let latest=null,session='',lastT=-Infinity,buffer=[],lastFrame=0,pending=false,lastPaint=0;
function mount(){
 const root=$('vce-setup-live');if(!root||root.dataset.mounted)return;
 root.dataset.mounted='1';
 root.innerHTML='<div class="vce-setup-live-heading"><div><small class="vce-kicker">LIVE MECHANICAL / NATIVE TELEMETRY</small><h2>CAPTEURS EN DIRECT · MÉCANIQUE</h2></div><span id="vce-setup-live-status">En attente du flux de télémétrie</span></div><div class="vce-setup-live-grid"></div>';
 const grid=root.querySelector('.vce-setup-live-grid');
 for(const g of groups){
  const card=document.createElement('article');card.className='vce-setup-live-card';card.dataset.group=g.id;
  const head=document.createElement('div');head.className='vce-setup-live-card-head';
  const title=document.createElement('strong');title.textContent=g.title;
  const state=document.createElement('span');state.className='vce-setup-group-status';state.textContent='En attente de données';
  head.append(title,state);card.append(head);
  const canvas=document.createElement('canvas');canvas.id='vce-setup-chart-'+g.id;
  canvas.width=900;canvas.height=210;canvas.setAttribute('aria-label','Courbes réelles : '+g.title);
  card.append(canvas);
  const values=document.createElement('div');values.className='vce-setup-live-values';
  for(const [index,[key,label]] of g.keys.entries()){
   const chip=document.createElement('span');chip.dataset.key=key;
   chip.style.setProperty('--series-color',palette[index%palette.length]);chip.textContent=label+' : —';values.append(chip);
  }
  card.append(values);grid.append(card);
 }
}
function consume(event){
 const p=event.detail||{};
 if(p.session_id&&window.vceSession?.id&&p.session_id!==window.vceSession.id)return;
 const sid=p.session_id||'',batch=Array.isArray(p.samples)?p.samples:[];
 if(sid!==session){session=sid;lastT=-Infinity;buffer=[]}
 for(const sample of batch){
  if(!isNumber(sample.t))continue;
  if(sample.t<lastT-1){buffer=[];lastT=-Infinity}
  if(sample.t<=lastT)continue;
  lastT=sample.t;latest=sample;buffer.push(sample)
 }
 if(buffer.length>3600)buffer.splice(0,buffer.length-3600);
 if(batch.length){lastFrame=Date.now();drawSoon()}
}
function cardDraw(group){
 const canvas=$('vce-setup-chart-'+group.id);
 if(!canvas)return false;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.fillStyle='#081527';c.fillRect(0,0,w,h);
 const visible=buffer.filter(x=>!isNumber(lastT)||x.t>=lastT-18);
 const available=group.keys.filter(([key])=>visible.some(p=>get(p,key)!==null));
 const status=canvas.parentNode.querySelector('.vce-setup-group-status');
 status.textContent=available.length+' / '+group.keys.length+' canaux';
 for(const [key,label] of group.keys){
  const chip=canvas.parentNode.querySelector('[data-key="'+key+'"]');
  const v=get(latest,key);if(chip)chip.textContent=label+' : '+(v===null?'—':v.toFixed(Math.abs(v)<10?2:1)+' '+group.unit);
 }
 const l=56,r=15,t=26,b=30,innerW=w-l-r,innerH=h-t-b;
 for(let i=0;i<=4;i++){
  const y=t+i*innerH/4;c.beginPath();c.strokeStyle='#233650';c.lineWidth=1;c.moveTo(l,y);c.lineTo(w-r,y);c.stroke()
 }
 if(!available.length||visible.length<2){
  c.fillStyle='#8ca9c7';c.font='15px Segoe UI';
  c.fillText(visible.length?'Ce canal n’est pas transmis par le jeu':'En attente de mesures natives',l+8,h/2);
  return false;
 }
 const values=visible.flatMap(p=>available.map(([key])=>get(p,key))).filter(isNumber);
 let min=Math.min(...values),max=Math.max(...values);let delta=max-min;
 if(delta<.0001){const pad=Math.max(1,Math.abs(max)*.05);min-=pad;max+=pad;delta=max-min}
 const padding=delta*.08;min-=padding;max+=padding;delta=max-min;
 const first=visible[0].t,span=Math.max(.01,lastT-first);
 c.fillStyle='#89aacb';c.font='12px Segoe UI';
 c.fillText(max.toFixed(1)+' '+group.unit,6,t+8);c.fillText(min.toFixed(1),6,t+innerH);
 for(let k=0;k<group.keys.length;k++){
  const [key]=group.keys[k];if(!available.some(x=>x[0]===key))continue;
  c.strokeStyle=palette[k%palette.length];c.lineWidth=2.6;c.beginPath();let firstPoint=true,lastSample=null;
  for(const p of visible){
   const v=get(p,key);if(v===null){firstPoint=true;continue}
   const x=l+(p.t-first)/span*innerW,y=t+innerH-(v-min)/delta*innerH;
   if(firstPoint||(lastSample!==null&&p.t-lastSample>.7)){c.moveTo(x,y)}else c.lineTo(x,y);
   lastSample=p.t;firstPoint=false;
  }
  c.stroke()
 }
 return true;
}
function paint(){
 pending=false;
 if(document.hidden||!$('vce-setup-live'))return;
 let count=0;for(const group of groups)if(cardDraw(group))count++;
 const status=$('vce-setup-live-status'),state=$('vce-setup-data-state');
 const age=lastFrame?Math.round((Date.now()-lastFrame)/1000):null;
 const msg=age===null?'En attente de l’application Windows':
  age<=4?'● DIRECT · '+count+' groupe(s) mesuré(s)':
  '○ FLUX ARRÊTÉ · dernière trame il y a '+age+' s';
 if(status)status.textContent=msg;
 if(state)state.textContent=msg;
}
function drawSoon(){
 const now=performance.now();if(pending||now-lastPaint<130)return;
 lastPaint=now;pending=true;requestAnimationFrame(paint);
}
function init(){
 mount();document.addEventListener('vce-live-frame',consume);
 document.addEventListener('vce-cloud-update',()=>{
  if(window.vceSession?.id!==session){buffer=[];latest=null;lastT=-Infinity;lastFrame=0;session=window.vceSession?.id||''}
  drawSoon()
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint()});
 setInterval(()=>{if(!document.hidden){drawSoon()}},4000);
 paint()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
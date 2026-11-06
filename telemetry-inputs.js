/* VCE INPUTS LAB · native controls only; 60fps display, no synthetic readings */
(()=>{
'use strict';
const $=id=>document.getElementById(id),finite=n=>typeof n==='number'&&Number.isFinite(n);
let history=[],lastTime=-Infinity,sessionId='',lastSample=null,drawId=0,lastPacketAt=0,received=0,liveOn=true;
const fields=[
 ['throttle','ACCÉLÉRATEUR · INPUT PROGRESSIF','#22c55e',v=>v*100,'%','0–100 %'],
 ['brake','FREIN · INPUT PROGRESSIF','#ef4444',v=>v*100,'%','0–100 %'],
 ['steering','VOLANT · STEER LEFT / RIGHT','#d9b0ff',v=>v,'','Braquage natif'],
 ['speed','VITESSE','#6366f1',v=>v,' km/h','Vitesse véhicule']
];
function mount(){
 const anchor=$('vce-stream');
 if(!anchor||$('vce-inputs-lab'))return;
 const el=document.createElement('section');el.className='panel vce-inputs-lab';el.id='vce-inputs-lab';
 el.innerHTML='<div class="head"><h2>INPUTS PILOTE · LIVE</h2><span id="vce-input-status">EN ATTENTE DE MESURES</span></div><p class="muted">Accélérateur, frein, volant et vitesse issus des mesures du jeu. Les courbes réagissent à chaque paquet reçu. Le navigateur dessine jusqu’à 60 images/s.</p><div class="vce-input-values" id="vce-input-values"></div><canvas id="vce-input-canvas" width="1400" height="540" aria-label="Courbes de télémétrie des commandes"></canvas><p class="muted" id="vce-input-diagnostic">Les valeurs absentes ne sont pas simulées.</p>';
 const toggle=document.createElement('button');toggle.type='button';toggle.id='vce-input-toggle';
 toggle.textContent='● DIRECT ON';toggle.setAttribute('aria-pressed','true');
 toggle.onclick=()=>{liveOn=!liveOn;toggle.textContent=liveOn?'● DIRECT ON':'○ DIRECT OFF';toggle.setAttribute('aria-pressed',String(liveOn));};
 el.querySelector('.head')?.append(toggle);
 anchor.after(el);
 const box=$('vce-input-values');
 for(const [key,label,color] of fields){const item=document.createElement('article');item.innerHTML='<small></small><strong>—</strong><div class="vce-input-meter"><i></i></div>';item.dataset.key=key;item.querySelector('small').textContent=label;item.querySelector('i').style.background=color;box.append(item)}
 const extra=document.createElement('article');extra.dataset.key='gear';extra.innerHTML='<small>RAPPORT ENGAGÉ</small><strong>—</strong><div class="vce-input-meter"><i style="width:0"></i></div>';box.append(extra);
 requestAnimationFrame(draw);
}
function normalize(s){
 const steer=finite(s.steer)?s.steer:finite(s.steering)?s.steering:null;
 return {t:s.t,throttle:finite(s.throttle)?s.throttle:null,brake:finite(s.brake)?s.brake:null,
 steering:steer,speed:finite(s.speed_kmh)?s.speed_kmh:null,gear:finite(s.gear)?s.gear:null};
}
function update(){
 const state=window.VCEInputFeed;
 if(!state?.samples?.length||!liveOn)return;
 const id=state.sessionId||'unknown';
 if(id!==sessionId){sessionId=id;history=[];lastTime=-Infinity;lastSample=null;received=0}
 for(const raw of state.samples){
  if(!finite(raw.t))continue;
  if(raw.t<lastTime-1){history=[];lastTime=-Infinity} // Game clock reset: new run / lap
  if(raw.t<=lastTime)continue;
  const sample=normalize(raw);history.push(sample);lastTime=raw.t;lastSample=sample;received++;
 }
 if(history.length>3000)history.splice(0,history.length-3000);
 if(state.samples.length)lastPacketAt=Date.now();
 $('vce-input-status').textContent='● '+history.length+' MESURES EN MÉMOIRE · '+received+' REÇUES';
 $('vce-input-diagnostic').textContent='Fenêtre de 15 secondes · '+history.length+' points disponibles. Les courbes ne peuvent se compléter que si de nouveaux échantillons arrivent depuis le jeu.';
 if(lastSample){
  for(const [key,label,color,convert,unit] of fields){
   const item=document.querySelector('.vce-input-values [data-key="'+key+'"]');
   if(!item)continue;
   const val=lastSample[key];
   item.querySelector('strong').textContent=finite(val)?convert(val).toFixed(1)+unit:'—';
   const maxSpeed=Math.max(100,Math.ceil(Math.max(...history.slice(-600).map(p=>finite(p.speed)?p.speed:0))/50)*50);
   const width=key==='speed'?Math.max(0,Math.min(100,val/maxSpeed*100)):key==='steering'?Math.min(100,Math.abs(val)*(Math.abs(val)<=1?100:1)):Math.min(100,val*100);
   item.querySelector('i').style.width=finite(val)?width+'%':'0%';
  }
  document.querySelector('[data-key="gear"] strong').textContent=finite(lastSample.gear)?String(lastSample.gear):'—';
 }
}
function draw(){
 const canvas=$('vce-input-canvas');
 if(canvas&&history.length){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.fillStyle='#17191c';c.fillRect(0,0,w,h);
  const max=history.at(-1).t,min=max-15;
  const first=history[0].t,span=max-first;
  const liveRange=span>=15?15:Math.max(0.5,span);
  const left=span>=15?max-15:first;
  const plotX=t=>70+Math.max(0,Math.min(1,(t-left)/liveRange))*(w-95);
  const rowHeight=116;
  fields.forEach(([key,label,color,convert,unit],i)=>{
   const top=16+i*132,bottom=top+rowHeight;
   c.fillStyle='#222428';c.fillRect(58,top,w-85,rowHeight);
   c.strokeStyle='#383c42';c.lineWidth=1;
   for(let j=0;j<=4;j++){const y=top+j*rowHeight/4;c.beginPath();c.moveTo(58,y);c.lineTo(w-27,y);c.stroke()}
   c.fillStyle=color;c.font='bold 18px Segoe UI';c.fillText(label,70,top+24);
   c.strokeStyle=color;c.lineWidth=3;c.beginPath();let started=false,previousTime=null;
   const maxSpeed=Math.max(100,Math.ceil(Math.max(...history.slice(-600).map(p=>finite(p.speed)?p.speed:0))/50)*50);
   const scale=key==='speed'?maxSpeed:100;
   for(const s of history){if(s.t<left)continue;const value=s[key];if(!finite(value)){started=false;continue}
    const normalized=key==='steering'?(value*(Math.abs(value)<=1?100:1)+100)/2:convert(value);
    const y=bottom-8-Math.max(0,Math.min(1,normalized/scale))*(rowHeight-45);
    if(!started||previousTime!==null&&s.t-previousTime>.35){c.moveTo(plotX(s.t),y);started=true}else c.lineTo(plotX(s.t),y);
    previousTime=s.t;
   }c.stroke();
   c.fillStyle='#95abc8';c.font='12px Segoe UI';
   c.fillText(key==='speed'?'0–'+maxSpeed+' km/h':key==='steering'?'GAUCHE / CENTRE / DROITE':'0 % bas · 100 % haut',w-340,top+22);
   c.fillText('Échantillons '+history.length+' · '+span.toFixed(2)+' s',w-340,top+38);
  });
 }
 if(lastPacketAt&&Date.now()-lastPacketAt>3000){const status=$('vce-input-status');if(status)status.textContent='● FLUX EN PAUSE · DERNIÈRE MESURE IL Y A '+Math.round((Date.now()-lastPacketAt)/1000)+' S';}
 drawId=requestAnimationFrame(draw);
}
function onFrame(e){
 const p=e.detail;if(!p?.samples?.length)return;
 window.VCEInputFeed={sessionId:p.session_id,samples:p.samples};
 update();
}
function start(){mount();document.addEventListener('vce-live-frame',onFrame)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
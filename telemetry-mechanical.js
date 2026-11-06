/* VCE mechanical telemetry: read-only display of genuine game channels.
   Never infer physical ground contact from suspension travel alone. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const channels=[
 ['suspension_fl','SUSPENSION AVG','mm'],['suspension_fr','SUSPENSION AVD','mm'],
 ['suspension_rl','SUSPENSION ARG','mm'],['suspension_rr','SUSPENSION ARD','mm'],
 ['ride_height_front','GARDE AU SOL AVANT','mm'],['ride_height_rear','GARDE AU SOL ARRIÈRE','mm'],
 ['speed_kmh','VITESSE DE PASSAGE','km/h']
];
const number=v=>typeof v==='number'&&Number.isFinite(v);
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
let last=null,series=[],session='',lastT=-Infinity,raf=0,dirty=false;
function mount(){
 const anchor=$('vce-stream');if(!anchor||$('vce-mechanical'))return;
 const panel=node('section','panel vce-mechanical');panel.id='vce-mechanical';
 const head=node('div','head');head.append(node('h2','','LIVE TIMING · SUSPENSIONS & GARDE AU SOL'));
 const state=node('span','','EN ATTENTE DE CANAUX MÉCANIQUES');state.id='vce-mechanical-state';head.append(state);panel.append(head);
 panel.append(node('p','muted','Données mécaniques réelles uniquement. Les canaux non exposés par le jeu restent indisponibles ; aucun raclage n’est inventé.'));
 const grid=node('div','vce-mechanical-grid');
 for(const [key,label] of channels){const card=node('article');card.dataset.channel=key;card.append(node('small','',label),node('strong','','—'));grid.append(card)}
 panel.append(grid);
 const contact=node('div','vce-contact');contact.append(node('strong','','CONTACT SOUS-CAISSE : NON DÉTERMINÉ'),node('p','muted','La compression des suspensions ne suffit pas à confirmer un contact avec la piste.'));contact.id='vce-ground-contact';panel.append(contact);
 const graph=node('canvas');graph.id='vce-mechanical-plot';graph.width=1200;graph.height=280;graph.setAttribute('aria-label','Suspensions et garde au sol en direct');panel.append(graph);
 anchor.after(panel);
 requestAnimationFrame(draw);
}
function receive(e){
 const payload=e.detail||{},id=payload.session_id||'';
 if(id!==session){session=id;series=[];lastT=-Infinity}
 const incoming=Array.isArray(payload.samples)?payload.samples:[];
 for(const p of incoming){
  if(!number(p.t)||p.t<=lastT)continue;
  lastT=p.t;last=p;series.push(p);
 }
 if(series.length>1200)series.splice(0,series.length-1200);
 if(!last)return;
 let available=0;
 for(const [key,,unit] of channels){const el=document.querySelector('[data-channel="'+key+'"] strong');if(!el)continue;const v=last[key];el.textContent=number(v)?v.toFixed(1)+' '+unit:'—';if(number(v))available++}
 $('vce-mechanical-state').textContent=available+' / '+channels.length+' CANAUX DISPONIBLES';
 const box=$('vce-ground-contact');const confirmed=last.ground_contact===true;
 box.querySelector('strong').textContent=confirmed?'CONTACT SOUS-CAISSE : SIGNAL CONFIRMÉ':'CONTACT SOUS-CAISSE : NON DÉTERMINÉ';
 box.dataset.contact=confirmed?'yes':'unknown';
 dirty=true;
}
function draw(){
 const c=$('vce-mechanical-plot');
 if(c&&dirty){
  dirty=false;const ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#17191c';ctx.fillRect(0,0,w,h);
  for(let i=0;i<5;i++){ctx.strokeStyle='#34383f';ctx.beginPath();ctx.moveTo(40,25+i*52);ctx.lineTo(w-25,25+i*52);ctx.stroke()}
  const keys=['suspension_fl','suspension_fr','suspension_rl','suspension_rr'];
  const colors=['#ff901d','#4d9dff','#21c55d','#e2a7f6'];
  const vals=series.flatMap(p=>keys.map(k=>p[k])).filter(number);
  if(vals.length){
   const lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(1,hi-lo);
   const tmax=series.at(-1).t,tmin=tmax-15;
   keys.forEach((key,i)=>{ctx.beginPath();ctx.strokeStyle=colors[i];ctx.lineWidth=2.5;let started=false;
    for(const p of series){if(p.t<tmin||!number(p[key])){started=false;continue}
     const x=45+(p.t-tmin)/15*(w-75),y=245-(p[key]-lo)/span*200;
     if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)
    }ctx.stroke();
    ctx.fillStyle=colors[i];ctx.font='bold 14px Segoe UI';ctx.fillText(['AVG','AVD','ARG','ARD'][i],50+i*95,18);
   });
  }else{ctx.fillStyle='#b5b8bd';ctx.font='16px Segoe UI';ctx.fillText('En attente de données de suspension natives',45,150)}
 }
 raf=requestAnimationFrame(draw);
}
function start(){mount();document.addEventListener('vce-live-frame',receive)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
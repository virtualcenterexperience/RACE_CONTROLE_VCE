/* VCE Replay 3D v1: native lap samples only. Perspective projection, no simulated driving data. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
let playing=false,progress=0,lastTick=0,rate=1,camera='chase',samples=[],reference=[],duration=0,ready=false,zoom=3,referenceName='RÉFÉRENCE';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const getLaps=()=>{const s=window.vceSession;return(s?.laps||[]).filter(l=>l&&((Number.isFinite(+l.time)&&+l.time>0)||(l.samples||[]).length>=2||Number.isInteger(l.number))).slice().sort((a,b)=>(a.number??0)-(b.number??0))};
function points(lap){
 return (lap?.samples||[]).filter(p=>p.x!==null&&p.y!==null&&p.x!==undefined&&p.y!==undefined&&p.x!==''&&p.y!==''&&finite(+p.x)&&finite(+p.y)).map((p,i)=>({
 x:+p.x,y:+p.y,z:finite(+p.z)&&p.z!==null?+p.z:0,
 t:finite(+p.t)&&p.t!==null?+p.t:i/Math.max(1,lap.samples.length-1)*(lap.time||90),
 speed:finite(+p.speed)?+p.speed:null,brake:finite(+p.brake)?+p.brake:null,throttle:finite(+p.throttle)?+p.throttle:null
 })).sort((a,b)=>a.t-b.t);
}
function sampleAt(arr,t){
 if(!arr.length)return null;
 if(t<=arr[0].t)return arr[0];
 if(t>=arr.at(-1).t)return arr.at(-1);
 let lo=0,hi=arr.length-1;
 while(lo+1<hi){const m=(lo+hi)>>1;if(arr[m].t<t)lo=m;else hi=m}
 const a=arr[lo],b=arr[hi],k=(t-a.t)/Math.max(0.0001,b.t-a.t);
 const p={};for(const key of ['x','y','z','speed','brake','throttle'])p[key]=finite(a[key])&&finite(b[key])?a[key]+(b[key]-a[key])*k:null;
 return p;
}
function selected(){
 const laps=getLaps(),a=laps[+$('lap')?.value];
 const b=$('reference')?.value==='external'?window.VCEexternalReferenceLap?.lap:laps[+$('reference')?.value];
 return [a,b];
}
function load(){
 const [a,b]=selected();samples=points(a);reference=points(b);
 referenceName=$('reference')?.value==='external'?(window.VCEexternalReferenceLap?.pilot||'COÉQUIPIER'):'RÉFÉRENCE';
 const all=[...samples,...reference],hasHeight=all.some(p=>p.z!==0);
 ready=samples.length>=3;
 duration=Math.max(0,samples.at(-1)?.t||0,reference.at(-1)?.t||0);
 progress=0;playing=false;$('vce-replay-play').textContent='▶ Lecture';
 $('vce-replay-slider').value='0';
 $('vce-replay-state').textContent=ready?(samples.length+' positions pilote · '+reference.length+' '+referenceName+' · '+(hasHeight?'altitude disponible':'piste plane : altitude absente')):'Coordonnées de trajectoire insuffisantes pour ce tour';
 $('vce-replay-play').disabled=!ready;
 if($('vce-replay-reference-name'))$('vce-replay-reference-name').textContent=referenceName;
}
function paint(){
 const canvas=$('vce-replay-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const bg=ctx.createLinearGradient(0,0,0,h);
 bg.addColorStop(0,'#101a27');bg.addColorStop(.55,'#192835');bg.addColorStop(1,'#1c3027');
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 if(!ready){ctx.fillStyle='#aeb6c1';ctx.font='19px Segoe UI';ctx.textAlign='center';ctx.fillText('Sélectionne une session avec des positions X/Y enregistrées',w/2,h/2);ctx.textAlign='left';return}
 const all=[...samples,...reference],xs=all.map(p=>p.x),ys=all.map(p=>p.y),zs=all.map(p=>p.z);
 const mid={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,z:(Math.min(...zs)+Math.max(...zs))/2};
 const radius=Math.max(10,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 const time=progress*duration,a=sampleAt(samples,time),b=sampleAt(reference,time);
 const focus=(camera==='chase'||camera==='cockpit')&&a?a:mid;
 const scale=((camera==='chase'||camera==='cockpit')?radius*0.13:radius*0.65)/zoom;
 const angle=camera==='top'?0.0:camera==='cockpit'?1.10:0.52;
 const next=sampleAt(samples,time+0.25),prev=sampleAt(samples,Math.max(0,time-0.25));
 const motionHeading=a&&next&&prev?Math.atan2(next.y-prev.y,next.x-prev.x):0;
 const heading=(camera==='chase'||camera==='cockpit')&&a?motionHeading:0;
 const ca=Math.cos(-heading),sa=Math.sin(-heading);
 function project(p){
  let x=p.x-focus.x,y=p.y-focus.y,z=p.z-focus.z;
  if(camera==='chase'||camera==='cockpit'){const xx=x*ca-y*sa,yy=x*sa+y*ca;x=xx;y=yy}
  const yy=y*Math.cos(angle)-z*Math.sin(angle),depth=y*Math.sin(angle)+z*Math.cos(angle);
  const perspective=camera==='top'?1:Math.max(0.45,1+depth/(scale*3));
  const f=Math.min(w,h)/(scale*2.4)*perspective;
  return [w/2+x*f,h/2+yy*f];
 }
 function line(arr,color,width){
  if(arr.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
  arr.forEach((p,i)=>{const [x,y]=project(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()
 }
 // Draw a neutral surface ribbon; elevation follows z when native data exists.
 // Recorded line is not a surveyed track boundary: no invented kerbs or track width.
 // Illustrative road ribbon traced from measured positions: NOT surveyed road width.
 const basePath=samples.length>=5?samples:reference;
 const track=basePath.length>700?basePath.filter((_,i)=>i%Math.ceil(basePath.length/700)===0):basePath;
 line(track,'#0b1016',37);line(track,'#3a4852',30);line(track,'#151b22',24);
 line(samples,'#ff951d',7);line(reference,'#4d9dff',3);
 function car(p,color,label,arr){if(!p)return;const [x,y]=project(p);const t=arr===reference?time:time;const before=sampleAt(arr,Math.max(0,t-.2)),after=sampleAt(arr,t+.2);const dir=before&&after?Math.atan2(after.y-before.y,after.x-before.x):0;ctx.save();ctx.translate(x,y);ctx.rotate(dir-(camera==='chase'||camera==='cockpit'?heading:0)+Math.PI/2);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(9,10);ctx.lineTo(0,6);ctx.lineTo(-9,10);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#fff';ctx.font='bold 12px Segoe UI';ctx.fillText(label,x+12,y-10)}
 car(b,'#4d9dff',referenceName,reference);if(camera!=='cockpit')car(a,'#ff951d','PILOTE',samples);
 if(camera==='cockpit'&&a){ctx.fillStyle='#080d16';ctx.beginPath();ctx.moveTo(w*.28,h);ctx.lineTo(w*.39,h*.83);ctx.lineTo(w*.61,h*.83);ctx.lineTo(w*.72,h);ctx.closePath();ctx.fill();ctx.strokeStyle='#f32d56';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.4,h*.85);ctx.lineTo(w*.6,h*.85);ctx.stroke();ctx.fillStyle='#dbeafe';ctx.font='bold 15px Segoe UI';ctx.fillText('CAMÉRA EMBARQUÉE · RECONSTITUTION XY',18,h-22)}
 ctx.fillStyle='rgba(7,13,24,.83)';ctx.fillRect(12,12,315,62);
 ctx.fillStyle='#ff951d';ctx.fillRect(24,25,18,4);ctx.fillStyle='#e7f1ff';ctx.font='bold 14px Segoe UI';ctx.fillText('PILOTE',52,30);
 ctx.fillStyle='#4d9dff';ctx.fillRect(24,49,18,4);ctx.fillStyle='#e7f1ff';ctx.fillText(referenceName.slice(0,28),52,54);
 const fmt=v=>finite(v)?v.toFixed(1):'—';
 $('vce-replay-time').textContent=time.toFixed(2)+' s / '+duration.toFixed(2)+' s';
 $('vce-replay-speed').textContent=fmt(a?.speed)+' km/h';
 $('vce-replay-brake').textContent=fmt(a?.brake)+'';
 $('vce-replay-throttle').textContent=fmt(a?.throttle)+'';
}
function loop(ts){
 if(playing&&ready){if(lastTick)progress=Math.min(1,progress+(ts-lastTick)/1000*rate/Math.max(0.1,duration));if(progress>=1){playing=false;$('vce-replay-play').textContent='▶ Lecture'}$('vce-replay-slider').value=String(Math.round(progress*1000))}
 lastTick=ts;paint();requestAnimationFrame(loop);
}
function mount(){
 const anchor=$('tt-circuit');if(!anchor||$('vce-replay'))return;
 const section=el('section',undefined,'panel vce-replay');section.id='vce-replay';
 section.innerHTML='<div class="head"><h2>REPLAY 3D · COMPARAISON DES TRAJECTOIRES</h2><span id="vce-replay-state">En attente de session</span></div><p class="muted"><span class="vce-replay-pilot-key">● Pilote</span> · <span class="vce-replay-reference-key">● Référence</span></p><div class="vce-replay-tools"><button id="vce-replay-play" disabled>▶ Lecture</button><label>Vitesse <select id="vce-replay-rate"><option value=".25">0,25×</option><option value=".5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Caméra <select id="vce-replay-camera"><option value="chase">Suivi voiture</option><option value="cockpit">Vue embarquée (reconstitution)</option><option value="overview">Perspective générale</option><option value="top">Vue de dessus</option></select></label><label>Zoom <input id="vce-replay-zoom" type="range" min="1" max="12" step="0.5" value="3" style="width:130px;vertical-align:middle"></label><button type="button" id="vce-replay-fit">Cadrer les deux trajectoires</button><button id="vce-replay-reload">Recharger les tours</button><button type="button" id="vce-replay-team">⇄ Pilote VCE</button></div><div class="vce-replay-timeline"><input type="range" id="vce-replay-slider" min="0" max="1000" value="0" step="1" aria-label="Position du replay"><span id="vce-replay-time">—</span></div><canvas id="vce-replay-canvas" width="1100" height="520"></canvas><div class="vce-replay-stats"><span>Référence : <b id="vce-replay-reference-name">—</b></span><span>Vitesse : <b id="vce-replay-speed">—</b></span><span>Frein : <b id="vce-replay-brake">—</b></span><span>Accélérateur : <b id="vce-replay-throttle">—</b></span></div>';
 anchor.after(section);
 $('vce-replay-play').onclick=()=>{if(progress>=1)progress=0;playing=!playing;lastTick=0;$('vce-replay-play').textContent=playing?'❚❚ Pause':'▶ Lecture'};
 $('vce-replay-fit').onclick=()=>{
  const view=$('vce-replay-camera');
  const scale=$('vce-replay-zoom');
  view.value='top';
  scale.value='1';
  view.dispatchEvent(new Event('change'));
  scale.dispatchEvent(new Event('input'));
 };
 $('vce-replay-slider').oninput=e=>{progress=+e.target.value/1000;lastTick=0};
 $('vce-replay-rate').onchange=e=>rate=+e.target.value;
 $('vce-replay-zoom').oninput=e=>zoom=+e.target.value;
 $('vce-replay-camera').onchange=e=>camera=e.target.value;
 $('vce-replay-reload').onclick=load;
 $('vce-replay-team').onclick=()=>{
   const pick=$('vce-other-session');
   if(!pick){alert('Charge une session Supabase pour comparer des pilotes VCE.');return}
   pick.scrollIntoView({behavior:'smooth',block:'center'});pick.focus();
 };
 ['lap','reference','session'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(load,100)));
 document.addEventListener('vce-cloud-update',()=>setTimeout(load,100));
 load();requestAnimationFrame(loop);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
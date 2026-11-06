/* VCE Replay 3D v1: native lap samples only. Perspective projection, no simulated driving data. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
let playing=false,progress=0,lastTick=0,rate=1,camera='chase',samples=[],reference=[],duration=0,ready=false;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const getLaps=()=>{const s=window.vceSession;return(s?.laps||[]).filter(l=>l.valid!==false&&((finite(l.time)&&l.time>0)||(l.samples||[]).length>=10))};
function points(lap){
 return (lap?.samples||[]).filter(p=>finite(+p.x)&&finite(+p.y)&&p.x!==null&&p.y!==null).map((p,i)=>({
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
 const all=[...samples,...reference],hasHeight=all.some(p=>p.z!==0);
 ready=samples.length>=3;
 duration=Math.max(0,samples.at(-1)?.t||0,reference.at(-1)?.t||0);
 progress=0;playing=false;$('vce-replay-play').textContent='▶ Lecture';
 $('vce-replay-slider').value='0';
 $('vce-replay-state').textContent=ready?(samples.length+' positions pilote · '+reference.length+' référence · '+(hasHeight?'altitude disponible':'piste plane : altitude absente')):'Coordonnées de trajectoire insuffisantes pour ce tour';
 $('vce-replay-play').disabled=!ready;
}
function paint(){
 const canvas=$('vce-replay-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#17191c';ctx.fillRect(0,0,w,h);
 if(!ready){ctx.fillStyle='#aeb6c1';ctx.font='19px Segoe UI';ctx.textAlign='center';ctx.fillText('Sélectionne une session avec des positions X/Y enregistrées',w/2,h/2);ctx.textAlign='left';return}
 const all=[...samples,...reference],xs=all.map(p=>p.x),ys=all.map(p=>p.y),zs=all.map(p=>p.z);
 const mid={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,z:(Math.min(...zs)+Math.max(...zs))/2};
 const radius=Math.max(10,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 const time=progress*duration,a=sampleAt(samples,time),b=sampleAt(reference,time);
 const focus=camera==='chase'&&a?a:mid;
 const scale=(camera==='chase'?radius*0.13:radius*0.65);
 const angle=camera==='top'?0.0:0.52;
 const heading=camera==='chase'&&a?Math.atan2((sampleAt(samples,time+0.2)?.y??a.y)-a.y,(sampleAt(samples,time+0.2)?.x??a.x)-a.x):0.5;
 const ca=Math.cos(-heading),sa=Math.sin(-heading);
 function project(p){
  let x=p.x-focus.x,y=p.y-focus.y,z=p.z-focus.z;
  if(camera==='chase'){const xx=x*ca-y*sa,yy=x*sa+y*ca;x=xx;y=yy}
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
 line(samples,'#41464c',26);line(samples,'#777c81',1.5);
 line(reference,'#4d9dff',4);line(samples,'#ff951d',4);
 function car(p,color,label){if(!p)return;const [x,y]=project(p);ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.fillRect(-8,-14,16,28);ctx.shadowBlur=0;ctx.strokeStyle='#101215';ctx.strokeRect(-8,-14,16,28);ctx.fillStyle='#fff';ctx.font='bold 13px Segoe UI';ctx.fillText(label,15,-10);ctx.restore()}
 car(b,'#4d9dff','RÉF');car(a,'#ff951d','PILOTE');
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
 section.innerHTML='<div class="head"><h2>REPLAY 3D · COMPARAISON DES TRAJECTOIRES</h2><span id="vce-replay-state">En attente de session</span></div><p class="muted">Replay calculé depuis les positions enregistrées. Orange : pilote · bleu : référence. Le relief n’est fidèle que si les coordonnées Z sont disponibles.</p><div class="vce-replay-tools"><button id="vce-replay-play" disabled>▶ Lecture</button><label>Vitesse <select id="vce-replay-rate"><option value=".25">0,25×</option><option value=".5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Caméra <select id="vce-replay-camera"><option value="chase">Poursuite</option><option value="overview">Perspective générale</option><option value="top">Vue de dessus</option></select></label><button id="vce-replay-reload">Recharger les tours</button></div><canvas id="vce-replay-canvas" width="1100" height="520"></canvas><input type="range" id="vce-replay-slider" min="0" max="1000" value="0" step="1" aria-label="Position du replay"><div class="vce-replay-stats"><span id="vce-replay-time">—</span><span>Vitesse : <b id="vce-replay-speed">—</b></span><span>Frein : <b id="vce-replay-brake">—</b></span><span>Accélérateur : <b id="vce-replay-throttle">—</b></span></div>';
 anchor.after(section);
 $('vce-replay-play').onclick=()=>{if(progress>=1)progress=0;playing=!playing;lastTick=0;$('vce-replay-play').textContent=playing?'❚❚ Pause':'▶ Lecture'};
 $('vce-replay-slider').oninput=e=>{progress=+e.target.value/1000;lastTick=0};
 $('vce-replay-rate').onchange=e=>rate=+e.target.value;
 $('vce-replay-camera').onchange=e=>camera=e.target.value;
 $('vce-replay-reload').onclick=load;
 ['lap','reference','session'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(load,100)));
 document.addEventListener('vce-cloud-update',()=>setTimeout(load,100));
 load();requestAnimationFrame(loop);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
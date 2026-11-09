/* VCE Performance Lab — Setup circuit comparison.
   Actual positions, timestamps and physical channels only. No estimated lap advantage. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>numeric(v)?Number(v):null;
const aliases={
 front_downforce:['aero_front_downforce'],rear_downforce:['aero_rear_downforce'],
 drag:['aero_drag'],ride_height_front:['ride_height_f'],ride_height_rear:['ride_height_r'],
 tyre_wear_fl:['tire_wear_fl','tyre_wear_lf'],tyre_temp_fl:['tire_temp_fl','tyre_temp_lf']
};
const unit={time:'s',front_downforce:'N',rear_downforce:'N',drag:'N',suspension_fl:'mm',
 suspension_fr:'mm',suspension_rl:'mm',suspension_rr:'mm',ride_height_front:'mm',
 ride_height_rear:'mm',camber_fl:'°',camber_fr:'°',tyre_wear_fl:'%',tyre_temp_fl:'°C'};
let liveSamples=[],liveSession='',liveLap=null,lastLive=0,renderPending=false,signature='',lastExternalKey='';
const profileCache=new WeakMap();
function read(s,key){
 if(!s)return null;
 for(const k of [key,...(aliases[key]||[])])if(numeric(s[k]))return Number(s[k]);
 return null;
}
function laps(){return (window.vceSession?.laps||[]).filter(l=>Array.isArray(l.samples)&&l.samples.length>=2)
 .slice().sort((a,b)=>(a.number??0)-(b.number??0))}
function external(){const ext=window.VCEexternalReferenceLap;return ext?.baseId===window.vceSession?.id?ext:null}
function syncOptions(){
 const a=$('vce-setup-lap'),b=$('vce-setup-reference');if(!a||!b)return;
 const list=laps(),ext=external();
 const key=(window.vceSession?.id||'')+'|'+list.map(l=>l.number+':'+l.samples.length).join('|')+
 '|'+(ext?.pilot||'')+':'+(ext?.lap?.number||'')+'|'+(liveSamples.length>1?'LIVE':'');
 if(key===signature)return;
 signature=key;
 const oldA=a.value,oldB=b.value;
 const items=list.map((l,i)=>({value:'lap:'+i,label:'Tour '+(l.number??i+1)+' · '+(numeric(l.time)?Number(l.time).toFixed(3)+' s':'chrono inconnu')}));
 if(liveSamples.length>1)items.unshift({value:'live',label:'● DIRECT · Tour en cours'});
 const options=items.map(x=>new Option(x.label,x.value));
 a.replaceChildren(...(options.length?options:[new Option('Aucun tour disponible','')]));
 const refs=list.map((l,i)=>new Option('Tour '+(l.number??i+1)+' · '+(numeric(l.time)?Number(l.time).toFixed(3)+' s':'chrono inconnu'),'lap:'+i));
 if(ext)refs.push(new Option('AUTRE PILOTE · '+ext.pilot,'external'));
 b.replaceChildren(...(refs.length?refs:[new Option('Aucune référence','')]));
 if([...a.options].some(o=>o.value===oldA))a.value=oldA;
 else if(liveSamples.length>1)a.value='live';
 else if(items.length)a.value=items.at(-1).value;
 const externalKey=ext?ext.baseId+':'+ext.pilot+':'+(ext.lap?.number??''):'';
 if(ext&&externalKey!==lastExternalKey)b.value='external';
 else if([...b.options].some(o=>o.value===oldB))b.value=oldB;
 else if(ext)b.value='external';
 else if(list.length)b.value='lap:'+Math.max(0,list.length-2);
 lastExternalKey=externalKey;
}
function getLap(value){
 if(value==='live')return {number:liveLap,samples:liveSamples,live:true};
 if(value==='external')return external()?.lap||null;
 if(value?.startsWith('lap:'))return laps()[Number(value.slice(4))]||null;
 return null;
}
function coords(s){
 if(!s)return null;
 const x=n(s.x??s.world_x),y=n(s.y??s.world_z);
 return x!==null&&y!==null?{x,y}:null;
}
function progress(s){
 // Relative lap-distance only. Do not infer progress from sample order.
 const p=n(s.lap_pos??s.distance);
 return p!==null&&p>=0&&p<=1.01?p:null;
}
function profile(lap,field){
 const src=lap?.samples;if(!Array.isArray(src))return [];
 let cached=profileCache.get(src);
 if(cached?.has(field))return cached.get(field);
 const rows=[];
 for(const s of src){
  const p=progress(s),v=field==='time'?n(s.t):read(s,field);
  if(p!==null&&v!==null)rows.push({p,v});
 }
 rows.sort((a,b)=>a.p-b.p);
 // Bounded interpolation profile to keep long endurance archives responsive.
 const stride=Math.max(1,Math.ceil(rows.length/16000));
 const result=stride===1?rows:rows.filter((_,i)=>i%stride===0||i===rows.length-1);
 if(!cached){cached=new Map();profileCache.set(src,cached)}
 cached.set(field,result);
 return result;
}
function interpolate(points,p){
 if(!points.length)return null;
 if(p<points[0].p-.003||p>points.at(-1).p+.003)return null;
 let left=0,right=points.length-1;
 while(left<right){const mid=(left+right)>>1;if(points[mid].p<p)left=mid+1;else right=mid}
 const b=points[left],a=points[Math.max(0,left-1)];
 if(!a||Math.abs(a.p-b.p)<1e-8)return b.v;
 const k=Math.max(0,Math.min(1,(p-a.p)/(b.p-a.p)));
 return a.v+(b.v-a.v)*k;
}
function mapped(lap){
 const src=lap?.samples||[],points=[],stride=Math.max(1,Math.ceil(src.length/3600));
 for(let i=0;i<src.length;i+=stride){
  const s=src[i],c=coords(s);
  if(c)points.push({...c,p:progress(s)});
 }
 return points;
}
function background(c,w,h){
 c.fillStyle='#071525';c.fillRect(0,0,w,h);
 c.strokeStyle='#18314d';c.lineWidth=1;
 for(let i=1;i<9;i++){const x=w*i/9;c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
 for(let i=1;i<6;i++){const y=h*i/6;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
}
function drawPath(c,points,project,color,width=3){
 if(points.length<2)return;
 c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
 let last=null;
 for(const p of points){
  const pt=project(p);if(last&&Math.hypot(pt.x-last.x,pt.y-last.y)>140){c.stroke();c.beginPath();c.moveTo(pt.x,pt.y)}
  else if(!last)c.moveTo(pt.x,pt.y);else c.lineTo(pt.x,pt.y);
  last=pt;
 }
 c.stroke();
}
function format(v,u){
 if(v===null||!Number.isFinite(v))return '—';
 return v.toFixed(Math.abs(v)<10?2:1)+' '+u;
}
function selected(){return [getLap($('vce-setup-lap')?.value),getLap($('vce-setup-reference')?.value)]}
function draw(){
 const canvas=$('vce-setup-map-canvas');if(!canvas)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 background(c,w,h);
 const [a,b]=selected(),ca=mapped(a),cb=mapped(b),both=ca.concat(cb);
 const status=$('vce-setup-map-status'),note=$('vce-setup-map-note');
 const progressFraction=Number($('vce-setup-scrub')?.value||50)/100,channel=$('vce-setup-channel')?.value||'time';
 $('vce-setup-progress').textContent=Math.round(progressFraction*100)+' % du tour';
 const current=profile(a,channel),baseline=profile(b,channel),at=interpolate(current,progressFraction),bt=interpolate(baseline,progressFraction);
 const timeA=profile(a,'time'),timeB=profile(b,'time');
 // Compute time since lap start, at the same genuine lap-progress position.
 const ta=interpolate(timeA,progressFraction),tb=interpolate(timeB,progressFraction);
 const startA=timeA.length?timeA[0].v:0,startB=timeB.length?timeB[0].v:0;
 const timeDelta=ta!==null&&tb!==null?(ta-startA)-(tb-startB):null;
 const u=unit[channel]||'';
 $('vce-setup-value-a').textContent=format(at,u);
 $('vce-setup-value-b').textContent=format(bt,u);
 const difference=at!==null&&bt!==null?at-bt:null;
 $('vce-setup-value-delta').textContent=difference===null?'—':(difference>0?'+':'')+format(difference,u);
 $('vce-setup-time-delta').textContent=timeDelta===null?'—':(timeDelta>0?'+':'')+format(timeDelta,'s');
 const time=channel==='time';
 const legend=canvas.parentNode.querySelector('.vce-map-legend');
 if(legend)legend.dataset.channel=time?'time':'mechanical';
 if(both.length<2){
  c.fillStyle='#a6bad4';c.font='20px Segoe UI';c.fillText('En attente des positions X / Z réelles',80,h/2);
  if(status)status.textContent='Carte : coordonnées indisponibles';
  if(note)note.textContent='La carte nécessite des positions X/Z mesurées. Les comparaisons de valeurs restent possibles si les deux tours possèdent leurs canaux.';
  return;
 }
 const xs=both.map(p=>p.x),ys=both.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const extentX=Math.max(1,maxX-minX),extentY=Math.max(1,maxY-minY);
 const scale=Math.min((w-86)/extentX,(h-76)/extentY);
 const offsetX=(w-extentX*scale)/2,offsetY=(h-extentY*scale)/2;
 const proj=p=>({x:offsetX+(p.x-minX)*scale,y:h-(offsetY+(p.y-minY)*scale)});
 drawPath(c,cb,proj,'#fb577c',3);drawPath(c,ca,proj,'#49a9f7',3.5);
 // Color each segment by the LOCAL change in time delta, not the cumulative delta.
 // Red = actual time lost in this interval; green = time recovered in this interval.
 if(timeA.length>1&&timeB.length>1&&ca.length>3){
  const stride=Math.max(1,Math.ceil(ca.length/3500));
  for(let i=stride;i<ca.length;i+=stride){
   const prev=ca[i-stride],point=ca[i];
   if(prev.p===null||point.p===null||point.p<=prev.p)continue;
   const a0=interpolate(timeA,prev.p),a1=interpolate(timeA,point.p);
   const b0=interpolate(timeB,prev.p),b1=interpolate(timeB,point.p);
   if(a0===null||a1===null||b0===null||b1===null)continue;
   const from=proj(prev),to=proj(point);
   if(Math.hypot(to.x-from.x,to.y-from.y)>90)continue;
   const localDelta=(a1-a0)-(b1-b0);
   c.beginPath();c.lineWidth=4.8;
   c.strokeStyle=localDelta>.014?'#fa526d':localDelta<-.014?'#35d0a0':'#7d9db9';
   c.globalAlpha=.94;c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();c.globalAlpha=1;
  }
 }
 const hasCompare=a&&b&&current.length>1&&baseline.length>1;
 if(!time&&hasCompare&&ca.length>3){
  const stride=Math.max(1,Math.round(ca.length/130));
  for(let i=stride;i<ca.length;i+=stride){
   const p=ca[i];if(p.p===null)continue;
   const v=interpolate(current,p.p),ref=interpolate(baseline,p.p);
   if(v===null||ref===null)continue;
   const d=v-ref,point=proj(p);
   c.beginPath();c.fillStyle=d>0?'#36d0ef':d<0?'#a78bfa':'#d4deec';
   c.arc(point.x,point.y,3.2,0,Math.PI*2);c.fill();
  }
 }
 const cursorPoint=ca.reduce((best,p)=>p.p===null?best:(!best||Math.abs(p.p-progressFraction)<Math.abs(best.p-progressFraction)?p:best),null);
 if(cursorPoint){const pt=proj(cursorPoint);c.fillStyle='#fff';c.strokeStyle='#ff5577';c.lineWidth=4;c.beginPath();c.arc(pt.x,pt.y,7,0,Math.PI*2);c.fill();c.stroke()}
 if(status)status.textContent=(a?.live?'DIRECT · ':'ARCHIVES · ')+ca.length+' positions A · '+cb.length+' positions B';
 if(note)note.textContent=(!a||!b)?'Sélectionne deux tours compatibles pour comparer leurs mesures.':
  !hasCompare?'Tracés disponibles, mais aucune comparaison de '+channel+' possible aux mêmes positions.':
  time?'Carte : les segments rouges/verts montrent où le delta chrono mesuré augmente ou diminue entre ces deux tours.':
       'Segmentation rouge/verte : gain ou perte chrono locale mesurée. Points cyan/violet : écart de '+($('vce-setup-channel')?.selectedOptions[0]?.text||channel)+' à progression égale. Aucun lien de causalité n’est supposé.';
}
function schedule(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;syncOptions();draw()})}
function receive(e){
 const p=e.detail||{},sid=p.session_id||'',lapNumber=n(p.lap_number);
 if(sid!==liveSession||lapNumber!==liveLap){liveSession=sid;liveLap=lapNumber;liveSamples=[]}
 const arr=Array.isArray(p.samples)?p.samples:[];
 for(const raw of arr){
  if(!numeric(raw.t))continue;
  const s={...raw,x:raw.world_x??raw.x,y:raw.world_z??raw.y,distance:raw.lap_pos??raw.distance};
  if(liveSamples.length&&+s.t<=+liveSamples.at(-1).t)continue;
  liveSamples.push(s);
 }
 profileCache.delete(liveSamples);
 if(liveSamples.length>6000)liveSamples.splice(0,liveSamples.length-6000);
 if(arr.length){
  const now=performance.now();
  if(now-lastLive>300){lastLive=now;schedule()}
 }
}
function init(){
 if(!$('vce-setup-map-canvas'))return;
 for(const id of ['vce-setup-lap','vce-setup-reference','vce-setup-channel','vce-setup-scrub'])$(id)?.addEventListener(id==='vce-setup-scrub'?'input':'change',schedule);
 document.getElementById('session')?.addEventListener('change',()=>{signature='';schedule()});
 document.addEventListener('vce-cloud-update',()=>{signature='';schedule()});
 document.addEventListener('vce-live-frame',receive);
 if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe($('vce-setup-map-canvas'));
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
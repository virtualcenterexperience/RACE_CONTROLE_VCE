/* VCE TRACK 3.5 — spatially faithful maps from real X/Z only.
 * Shared for archived Tour, Race Engineering and Live. No pseudo-GPS.
 */
(()=>{'use strict';
const isNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function pos(p){
 if(Array.isArray(p))return p.length>=2&&isNumber(p[0])&&isNumber(p[1])?[Number(p[0]),Number(p[1])]:null;
 if(!p||typeof p!=='object')return null;
 const x=p.x??p.world_x,z=p.y??p.world_z;
 return isNumber(x)&&isNumber(z)?[Number(x),Number(z)]:null;
}
function analyze(samples){
 const raw=Array.isArray(samples)?samples:[];
 const pairs=raw.map(pos),valid=pairs.filter(Boolean);
 if(valid.length<8)return {ok:false,reason:'Coordonnées X/Z insuffisantes',n:valid.length,segments:[],positions:pairs};
 let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
 for(const p of valid){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);zmin=Math.min(zmin,p[1]);zmax=Math.max(zmax,p[1])}
 if(xmax-xmin<3||zmax-zmin<3)return {ok:false,reason:zmax-zmin<3?'Axe Z constant : le jeu ne transmet pas un tracé 2D utilisable':'Axe X constant : position 2D indisponible',n:valid.length,spanX:xmax-xmin,spanZ:zmax-zmin,segments:[],positions:pairs};
 let steps=[],last=null;
 for(const p of pairs){if(!p){last=null;continue}if(last){const d=Math.hypot(p[0]-last[0],p[1]-last[1]);if(d>.02&&d<1000)steps.push(d)}last=p}
 steps.sort((a,b)=>a-b);
 const median=steps[Math.floor(steps.length/2)]||1;
 const jump=Math.max(75,Math.min(350,median*22));
 let segments=[],segment=[],lastPoint=null;
 const flush=()=>{if(segment.length>=5)segments.push(segment);segment=[]};
 for(let i=0;i<pairs.length;i++){
  const p=pairs[i];
  if(!p){flush();lastPoint=null;continue}
  if(lastPoint){
   const d=Math.hypot(p[0]-lastPoint[0],p[1]-lastPoint[1]);
   if(d<.02)continue;
   if(d>jump)flush();
  }
  segment.push({x:p[0],z:p[1],index:i});lastPoint=p
 }
 flush();
 segments=segments.filter(s=>s.length>=Math.max(5,Math.min(12,Math.ceil(valid.length*.005))));
 if(!segments.length)return {ok:false,reason:'Sauts de position : trajectoire incohérente',n:valid.length,segments:[],positions:pairs};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;
 for(const s of segments)for(const p of s){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);count++}
 if(maxX-minX<3||maxZ-minZ<3)return {ok:false,reason:'Tracé trop plat pour un circuit 2D',n:count,segments:[],positions:pairs};
 return {ok:true,n:count,segments,minX,maxX,minZ,maxZ,positions:pairs,reason:'',raw:raw.length};
}
function projection(all,w,h,pad=28){
 const a=all.filter(x=>x?.ok);
 if(!a.length)return null;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of a){minX=Math.min(minX,p.minX);maxX=Math.max(maxX,p.maxX);minZ=Math.min(minZ,p.minZ);maxZ=Math.max(maxZ,p.maxZ)}
 const scale=Math.min((w-pad*2)/Math.max(1,maxX-minX),(h-pad*2)/Math.max(1,maxZ-minZ));
 const midX=(minX+maxX)/2,midZ=(minZ+maxZ)/2;
 return (x,z)=>[w/2+(x-midX)*scale,h/2-(z-midZ)*scale];
}
function pathOf(item,to){
 let d='';
 for(const s of item.segments){
  s.forEach((p,i)=>{const q=to(p.x,p.z);d+=(i?'L':'M')+q[0].toFixed(2)+' '+q[1].toFixed(2)+' '});
 }
 return d.trim();
}
function last(item){const s=item?.segments?.at(-1);return s?.at(-1)||null}
function svg(el,samples,reference,options={}){
 const ns='http://www.w3.org/2000/svg',primary=analyze(samples),ref=analyze(reference);
 el.replaceChildren();el.setAttribute('viewBox','0 0 900 500');
 const project=projection([primary,ref],900,500);
 if(!project){const t=document.createElementNS(ns,'text');t.setAttribute('x','450');t.setAttribute('y','245');t.setAttribute('text-anchor','middle');t.setAttribute('fill','#9ab3cf');t.setAttribute('font-size','17');t.textContent='Tracé indisponible — '+primary.reason;el.append(t);return {ok:false,primary,ref}}
 const stroke=(item,color,width)=>{
  if(!item.ok)return;
  const p=document.createElementNS(ns,'path');p.setAttribute('d',pathOf(item,project));p.setAttribute('stroke',color);p.setAttribute('stroke-width',width);p.setAttribute('fill','none');p.setAttribute('stroke-linejoin','round');p.setAttribute('stroke-linecap','round');el.append(p)
 };
 stroke(ref,'#4d9dff',3.8);stroke(primary,'#ff951d',4.6);
 const end=last(primary);
 if(end){const [x,y]=project(end.x,end.z);const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','5.5');dot.setAttribute('fill','#ff5279');dot.setAttribute('stroke','#fff');dot.setAttribute('stroke-width','1.5');el.append(dot)}
 return {ok:primary.ok||ref.ok,primary,ref};
}
function canvas(el,samples,reference,options={}){
 const ctx=el.getContext('2d'),w=el.width,h=el.height;
 ctx.fillStyle=options.bg||'#091321';ctx.fillRect(0,0,w,h);
 const primary=analyze(samples),ref=analyze(reference);
 const project=projection([primary,ref],w,h,Math.min(28,w*.08,h*.12));
 if(!project){
  ctx.font='14px Segoe UI';ctx.fillStyle='#93aecb';
  ctx.fillText('Carte indisponible',20,Math.max(33,h*.43));
  ctx.font='12px Segoe UI';ctx.fillText(primary.reason.slice(0,90),20,Math.max(51,h*.43+22));
  return {ok:false,primary,ref}
 }
 const draw=(item,color,width)=>{
  if(!item.ok)return;
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  for(const segment of item.segments)segment.forEach((p,i)=>{const [x,y]=project(p.x,p.z);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
  ctx.stroke()
 };
 draw(ref,'#4d9dff',2.4);draw(primary,options.primaryColor||'#ff951d',3);
 const wanted=typeof options.progress==='number'&&options.progress>=0&&options.progress<=1?options.progress:1;
 const all=primary.segments.flat();
 const p=all[Math.max(0,Math.min(all.length-1,Math.floor(wanted*(all.length-1))))];
 if(p){const [x,y]=project(p.x,p.z);ctx.fillStyle='#ff5578';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill()}
 return {ok:primary.ok||ref.ok,primary,ref}
}
window.VCETrack35={analyze,svg,canvas};
})();

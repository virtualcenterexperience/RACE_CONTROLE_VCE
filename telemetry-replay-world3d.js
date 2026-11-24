/* VCE Replay World 3D - visual reconstruction from recorded XYZ/XY samples.
   Track width/terrain/car meshes are illustrative; NEVER a real circuit asset.
   Reverts to the existing 2D replay if WebGL or THREE cannot load. */
(async()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('vce-replay-canvas');if(!canvas)return;
const section=$('vce-replay');if(!section)return;
let THREE;
try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.js')}
catch(e){console.warn('VCE 3D: fallback canvas',e);return}
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}
catch(e){console.warn('VCE 3D: WebGL unavailable',e);return}
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.setSize(canvas.width,canvas.height,false);
renderer.domElement.style.cssText='width:100%;height:auto;aspect-ratio:1100/520;display:block;border-radius:7px;';
const wrapper=document.createElement('div');
wrapper.id='vce-replay-world3d';wrapper.setAttribute('role','img');
wrapper.setAttribute('aria-label','Reconstitution tridimensionnelle indicative du circuit et des trajectoires enregistrées');
canvas.before(wrapper);wrapper.append(renderer.domElement);
canvas.style.display='none';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x071019);scene.fog=new THREE.Fog(0x071019,450,1600);
const camera=new THREE.PerspectiveCamera(65,canvas.width/canvas.height,.2,12000);
scene.add(new THREE.HemisphereLight(0xd5e9ff,0x33553c,2));
const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(120,300,80);scene.add(sun);
const group=new THREE.Group();scene.add(group);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(15000,15000),new THREE.MeshLambertMaterial({color:0x294d2c}));
ground.rotation.x=-Math.PI/2;ground.position.y=-2.6;scene.add(ground);
function vehicle(color){
 const v=new THREE.Group();
 const paint=new THREE.MeshStandardMaterial({color,metalness:.55,roughness:.28});
 const dark=new THREE.MeshStandardMaterial({color:0x111820,roughness:.6});
 const glass=new THREE.MeshStandardMaterial({color:0x16334b,metalness:.65,roughness:.13});
 const shell=new THREE.Shape();shell.moveTo(-.65,-2.2);shell.lineTo(.65,-2.2);shell.quadraticCurveTo(1.03,-2.15,1.04,-1.6);
 shell.lineTo(1.04,1.45);shell.quadraticCurveTo(.95,2.18,.6,2.2);shell.lineTo(-.6,2.2);shell.quadraticCurveTo(-.95,2.18,-1.04,1.45);shell.lineTo(-1.04,-1.6);shell.quadraticCurveTo(-1.03,-2.15,-.65,-2.2);
 const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shell,{depth:.38,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.12,bevelThickness:.1}),paint);
 body.rotation.x=-Math.PI/2;body.position.y=.42;v.add(body);
 const part=(w,h,d,x,y,z,material,rx=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.x=rx;v.add(m);return m};
 part(1.5,.38,1.65,0,1.02,-.15,glass);part(1.46,.08,1.1,0,1.25,-.35,paint);
 part(1.42,.10,.70,0,1.05,.72,glass,-.45);
 part(1.85,.07,.3,0,.31,2.22,dark);part(1.95,.08,.35,0,1.12,-2.05,dark);
 for(const x of [-.65,.65])part(.07,.52,.08,x,.86,-1.98,dark);
 const tire=new THREE.MeshStandardMaterial({color:0x07090b,roughness:.92});
 const rim=new THREE.MeshStandardMaterial({color:0x969eaa,metalness:.85,roughness:.25});
 for(const x of [-1.02,1.02])for(const z of [-1.37,1.35]){
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.28,24),tire);t.rotation.z=Math.PI/2;t.position.set(x,.37,z);v.add(t);
  const r=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.29,12),rim);r.rotation.z=Math.PI/2;r.position.copy(t.position);v.add(r);
 }
 const white=new THREE.MeshStandardMaterial({color:0xe6f5ff,emissive:0xadcaff,emissiveIntensity:.7});
 const red=new THREE.MeshStandardMaterial({color:0xff2539,emissive:0xff1429,emissiveIntensity:.7});
 for(const x of [-.72,.72]){part(.43,.1,.06,x,.65,2.15,white);part(.48,.07,.06,x,.65,-2.15,red)}
 part(.12,.03,2.5,0,.87,.45,dark);
 group.add(v);return v
}
const primary=vehicle(0xff951d),other=vehicle(0x3f97ff);
const glow=()=>{
 const material=new THREE.MeshBasicMaterial({color:0xffd99c});
 const dot=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),material);return dot
};
let selectedKey='',primaryData=[],referenceData=[],center={x:0,z:0},size=150,roadMeshes=[];
let fixedAnchor=null;
let modeLive=false,liveFrames=[],liveSession='',liveLatest=null;
const direct=document.createElement('button');direct.type='button';direct.textContent='● Direct 3D';direct.id='vce-replay-live-toggle';
$('vce-replay-reload')?.after(direct);
// The trajectory is measured; the edge-to-edge width is NOT provided by AC telemetry.
// Manual geometry estimate is adjustable and explicitly labelled as such.
const widthLabel=document.createElement('label');
widthLabel.id='vce-replay-trackwidth-label';widthLabel.textContent='Couloir référence (estimé) : ';
widthLabel.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:9px;font-size:12px;color:#c6dcf2';
const widthSelect=document.createElement('select');widthSelect.id='vce-replay-trackwidth';
for(const n of [6,8,10,12,14,16,18,20,24,30]){
 const opt=document.createElement('option');opt.value=String(n);opt.textContent=n+' m';widthSelect.append(opt)
}
const corridor=document.createElement('input');corridor.type='checkbox';corridor.id='vce-reference-corridor';corridor.setAttribute('aria-label','Afficher le couloir indicatif autour de la référence');widthLabel.append(corridor);
corridor.onchange=()=>{selectedKey=''};
widthSelect.value='12';widthSelect.title='Largeur totale indicative : non mesurée par les coordonnées du pilote';
widthSelect.style.cssText='background:#14253b;border:1px solid #54738f;border-radius:5px;color:#f3f9ff;padding:6px';
widthLabel.append(widthSelect);direct.after(widthLabel);
widthSelect.addEventListener('change',()=>{selectedKey=''});
direct.onclick=()=>{
 modeLive=!modeLive;direct.textContent=modeLive?'● Direct 3D ACTIF':'● Direct 3D';
 direct.style.background=modeLive?'#7e2947':'';
 selectedKey='';
};
document.addEventListener('vce-live-frame',event=>{
 const frame=event.detail||{};
 if(frame.session_id!==liveSession){liveSession=frame.session_id||'';liveFrames=[];liveLatest=null}
 const incoming=Array.isArray(frame.samples)?frame.samples:[];
 for(const p of incoming){
  const x=numeric(p.world_x),z=numeric(p.world_z),t=numeric(p.t);
  if(x===null||z===null||t===null)continue;
  if(liveFrames.length&&t<=liveFrames.at(-1).absolute)continue;
  liveFrames.push({x,z,height:0,absolute:t,t:0});
  if(liveFrames.length>2400)liveFrames.shift();
  liveLatest=t;
 }
 if(liveFrames.length){
  const origin=liveFrames[0].absolute;
  for(const p of liveFrames)p.t=p.absolute-origin;
 }
 if(modeLive&&liveFrames.length>2&&liveFrames.length%40===0)selectedKey='';
});
function numeric(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?+v:null}
function samplesFor(lap){
 const raw=Array.isArray(lap?.samples)?lap.samples:[];
 const start=raw.length?numeric(raw[0].t):null;
 return raw.map((p,i)=>({x:numeric(p.x),z:numeric(p.y),height:numeric(p.z)||0,
   t:numeric(p.t)??i/Math.max(1,raw.length-1)*(numeric(lap?.time)||90)}))
 .filter(p=>p.x!==null&&p.z!==null).sort((a,b)=>a.t-b.t)
}
function getSelected(){
 const s=window.vceSession,laps=(s?.laps||[]).filter(l=>l&&((+l.time>0)||l.samples?.length>=2||Number.isInteger(l.number)))
   .slice().sort((a,b)=>(a.number??0)-(b.number??0));
 const a=laps[+($('lap')?.value||0)];
 const b=$('reference')?.value==='external'?window.VCEexternalReferenceLap?.lap:laps[+($('reference')?.value||0)];
 return {a,b,key:[s?.id,$('lap')?.value,$('reference')?.value,
   window.VCEexternalReferenceLap?.pilot,laps.length,a?.samples?.length,b?.samples?.length].join(':')}
}
function dispose(){
 while(group.children.length>2){
  const obj=group.children[2];group.remove(obj);
  obj.geometry?.dispose();obj.material?.dispose()
 }
}
function polyline(data,color,radius=.13){
 if(data.length<2)return;
 const points=data.map(p=>new THREE.Vector3(p.x-center.x,.22+p.height,p.z-center.z));
 const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color}));
 group.add(m)
}
function road(data){
 if(data.length<3)return;
 const stride=Math.max(1,Math.ceil(data.length/950));
 const pts=data.filter((_,i)=>i%stride===0);
 if(pts.at(-1)!==data.at(-1))pts.push(data.at(-1));
 const verts=[],uv=[],indices=[];
 const width=Math.max(6,Math.min(30,Number(widthSelect.value)||12)); // total EDGE-TO-EDGE width, manually estimated
 for(let i=0;i<pts.length;i++){
  const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
  const nx=-dz/len,nz=dx/len;
  for(const side of [-1,1]){verts.push(p.x-center.x+nx*width*.5*side,p.height,p.z-center.z+nz*width*.5*side);
    uv.push((side+1)/2,i/16)}
  if(i){const k=2*i;indices.push(k-2,k-1,k,k-1,k+1,k)}
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x161a20,roughness:.94,side:THREE.DoubleSide}));
 group.add(m);
 const edge=side=>{
  const line=pts.map((p,i)=>{
   const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
   return new THREE.Vector3(p.x-center.x+(-dz/len)*width*.5*side,p.height+.06,p.z-center.z+(dx/len)*width*.5*side)
  });
  const curve=new THREE.CatmullRomCurve3(line);
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.min(1000,pts.length),.11,4,false),
    new THREE.MeshBasicMaterial({color:0xe3e8ed}));group.add(mesh)
 };
 edge(-1);edge(1);
}
function rebuild(){
 const chosen=getSelected();
 const directEnabled=modeLive&&liveFrames.length>=3;
 const key=chosen.key+':'+(directEnabled?liveSession+':'+Math.floor(liveFrames.length/40):'recorded');
 if(key===selectedKey)return;
 selectedKey=key;fixedAnchor=null;
 primaryData=directEnabled?liveFrames.slice():samplesFor(chosen.a);
 referenceData=samplesFor(chosen.b);
 dispose();
 // The track analyzer expects {x,y} whereas 3D world samples use {x,z}.
 // Map world Z explicitly; otherwise every 3D trace is rejected as missing XY.
 const quality=window.VCETrack35?.analyze(primaryData.map(p=>({x:p.x,y:p.z})));
 const refQuality=window.VCETrack35?.analyze(referenceData.map(p=>({x:p.x,y:p.z})));
 // Disable fake, distorted 3D roads for sessions with missing/flat world coordinates.
 if(!quality?.ok){
  wrapper.style.display='none';canvas.style.display='block';
  const warning=$('vce-replay-world-note');
  if(warning)warning.textContent='Replay 3D indisponible : '+(quality?.reason||'coordonnées X/Z absentes')+'. Reviens à la carte 2D ou sélectionne un autre tour.';
  return;
 }
 wrapper.style.display='block';canvas.style.display='none';
 const cleaned=quality.segments.map(segment=>segment.map(p=>primaryData[p.index]))
    .filter(segment=>segment.length>=5);
 const refCleaned=refQuality?.ok?
   refQuality.segments.map(segment=>segment.map(p=>referenceData[p.index])).filter(segment=>segment.length>=5):[];
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const segment of [...cleaned,...refCleaned])for(const p of segment){
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
  minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)
 }
 center={x:(minX+maxX)/2,z:(minZ+maxZ)/2};
 size=Math.max(75,maxX-minX,maxZ-minZ);
 // Never build a road centered on the evaluated driver's line.
 const independent=chosen.b&&chosen.b!==chosen.a&&refCleaned.length;
 corridor.disabled=!independent;
 if(corridor.checked&&independent)for(const part of refCleaned)road(part);
 for(const section of cleaned)polyline(section,0xff951d,.33);
 for(const section of refCleaned)polyline(section,0x49a1ff,.15);
 const message=$('vce-replay-world-note');
 if(message)message.textContent='Coordonnées mesurées : orange pilote, bleu référence. Limites et point de corde réels non fournis. '+(corridor.checked&&independent?'Couloir indicatif autour de la référence, pas les bords réels.':'Aucune route centrée artificiellement sur le pilote.');
}
function locate(data,time){
 if(!data.length)return null;
 if(time<=data[0].t)return data[0];
 if(time>=data.at(-1).t)return data.at(-1);
 let lo=0,hi=data.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(data[m].t<time)lo=m;else hi=m}
 const a=data[lo],b=data[hi];
 if(b.t-a.t>.5||Math.hypot(b.x-a.x,b.z-a.z)>100)return null;
 const f=(time-a.t)/Math.max(.001,b.t-a.t);
 return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,height:a.height+(b.height-a.height)*f}
}
function animate(){
 requestAnimationFrame(animate);
 rebuild();
 if(!primaryData.length||wrapper.style.display==='none')return;
 const duration=Math.max(primaryData.at(-1)?.t||0,referenceData.at(-1)?.t||0,1);
 const time=modeLive&&liveFrames.length>=3?primaryData.at(-1).t:
 duration*(+($('vce-replay-slider')?.value||0)/1000);
 const liveMode=modeLive&&liveFrames.length>=3;
 const p=liveMode?liveFrames.at(-1):locate(primaryData,time);
 const next=liveMode?(liveFrames.at(-2)||p):locate(primaryData,Math.min(duration,time+.35));
 const q=locate(referenceData,time);
 if(!p||!next){primary.visible=false;other.visible=false;renderer.render(scene,camera);return;}
 const yaw=liveMode?Math.atan2(p.x-next.x,p.z-next.z):Math.atan2(next.x-p.x,next.z-p.z);
 const angle=Number.isFinite(yaw)?yaw:0;
 primary.position.set(p.x-center.x,p.height,p.z-center.z);
 primary.rotation.y=angle;
 primary.visible=true;
 other.visible=!!q;
 if(q){other.position.set(q.x-center.x,q.height,q.z-center.z);
   const n=locate(referenceData,Math.min(duration,time+.35));
   other.rotation.y=n?Math.atan2(n.x-q.x,n.z-q.z):0}
 const mode=$('vce-replay-camera')?.value||'chase';
 const zoom=Math.max(1,+($('vce-replay-zoom')?.value||3));
 const distance=(mode==='overview'?Math.max(110,size*.8):mode==='top'?Math.max(55,size*.48):Math.max(9,35/Math.sqrt(zoom)));
 const dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
 const pos=new THREE.Vector3(p.x-center.x,p.height,p.z-center.z);
 if(mode==='trackside'){
  // Fixed world camera: the car moves across the frame, including lateral errors.
  if(!fixedAnchor||Math.hypot(pos.x-fixedAnchor.x,pos.z-fixedAnchor.z)>80)fixedAnchor=pos.clone();
  camera.position.copy(fixedAnchor).add(new THREE.Vector3(35,Math.max(26,65/Math.sqrt(zoom)),40));
  camera.lookAt(fixedAnchor);
 }
 else if(mode==='top'){
  const height=size*.6/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));
  camera.position.set(0,Math.max(30,height/Math.sqrt(zoom)),.1);
  camera.lookAt(0,0,0);
 }
 else if(mode==='overview'){camera.position.set(size*.65,size*.65,size*.65);camera.lookAt(0,0,0)}
 else if(mode==='cockpit'){camera.position.copy(pos).add(new THREE.Vector3(0,1.55,0)).addScaledVector(dir,.65);
   camera.lookAt(pos.clone().addScaledVector(dir,38).add(new THREE.Vector3(0,1.3,0)));primary.visible=false}
 else{camera.position.copy(pos).add(new THREE.Vector3(0,Math.max(6,19/Math.sqrt(zoom)),0))
   .addScaledVector(dir,-distance);
   camera.lookAt(pos.clone().addScaledVector(dir,9))}
 renderer.render(scene,camera);
}
const note=document.createElement('p');note.id='vce-replay-world-note';note.className='muted';
note.textContent='Modèle 3D indicatif basé sur les données enregistrées, pas sur les fichiers du circuit.';
wrapper.after(note);
const grid=new THREE.GridHelper(10000,1000,0x49705a,0x30533c);grid.position.y=-.1;scene.add(grid);
$('vce-replay-camera')?.addEventListener('change',()=>{fixedAnchor=null});
['lap','reference','session'].forEach(id=>$(id)?.addEventListener('change',()=>{selectedKey=''}));
document.addEventListener('vce-cloud-update',()=>{selectedKey=''});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)selectedKey=''});
animate();
})();
/* VCE LIVE 3.0. Native capture ~20Hz, network 5 batches/s, 60fps canvas animation.
   Real measurements are never invented. Private Supabase Realtime only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const W=()=>window.VCE_SUPABASE||{};
const state={client:null,channel:null,device:'',session:'',authorized:false,
  lastFrame:0,buffer:[],live:null,hud:null,lastUi:0,lastDraw:0,raf:0,status:'DÉCONNECTÉ',
  lastCloudPoll:0,points:[],started:0,fail:''};
const num=x=>typeof x==='number'&&Number.isFinite(x);
const st=(msg,ok=false)=>{const el=$('vce-stream-state');if(el){el.textContent=msg;el.dataset.ok=ok?'yes':'no'}};
const v=(name,label)=>{const span=document.createElement('span');span.textContent=label;span.id=name;return span};
function addUI(){
 const root=$('vce-cloud-connect')||document.querySelector('main');
 if(!root)return;
 const box=document.createElement('section');box.id='vce-stream';box.className='panel vce-stream';
 box.innerHTML='<div class="head"><h2>● TÉLÉMÉTRIE EN DIRECT</h2><span id="vce-stream-state">CONNEXION…</span></div><p class="muted">Rendu 60 FPS · mesures natives selon le jeu · transmission via canal privé. Les graphes montrent les dernières secondes de roulage.</p>';
 const hud=document.createElement('div');hud.id='vce-live-hud';
 for(const [key,label] of [['track','CIRCUIT'],['car','VOITURE'],['lap','TOUR'],['progress','POSITION PISTE'],
  ['speed','VITESSE'],['brake','FREIN'],['throttle','ACCÉLÉRATEUR'],['gear','RAPPORT'],['rpm','RÉGIME']]){
  const item=document.createElement('div');item.className='vce-live-value';
  const title=document.createElement('small');title.textContent=label;
  const value=document.createElement('strong');value.id='vce-live-'+key;value.textContent='—';item.append(title,value);hud.append(item);
 }box.append(hud);
 const canvas=document.createElement('canvas');canvas.id='vce-stream-plot';canvas.width=1200;canvas.height=260;box.append(canvas);
 const mapHeader=document.createElement('div');mapHeader.className='head';mapHeader.innerHTML='<h2>POSITION SUR LE CIRCUIT</h2><span>GPS jeu / progression</span>';
 box.append(mapHeader);
 const m=document.createElement('canvas');m.width=720;m.height=260;m.id='vce-stream-track';box.append(m);
 const cap=document.createElement('p');cap.id='vce-stream-caption';cap.className='muted';cap.textContent='Circuit détecté automatiquement · coordonnées en attente';box.append(cap);
 root.after(box);
}
const updateSession=async()=>{
 const s=window.vceSession,device=s?.device_id;
 if(!s||!device){st('AUCUNE SESSION / AUCUN PC ASSOCIÉ');return;}
 if(state.device===device&&state.channel)return;
 if(!window.supabase?.createClient){st('BIBLIOTHÈQUE REALTIME ABSENTE');return}
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token){st('CONNEXION PILOTE OU STAFF REQUISE');return}
 if(state.channel)try{await state.client.removeChannel(state.channel)}catch{}
 if(!state.client)state.client=window.supabase.createClient(W().url,W().key,{auth:{persistSession:false,autoRefreshToken:false}});
 state.client.realtime.setAuth(session.access_token);
 state.device=device;
 state.channel=state.client.channel('vce:device:'+device,{config:{private:true}})
 .on('broadcast',{event:'frame'},message=>{
    const p=message.payload||{};if(p.device_id!==state.device)return;
    state.lastFrame=Date.now();state.session=p.session_id;state.live=p;
    document.dispatchEvent(new CustomEvent('vce-live-frame',{detail:p}));
    const samples=(p.samples||[]).filter(x=>num(x.t)).slice(-12);
    for(const s of samples){
      if(!state.buffer.length||s.t>state.buffer.at(-1).t){
       state.buffer.push(s);if(state.buffer.length>600)state.buffer.shift();
      }
      if(num(s.world_x)&&num(s.world_z)){
        state.points.push([s.world_x,s.world_z]);
        if(state.points.length>2000)state.points.shift();
      }
    }
    if(samples.length){
      const latest=samples.at(-1);
      state.hud=latest;
    }
    if(p.track){const t=$('vce-live-track');if(t)t.textContent=p.track}
    if(p.car){const c=$('vce-live-car');if(c)c.textContent=p.car}
    st('● FLUX CONNECTÉ · '+samples.length+' ÉCHANTILLONS',true)
 })
 .subscribe(status=>{
    state.status=status;
    if(status==='SUBSCRIBED')st('● EN ATTENTE DE SESSION',true);
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')st('ERREUR CANAL PRIVÉ · VÉRIFIER LES POLICIES SUPABASE');
 });
};
function mainPlot(ts){
 const canvas=$('vce-stream-plot');if(!canvas)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.clearRect(0,0,w,h);c.fillStyle='#0a1523';c.fillRect(0,0,w,h);
 const data=state.buffer,last=data.at(-1),first=data[0];
 const xmax=(last?.t||0)+Math.min(1,Math.max(0,(Date.now()-state.lastFrame)/1000)), xmin=xmax-15;
 for(let i=0;i<=5;i++){c.strokeStyle='#243b54';c.lineWidth=1;c.beginPath();c.moveTo(35,15+i*42);c.lineTo(w-20,15+i*42);c.stroke()}
 if(!last||!first)return;
 const channels=[
  {key:'speed_kmh',label:'VITESSE',color:'#ff8c20',scale:300},
  {key:'brake',label:'FREIN',color:'#4d9dff',scale:1},
  {key:'throttle',label:'ACCÉLÉRATEUR',color:'#ff8c20',scale:1}
 ];
 const xp=t=>35+Math.max(0,Math.min(1,(t-xmin)/15))*(w-55);
 for(const [j,item] of channels.entries()){
  c.strokeStyle=item.color;c.lineWidth=2.5;c.beginPath();let started=false;
  for(const sample of data){
   const val=sample[item.key];if(!num(sample.t)||sample.t<xmin||!num(val))continue;
   const x=xp(sample.t),y=225-Math.max(0,Math.min(1,val/item.scale))*200;
   if(started)c.lineTo(x,y);else{c.moveTo(x,y);started=true}
  }if(started)c.stroke();
  c.fillStyle=item.color;c.font='bold 15px Segoe UI';c.fillText(item.label,45+j*175,245);
 }
}
function trackPlot(){
 const canvas=$('vce-stream-track');if(!canvas)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);
 c.fillStyle='#0b1828';c.fillRect(0,0,w,h);
 const pts=state.points;
 const last=state.hud;
 if(pts.length<5){
  c.fillStyle='#93aecb';c.font='16px Segoe UI';
  const prog=num(last?.lap_pos)?(last.lap_pos*100).toFixed(1)+' %':'non disponible';
  c.fillText('Progression sur le circuit : '+prog,25,70);
  c.fillStyle='#29425f';c.fillRect(25,110,w-50,18);
  if(num(last?.lap_pos)){c.fillStyle='#48cafa';c.fillRect(25,110,(w-50)*Math.max(0,Math.min(1,last.lap_pos)),18)}
  $('vce-stream-caption').textContent='Coordonnées XY du jeu non disponibles · position en % de tour';
  return;
 }
 // Compute bounds from native world coordinates, not an invented circuit map.
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const size=Math.max(1,maxx-minx,maxy-miny);
 const point=p=>[w/2+(p[0]-(minx+maxx)/2)/size*(w-65),h/2+(p[1]-(miny+maxy)/2)/size*(h-45)];
 c.strokeStyle='#5588c1';c.lineWidth=3;c.beginPath();pts.forEach((p,i)=>{const [x,y]=point(p);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();
 const [x,y]=point(pts.at(-1));c.fillStyle='#ffb95f';c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fill();
 $('vce-stream-caption').textContent='Tracé construit uniquement avec les coordonnées réelles reçues du jeu';
}
function hud(ts){
 if(ts-state.lastUi<70)return;state.lastUi=ts;
 const s=state.hud;
 if(!s)return;
 const set=(key,text)=>{const e=$('vce-live-'+key);if(e)e.textContent=text};
 set('lap',num(state.live?.lap_number)?String(state.live.lap_number+1):'—');
 set('progress',num(s.lap_pos)?(s.lap_pos*100).toFixed(1)+' %':'—');
 set('speed',num(s.speed_kmh)?s.speed_kmh.toFixed(1)+' km/h':'—');
 set('brake',num(s.brake)?(s.brake*100).toFixed(1)+' %':'—');
 set('throttle',num(s.throttle)?(s.throttle*100).toFixed(1)+' %':'—');
 set('gear',num(s.gear)?String(s.gear):'—');set('rpm',num(s.rpm)?String(Math.round(s.rpm)):'—');
 if(Date.now()-state.lastFrame>2500&&state.lastFrame)st('FLUX INTERROMPU · DERNIÈRE TRAME '+Math.round((Date.now()-state.lastFrame)/1000)+' s','warn');
}
function render(ts){
 // 60 FPS is the target browser rendering cadence, NOT an invented 60Hz sensor frequency.
 mainPlot(ts);trackPlot();hud(ts);
 state.raf=requestAnimationFrame(render);
}
function start(){
 addUI();render(0);
 document.addEventListener('vce-cloud-update',()=>updateSession().catch(e=>st('REALTIME : '+e.message)));
 const token=window.VCESupabase?.validSession();
 Promise.resolve(token).then(()=>updateSession()).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
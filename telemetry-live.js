/* VCE LIVE 3.5. Native capture rate determined by game, network batches, browser rendering at 60fps.
   Real measurements are never invented. Private Supabase Realtime only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const W=()=>window.VCE_SUPABASE||{};
const state={client:null,channel:null,device:'',session:'',authorized:false,
  lastFrame:0,buffer:[],live:null,hud:null,lastUi:0,lastDraw:0,lastChart:0,refKey:'',refData:null,raf:0,status:'DÉCONNECTÉ',
  lastCloudPoll:0,points:[],lapPoints:[],lapNumber:null,trackName:'',started:0,fail:'',displayEnabled:true,frames:0,lastSampleTime:null};
const num=x=>typeof x==='number'&&Number.isFinite(x);
const st=(msg,ok=false)=>{const el=$('vce-stream-state');if(el){el.textContent=msg;el.dataset.ok=ok?'yes':'no'}};
const v=(name,label)=>{const span=document.createElement('span');span.textContent=label;span.id=name;return span};
function addUI(){
 const root=$('vce-cloud-connect')||document.querySelector('main');
 if(!root)return;
 const box=document.createElement('section');box.id='vce-stream';box.className='panel vce-stream';
 box.innerHTML='<div class="head"><h2>● TÉLÉMÉTRIE EN DIRECT</h2><span id="vce-stream-state">CONNEXION…</span></div><p class="muted">Affichage jusqu’à 30 échantillons par lot · rendu 60 FPS · mesures natives selon le jeu · transmission via canal privé. Les graphes montrent les dernières secondes de roulage.</p>';
 const hud=document.createElement('div');hud.id='vce-live-hud';
 for(const [key,label] of [['track','CIRCUIT'],['car','VOITURE'],['lap','TOUR'],['progress','POSITION PISTE'],
  ['speed','VITESSE'],['brake','FREIN'],['throttle','ACCÉLÉRATEUR'],['gear','RAPPORT'],['rpm','RÉGIME']]){
  const item=document.createElement('div');item.className='vce-live-value';
  const title=document.createElement('small');title.textContent=label;
  const value=document.createElement('strong');value.id='vce-live-'+key;value.textContent='—';item.append(title,value);hud.append(item);
 }box.append(hud);
 const canvas=document.createElement('canvas');canvas.id='vce-stream-plot';canvas.width=1200;canvas.height=260;box.append(canvas);
 const mapHeader=document.createElement('div');mapHeader.className='head';mapHeader.innerHTML='<h2>CARTE & TRAJECTOIRE EN DIRECT</h2><span id="vce-map-live-state">Positions X/Z en attente</span>';
 box.append(mapHeader);
 const m=document.createElement('canvas');m.width=720;m.height=260;m.id='vce-stream-track';box.append(m);
 const cap=document.createElement('p');cap.id='vce-stream-caption';cap.className='muted';cap.textContent='Circuit détecté automatiquement · coordonnées en attente';box.append(cap);
 const control=document.createElement('button');control.type='button';control.id='vce-live-toggle';control.textContent='● DIRECT ON';
 control.setAttribute('aria-pressed','true');control.style.margin='10px 0';
 control.onclick=()=>{state.displayEnabled=!state.displayEnabled;control.textContent=state.displayEnabled?'● DIRECT ON':'○ DIRECT OFF';control.setAttribute('aria-pressed',String(state.displayEnabled));};
 box.insertBefore(control,hud);
 const quality=document.createElement('p');quality.id='vce-live-quality';quality.className='muted';quality.textContent='Qualité du flux : en attente des échantillons';
 box.append(quality);
 root.after(box);
}
const updateSession=async()=>{
 const s=window.vceSession,device=s?.device_id;
 if(!s||!device){st('AUCUNE SESSION / AUCUN PC ASSOCIÉ');return;}
 if(state.device===device&&state.session===s.id&&state.channel&&state.status!=='CHANNEL_ERROR'&&state.status!=='TIMED_OUT')return;
 if(!window.supabase?.createClient){st('BIBLIOTHÈQUE REALTIME ABSENTE');return}
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token){st('CONNEXION PILOTE OU STAFF REQUISE');return}
 if(state.channel)try{await state.client.removeChannel(state.channel)}catch{}
 state.channel=null;
 if(!state.client)state.client=window.supabase.createClient(W().url,W().key,{auth:{persistSession:false,autoRefreshToken:false}});
 state.client.realtime.setAuth(session.access_token);
 state.device=device;state.session=s.id;state.buffer=[];state.points=[];state.lapPoints=[];state.lapNumber=null;state.lastSampleTime=null;state.trackName=s.track||'';state.lastFrame=0;state.refKey='';
 state.channel=state.client.channel('vce:device:'+device,{config:{private:true}})
 .on('broadcast',{event:'frame'},message=>{
    const p=message.payload||{};if(p.device_id!==state.device)return;
    if(state.session&&p.session_id&&state.session!==p.session_id){state.buffer=[];state.points=[];state.lapPoints=[];state.lapNumber=null;state.hud=null;state.lastSampleTime=null;state.frames=0;}
    state.lastFrame=Date.now();state.session=p.session_id||state.session;state.live=p;
    if(typeof p.track==='string'&&p.track.trim())state.trackName=p.track.trim();
    if(Number.isInteger(p.lap_number)&&state.lapNumber!==p.lap_number){state.lapPoints=[];state.lapNumber=p.lap_number;}
    
    const samples=(Array.isArray(p.samples)?p.samples:[]).filter(x=>num(x.t)).sort((a,b)=>a.t-b.t);
    state.frames++;
    for(const sample of samples){
      if(state.lastSampleTime!==null&&sample.t<state.lastSampleTime-1){
        state.buffer=[];state.lastSampleTime=null;
      }
      if(state.lastSampleTime!==null&&sample.t<=state.lastSampleTime)continue;
      state.lastSampleTime=sample.t;
      state.buffer.push(sample);
      if(state.buffer.length>3000)state.buffer.splice(0,state.buffer.length-3000);
      // Zero is a valid world coordinate. Reject duplicates, not coordinate zero.
      if(num(sample.world_x)&&num(sample.world_z)){
        const x=sample.world_x,z=sample.world_z,last=state.points.findLast(v=>v!==null);
        if(!last||Math.hypot(x-last[0],z-last[1])>.02){
          // An isolated huge discontinuity is not a real drivable trajectory.
          if(last&&Math.hypot(x-last[0],z-last[1])>=500){state.points.push(null);state.lapPoints.push(null)}
            state.points.push([x,z]);if(state.points.length>16000)state.points.shift();
            state.lapPoints.push([x,z]);if(state.lapPoints.length>5500)state.lapPoints.shift();
          }
        }
      }
    const quality=$('vce-live-quality');
    if(quality)quality.textContent='Flux reçu : '+state.buffer.length+' échantillons · '+state.frames+' trames · '+state.points.length+' positions XY distinctes';
    if(samples.length){
      state.hud=samples.at(-1);
      const selected=window.vceSession;
      // The cockpit and live graph show the same real measured values.
      if(selected&&(!p.session_id||selected.id===p.session_id)){
        const raw=state.hud;
        selected.live={...(selected.live||{}),active:true,
          lap:p.lap_number??selected.live?.lap,
          sample:{...raw,speed:raw.speed_kmh??raw.speed,steering:raw.steering??raw.steer}};
      }
    }
    document.dispatchEvent(new CustomEvent('vce-live-frame',{detail:p}));
    if(state.trackName){const t=$('vce-live-track');if(t)t.textContent=state.trackName}
    if(p.car){const c=$('vce-live-car');if(c)c.textContent=p.car}
    st('● FLUX CONNECTÉ · '+samples.length+' ÉCHANTILLONS',true)
 })
 .subscribe(status=>{
    state.status=status;
    if(status==='SUBSCRIBED')st('● CANAL CONNECTÉ · EN ATTENTE DE TRAMES',true);
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')st('ERREUR CANAL PRIVÉ · VÉRIFIER LES POLICIES SUPABASE');
 });
};
function mainPlot(){
 const canvas=$('vce-stream-plot');if(!canvas)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.fillStyle='#0a1523';c.fillRect(0,0,w,h);
 const data=state.buffer,last=data.at(-1);
 const xmin=last?last.t-15:0;
 const left=58,right=w-25,top=14,bottom=h-32,inner=bottom-top;
 const channels=[
  {key:'throttle',label:'ACCÉLÉRATEUR',color:'#22c55e',max:1},
  {key:'brake',label:'FREIN',color:'#ef4444',max:1},
  {key:'speed_kmh',label:'VITESSE km/h',color:'#7c8aff',max:Math.max(100,Math.ceil(Math.max(...data.slice(-600).map(x=>num(x.speed_kmh)?x.speed_kmh:0))/50)*50)}
 ];
 c.font='12px Segoe UI';c.fillStyle='#a4b9d4';
 for(let i=0;i<=4;i++){
  const y=top+inner*i/4;
  c.strokeStyle='#28394e';c.lineWidth=1;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();
  if(i<4)c.fillText(String(100-i*25)+'%',4,y+4);
 }
 if(!last){c.fillText('En attente des mesures en direct',left,40);return}
 const xOf=t=>left+(t-xmin)/15*(right-left);
 for(const item of channels){
  c.lineWidth=2.6;c.strokeStyle=item.color;c.beginPath();
  let active=false,previous=null;
  for(const point of data){
   if(!num(point.t)||point.t<xmin||point.t>last.t)continue;
   const value=point[item.key];
   if(!num(value)){active=false;continue}
   const x=xOf(point.t),y=bottom-Math.max(0,Math.min(1,value/item.max))*inner;
   if(!active||previous!==null&&point.t-previous>.35)c.moveTo(x,y);
   else c.lineTo(x,y);
   active=true;previous=point.t;
  }
  c.stroke();
 }
 channels.forEach((item,i)=>{c.fillStyle=item.color;c.fillText(item.label+(item.key==='speed_kmh'?' (0–'+item.max+')':''),left+i*260,h-9)});
 c.fillStyle='#a4b9d4';c.fillText('Fenêtre : dernières 15 secondes · 0 % en bas, 100 % en haut',left,top+12);
}
function trackPlot(ts){
 if(ts-state.lastDraw<(state.lastFrame&&Date.now()-state.lastFrame<3000?260:2000))return;
 state.lastDraw=ts;
 const canvas=$('vce-stream-track');
 if(!canvas||!window.VCETrack35)return;
 const session=window.vceSession;
 const laps=Array.isArray(session?.laps)?session.laps:[];
 const refKey=(session?.id||'')+'|'+laps.map(l=>(l.number??'')+':'+(l.samples?.length||0)).join(',');
 if(refKey!==state.refKey){
  let reference=null,refCount=0;
  for(const lap of laps){
   const arr=Array.isArray(lap.samples)?lap.samples:[];
   if(arr.length<=refCount)continue;
   const candidate=window.VCETrack35.analyze(arr);
   if(candidate.ok){reference=arr;refCount=arr.length}
  }
  state.refData=reference;state.refKey=refKey;
 }
 const reference=state.refData;
 const current=state.lapPoints||[];
 const result=window.VCETrack35.canvas(canvas,current,reference||[],{
  primaryColor:'#ffad59',progress:1
 });
 const mapState=$('vce-map-live-state');if(mapState)mapState.textContent=state.trackName?(state.trackName+' · '+(result.primary.ok?'positions X/Z reçues':'tracé en acquisition')):'Nom du circuit non transmis';
 const caption=$('vce-stream-caption');
 if(!caption)return;
 if(result.primary.ok)caption.textContent='Orange : trajectoire du tour en cours ('+result.primary.n+' positions X/Z) · bleu : tour enregistré · cadrage réel.';
 else if(result.ref.ok)caption.textContent='DIRECT : '+result.primary.reason+'. Circuit de la séance enregistré affiché en bleu.';
 else caption.textContent='Carte en construction : '+result.primary.reason+'. Le jeu doit transmettre X ET Z, pas seulement la progression du tour.';
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
 if(Date.now()-state.lastFrame>2500&&state.lastFrame)st('FLUX INTERROMPU · DERNIÈRE TRAME '+Math.round((Date.now()-state.lastFrame)/1000)+' s');
}
function render(ts){
 // 60 FPS is the target browser rendering cadence, NOT an invented 60Hz sensor frequency.
 if(state.displayEnabled&&!document.hidden){
  const cadence=state.lastFrame&&Date.now()-state.lastFrame<3000?110:1500;
  if(ts-state.lastChart>cadence){state.lastChart=ts;mainPlot(ts)}
  trackPlot(ts);hud(ts);
 }
  if(state.lastFrame&&Date.now()-state.lastFrame>5000){
   if(window.vceSession?.id===state.session&&window.vceSession?.live)window.vceSession.live.active=false;
   st('● CANAL CONNECTÉ · AUCUNE TRAME DEPUIS '+Math.round((Date.now()-state.lastFrame)/1000)+' s');
  }
 state.raf=requestAnimationFrame(render);
}
function start(){
 addUI();render(0);
 document.addEventListener('vce-cloud-update',()=>{state.refKey='';updateSession().catch(e=>st('REALTIME : '+e.message))});
 const token=window.VCESupabase?.validSession();
 Promise.resolve(token).then(()=>updateSession()).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
/* VCE Telemetry Cloud — sessions fetched only after verified Supabase Auth.
   The pilot slug in the URL is a filter for STAFF, NEVER an authorization token. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const app={poll:null,busy:false,lastKey:'',loginOpen:false};
const cfg=()=>window.VCE_SUPABASE||{};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const requested=()=>slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''));
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const round=(n,p=3)=>valid(n)?+n.toFixed(p):null;
const el=(tag,cls,txt)=>{const o=document.createElement(tag);if(cls)o.className=cls;if(txt!==undefined)o.textContent=txt;return o};
function banner(message,kind='info'){
 const node=$('vce-cloud-status');if(node){node.textContent=message;node.dataset.kind=kind}
}
function makeUI(){
 const target=document.querySelector('.intro')||document.querySelector('main');
 if(!target)return;
 const section=el('section','vce-cloud-connect');section.id='vce-cloud-connect';
 const head=el('div','vce-cloud-top');
 head.append(el('strong','', 'SYNCHRONISATION VCE SUPABASE'));
 const badge=el('span','vce-cloud-state','VÉRIFICATION');badge.id='vce-cloud-status';head.append(badge);section.append(head);
 section.append(el('p','muted','Les sessions et les tours sont chargés automatiquement depuis le compte authentifié. Le nom dans l’adresse ne donne pas accès aux données d’un autre pilote.'));
 const form=el('form','vce-cloud-login');form.id='vce-cloud-login';
 const email=el('input');email.id='vce-cloud-email';email.type='email';email.autocomplete='username';email.required=true;email.placeholder='Email Supabase du pilote';
 const password=el('input');password.id='vce-cloud-password';password.type='password';password.autocomplete='current-password';password.required=true;password.placeholder='Mot de passe';
 const submit=el('button');submit.type='submit';submit.textContent='CONNECTER MON COMPTE';
 form.append(email,password,submit);section.append(form);
 const controls=el('div','vce-cloud-actions');
 const refresh=el('button');refresh.type='button';refresh.textContent='ACTUALISER';refresh.onclick=()=>refreshData(true);
 const logout=el('button');logout.type='button';logout.textContent='DÉCONNECTER';logout.onclick=()=>{window.VCESupabase?.logout();banner('Déconnecté · données privées non chargées','warn');form.hidden=false;app.lastKey=''};
 controls.append(refresh,logout);section.append(controls);controls.id='vce-cloud-actions';
 target.after(section);
 const meters=document.querySelector('.vce-hud-meters');
 if(meters){
   const extra=el('section','vce-cloud-extra');extra.id='vce-cloud-extra';
   extra.append(el('strong','','DONNÉES COMPLÉMENTAIRES · SELON DISPONIBILITÉ DU JEU'));
   const grid=el('div','vce-cloud-extra-grid');
   for(const [key,label] of [['rpm','RÉGIME MOTEUR'],['fuel_l','CARBURANT (L)'],['position','POSITION'],['sector_index','INDEX SECTEUR'],['lap_pos','PROGRESSION TOUR'],['session_type','TYPE SESSION']]){
      const item=el('article');
      item.append(el('small','',label));
      const number=el('b','','—');number.id='vce-cloud-value-'+key;item.append(number);grid.append(item);
   }
   extra.append(grid);meters.after(extra);
   const num=v=>typeof v==='number'&&Number.isFinite(v);
   setInterval(()=>{
     const session=window.vceSession;const selected=Number(document.getElementById('lap')?.value||0);
     const valid=(session?.laps||[]).filter(l=>Array.isArray(l.samples)&&l.samples.length);
     const latest=session?.live?.sample||valid[selected]?.samples?.at(-1)||null;
     const value=(key,unit='')=>{const node=$('vce-cloud-value-'+key);if(!node)return;
       const v=latest?.[key];node.textContent=num(v)?v.toFixed(key==='fuel_l'?2:key==='lap_pos'?3:0)+unit:'—'};
     value('rpm',' tr/min');value('fuel_l',' L');value('position');value('sector_index');
     const lp=$('vce-cloud-value-lap_pos');if(lp)lp.textContent=num(latest?.lap_pos)?(latest.lap_pos*100).toFixed(1)+' %':'—';
     const mode=$('vce-cloud-value-session_type');if(mode)mode.textContent=session?.session_type||'—';
   },1300);
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault();submit.disabled=true;banner('Connexion à Supabase…');
   try{await window.VCESupabase.login(email.value,password.value);password.value='';form.hidden=true;await refreshData(true)}
   catch(ex){banner('Connexion impossible : '+ex.message,'error')}
   finally{submit.disabled=false}
 });
}
const api=async(action,extra={})=>{
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Compte non connecté');
 const c=cfg();
 const response=await fetch(c.url+'/functions/v1/vce-telemetry',{
   method:'POST',cache:'no-store',headers:{'apikey':c.key,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({action,...extra})});
 const result=await response.json().catch(()=>({error:'Réponse non JSON du serveur'}));
 if(!response.ok||result.error)throw Error('HTTP '+response.status+' : '+(result.error||'Erreur inconnue'));
 return result;
};
const numberOrNull=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function normalizeSample(x,origin){
 const n=numberOrNull;const absolute=n(x.t),elapsed=absolute!==null&&origin!==null?absolute-origin:null;
 const percent=v=>{const q=n(v);return q===null?null:round(q<=1&&q>=0?q*100:q,1)};
 const px=n(x.world_x),py=n(x.world_z),progress=n(x.lap_pos);
 return {t:elapsed,distance:progress,lap_pos:progress,speed:n(x.speed_kmh),speed_kmh:n(x.speed_kmh),
   throttle:percent(x.throttle),brake:percent(x.brake),steering:n(x.steer),gear:n(x.gear),
   x:px,y:py,slip:n(x.slip),rpm:n(x.rpm),fuel_l:n(x.fuel_l),position:n(x.position),sector_index:n(x.sector_index),abs:n(x.abs),tc:n(x.tc)};
}
function normalizeLap(item){
 const raw=Array.isArray(item.samples)?item.samples:[];
 const first=raw.length?numberOrNull(raw[0].t):null;
 const samples=raw.map(x=>normalizeSample(x,first));
 return {number:item.lap_number,time:numberOrNull(item.lap_time_ms)===null?null:Number(item.lap_time_ms)/1000,
   valid:item.valid,samples,sectors:[],sampleCount:item.sample_count??samples.length};
}
function normalizeSession(s,laps){
 const live=String(s.status)==='in_progress' && Date.now()-Date.parse(s.last_heartbeat_at||s.started_at)<60000;
 const sample=s.live_sample?normalizeSample(s.live_sample,numberOrNull(s.live_sample.t)):null;
 return {id:s.session_id,game:s.game,track:s.track||'Circuit non renseigné',car:s.car||'Voiture non renseignée',
   date:s.started_at?new Date(s.started_at).toLocaleString('fr-FR'):'',status:s.status,session_type:s.session_type||'',
   laps:laps.map(normalizeLap),totalLaps:s.laps_count||laps.length,live:{active:live,
     lap:s.laps_count,elapsed:null,sample}};
}
async function refreshData(forced=false){
 if(app.busy)return;
 app.busy=true;
 try{
   if(!window.VCESupabase?.configured())throw Error('Configuration Supabase absente');
   const token=await window.VCESupabase.validSession();
   if(!token?.access_token){
     $('vce-cloud-login').hidden=false;banner('CONNEXION REQUISE · sessions privées','warn');return;
   }
   $('vce-cloud-login').hidden=true;
   let staff=false;try{staff=await window.VCESupabase.isStaff()}catch{}
   const list=await api(staff?'staff_sessions':'pilot_sessions');
   let sessions=Array.isArray(list.sessions)?list.sessions:[];
   if(staff && requested())sessions=sessions.filter(s=>slug(s.pilot_slug)===requested());
   sessions=sessions.slice(0,12);
   const newest=sessions[0];
   if(!newest){
     banner(staff?'AUCUNE SESSION POUR CE PROFIL':'AUCUNE SESSION LIÉE À TON COMPTE','warn');return;
   }
   const key=sessions.map(s=>[s.session_id,s.status,s.laps_count,s.last_heartbeat_at].join(':')).join('|');
   if(key===app.lastKey&&!forced)return;
   const enriched=await Promise.all(sessions.map(async(s,i)=>{
     // Only fetch detailed samples for the most recent 4 sessions to avoid
     // transferring the full telemetry archive on every poll.
     if(i>3)return normalizeSession(s,[]);
     try{const data=await api('get_laps',{session_id:s.session_id,lap_limit:5});
       return normalizeSession(s,Array.isArray(data.laps)?data.laps:[])}
     catch(err){if(i===0)banner('Sessions reçues, mais tours indisponibles : '+err.message,'warn');return normalizeSession(s,[])}
   }));
   app.lastKey=key;
   window.VCEloadTelemetry?.({sessions:enriched},{source:'cloud'});
   const total=enriched.reduce((n,s)=>n+s.laps.length,0);
   banner((newest.status==='in_progress'?'● SESSION EN COURS':'● SYNCHRONISÉ')+
     ' · '+sessions.length+' session(s) · '+total+' tour(s) chargés'+(staff?' · vue STAFF':''),'ok');
   document.dispatchEvent(new Event('vce-cloud-update'));
 }catch(e){banner('FLUX SUPABASE : '+e.message,'error')}
 finally{app.busy=false}
}
function start(){
 makeUI();if(!window.VCESupabase){banner('Scripts Supabase introuvables','error');return}
 refreshData(true);
 app.poll=setInterval(()=>{if(!document.hidden)refreshData()},12000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
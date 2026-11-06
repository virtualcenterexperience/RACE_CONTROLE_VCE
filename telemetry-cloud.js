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
 const loginLink=el('a','vce-cloud-pilot-link','OUVRIR MA CONNEXION PILOTE');
 loginLink.id='vce-cloud-pilot-link';
 loginLink.href='pilote.html'+(requested()?'#'+encodeURIComponent(requested()):'');
 loginLink.hidden=true;section.append(loginLink);
 const controls=el('div','vce-cloud-actions');
 const refresh=el('button');refresh.type='button';refresh.textContent='ACTUALISER';refresh.onclick=()=>refreshData(true);
 const logout=el('button');logout.type='button';logout.textContent='DÉCONNECTER';logout.onclick=()=>{window.VCESupabase?.logout();location.href='pilote.html'+(requested()?'#'+encodeURIComponent(requested()):'')};
 controls.append(refresh,logout);section.append(controls);controls.id='vce-cloud-actions';
 const exportSession=el('button');exportSession.type='button';exportSession.id='vce-export-session';
 exportSession.textContent='TÉLÉCHARGER LA SÉANCE (JSON)';
 exportSession.title='Exporter les tours réellement enregistrés pour une analyse ultérieure';
 exportSession.onclick=()=>exportSelectedSession();
 controls.append(exportSession);
 const archiveState=el('p','muted','Historique accessible après la séance · seuls les tours reçus et enregistrés sur Supabase peuvent être rejoués.');
 archiveState.id='vce-archive-state';section.append(archiveState);
 const more=el('button');more.type='button';more.id='vce-load-more-laps';
 more.textContent='CHARGER LES TOURS PRÉCÉDENTS';
 more.onclick=()=>fetchOlderLaps();controls.append(more);
 document.getElementById('session')?.addEventListener('change',()=>setTimeout(loadSelectedSession,20));
 const compare=el('div','vce-other-driver');compare.id='vce-other-driver';
 const h=el('strong','','COMPARER AVEC UN AUTRE PILOTE VCE');compare.append(h);
 const hint=el('p','muted','Même jeu, voiture et circuit. Les autres pilotes doivent avoir autorisé la comparaison (ou compte STAFF).');
 compare.append(hint);
 const list=el('select');list.id='vce-other-session';list.append(new Option('Choisir un autre pilote / tour',''));
 const button=el('button');button.type='button';button.textContent='COMPARER LES COURBES';
 button.onclick=()=>loadOtherReference();
 const optIn=el('button');optIn.type='button';optIn.id='vce-opt-in-share';optIn.textContent='AUTORISER LE PARTAGE DE MES TOURS';
 optIn.onclick=async()=>{
  if(!confirm('Permettre aux autres pilotes VCE authentifiés de comparer tes tours aux leurs ? Le personnel STAFF peut déjà consulter les sessions.'))return;
  try{await api('pilot_share',{enabled:true});banner('Comparaison autorisée pour les autres pilotes','ok')}
  catch(e){banner('Partage impossible : '+e.message,'error')}
 };
 compare.append(list,button,optIn);section.append(compare);
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
 // Keep native pedal fractions (0..1) in samples; chart layer formats percent.
 const px=n(x.world_x),py=n(x.world_z),progress=n(x.lap_pos);
 // Preserve supported physical channels only when supplied by the game/collector.
 const extra={};
 const physicalKeys=['suspension_fl','suspension_fr','suspension_rl','suspension_rr',
 'ride_height_front','ride_height_rear','front_downforce','rear_downforce','drag',
 'camber_fl','camber_fr','camber_rl','camber_rr','tyre_wear_fl','tyre_wear_fr',
 'tyre_wear_rl','tyre_wear_rr','tyre_temp_fl','tyre_temp_fr','tyre_temp_rl','tyre_temp_rr',
 'fuel','fuel_liters','fuel_used','fuel_per_lap','fuel_laps_remaining','ground_contact','g_long','g_lat','clutch','air_temp','track_temp','brake_temp_fl','brake_temp_fr','brake_temp_rl','brake_temp_rr','tyre_temp_inner_fl','tyre_temp_inner_fr','tyre_temp_inner_rl','tyre_temp_inner_rr','tyre_temp_center_fl','tyre_temp_center_fr','tyre_temp_center_rl','tyre_temp_center_rr','tyre_temp_outer_fl','tyre_temp_outer_fr','tyre_temp_outer_rl','tyre_temp_outer_rr'];
 for(const k of physicalKeys){if(k==='ground_contact'){if(typeof x[k]==='boolean')extra[k]=x[k];continue}
  const v=n(x[k]);if(v!==null)extra[k]=v;
 }
 return {t:elapsed,distance:progress,lap_pos:progress,speed:n(x.speed_kmh),speed_kmh:n(x.speed_kmh),
   throttle:n(x.throttle),brake:n(x.brake),steering:n(x.steer),gear:n(x.gear),
   x:px,y:py,slip:n(x.slip),rpm:n(x.rpm),fuel_l:n(x.fuel_l),position:n(x.position),sector_index:n(x.sector_index),abs:n(x.abs),tc:n(x.tc),...extra};
}
function normalizeLap(item){
 const raw=Array.isArray(item.samples)?item.samples:[];
 const first=raw.length?numberOrNull(raw[0].t):null;
 const samples=raw.map(x=>normalizeSample(x,first));
 return {number:item.lap_number,time:numberOrNull(item.lap_time_ms)===null?null:Number(item.lap_time_ms)/1000,
   valid:item.valid,samples,sectors:[],sampleCount:item.sample_count??samples.length,mapQuality:item.map_quality||null};
}
function normalizeSession(s,laps){
 const live=String(s.status)==='in_progress' && Date.now()-Date.parse(s.last_heartbeat_at||s.started_at)<60000;
 const sample=s.live_sample?normalizeSample(s.live_sample,numberOrNull(s.live_sample.t)):null;
 return {id:s.session_id,device_id:s.device_id,pilot_slug:s.pilot_slug,game:s.game,track:s.track||'Circuit non renseigné',car:s.car||'Voiture non renseignée',
   date:s.started_at?new Date(s.started_at).toLocaleString('fr-FR'):'',status:s.status,session_type:s.session_type||'',
   laps:laps.map(normalizeLap),totalLaps:s.laps_count||laps.length,live:{active:live,
     lap:s.laps_count,elapsed:null,sample}};
}
/* get_laps is deliberately capped at 8 rows by the authenticated Edge Function.
   Follow before_lap until a complete short stint (10+ laps) is available. */
async function fetchSessionLaps(sessionId,maxLaps=40){
 const byNumber=new Map();let before=null;
 for(let page=0;page<Math.ceil(maxLaps/8)+1;page++){
  const args={session_id:sessionId,lap_limit:8};
  if(before!==null)args.before_lap=before;
  const result=await api('get_laps',args),chunk=Array.isArray(result.laps)?result.laps:[];
  if(!chunk.length)break;
  for(const l of chunk){const n=Number(l.lap_number);if(Number.isInteger(n))byNumber.set(n,l)}
  const numbers=chunk.map(l=>Number(l.lap_number)).filter(Number.isInteger);
  const oldest=numbers.length?Math.min(...numbers):null;
  if(chunk.length<8||oldest===null||oldest<=1||oldest===before||byNumber.size>=maxLaps)break;
  before=oldest;
 }
 return [...byNumber.values()].sort((a,b)=>a.lap_number-b.lap_number).slice(-maxLaps);
}
async function refreshData(forced=false){
 if(app.busy)return;
 app.busy=true;
 try{
   if(!window.VCESupabase?.configured())throw Error('Configuration Supabase absente');
   const token=await window.VCESupabase.validSession();
   if(!token?.access_token){
     $('vce-cloud-pilot-link').hidden=false;
     banner('CONNEXION REQUISE · connecte-toi dans ton espace pilote','warn');return;
   }
   let staff=false;try{staff=await window.VCESupabase.isStaff()}catch{}
   if(!staff){
     const identity=await api('pilot_whoami');
     if(identity.password_change_required){
       $('vce-cloud-pilot-link').hidden=false;
       banner('CHANGE TON MOT DE PASSE PROVISOIRE DANS TON ESPACE PILOTE','warn');return;
     }
     if(!identity.pilot_slug||(requested()&&slug(identity.pilot_slug)!==requested())){
       $('vce-cloud-pilot-link').hidden=false;
       banner('Ce profil ne correspond pas à ton compte authentifié','error');return;
     }
   }
   $('vce-cloud-pilot-link').hidden=true;
   const list=await api(staff?'staff_sessions':'pilot_sessions');
   let sessions=Array.isArray(list.sessions)?list.sessions:[];
   if(staff && requested())sessions=sessions.filter(s=>slug(s.pilot_slug)===requested());
   sessions=sessions.slice(0,12);
   const newest=sessions[0];
   if(!newest){
     app.lastKey='';window.VCEloadTelemetry?.({sessions:[]},{source:'cloud'});
     banner(staff?'AUCUNE SESSION POUR CE PROFIL':'AUCUNE SESSION LIÉE À TON COMPTE','warn');return;
   }
   const key=sessions.map(s=>[s.session_id,s.status,s.laps_count,s.last_heartbeat_at].join(':')).join('|');
   if(key===app.lastKey&&!forced)return;
   const enriched=await Promise.all(sessions.map(async(s,i)=>{
     // Only fetch detailed samples for the most recent 4 sessions to avoid
     // transferring the full telemetry archive on every poll.
     if(i>3)return normalizeSession(s,[]);
     try{const rows=await fetchSessionLaps(s.session_id,40);
       return normalizeSession(s,rows)}
     catch(err){if(i===0)banner('Sessions reçues, mais tours indisponibles : '+err.message,'warn');return normalizeSession(s,[])}
   }));
   app.lastKey=key;
   window.VCEloadTelemetry?.({sessions:enriched},{source:'cloud'});
   const archive=$('vce-archive-state');
   if(archive){
     const completed=enriched.filter(s=>s.status==='completed').length;
     const ongoing=enriched.filter(s=>s.status==='in_progress').length;
     archive.textContent='HISTORIQUE : '+completed+' séance(s) terminée(s) · '+ongoing+' en cours · '+enriched.reduce((n,s)=>n+s.laps.length,0)+' tours chargés. Les données des tours restent disponibles après fermeture de l’application.';
   }
   const total=enriched.reduce((n,s)=>n+s.laps.length,0);
   banner((newest.status==='in_progress'?'● SESSION EN COURS':'● SYNCHRONISÉ')+
     ' · '+sessions.length+' session(s) · '+total+' tour(s) chargés'+(staff?' · vue STAFF':''),'ok');
   document.dispatchEvent(new Event('vce-cloud-update'));
   if(!app.catalogKey||app.catalogKey!==window.vceSession?.id){app.catalogKey=window.vceSession?.id;updateComparisonCatalog()}
 }catch(e){banner('FLUX SUPABASE : '+e.message,'error')}
 finally{app.busy=false}
}
async function updateComparisonCatalog(){
 const source=window.vceSession;
 const list=$('vce-other-session');
 if(!source?.id||!list)return;
 const target=source.id;
 const previous=list.value;
 try{
  const data=await api('comparison_catalog',{base_session_id:target});
  if(window.vceSession?.id!==target)return;
  list.replaceChildren(new Option('Choisir une session compatible',''));
  for(const row of data.sessions||[]){
   const title=[row.pilot_slug,row.track,row.car,row.started_at?new Date(row.started_at).toLocaleDateString('fr-FR'):''].filter(Boolean).join(' · ');
   list.add(new Option(title,row.session_id));
  }
  if([...list.options].some(opt=>opt.value===previous))list.value=previous;
  // Auto-pair the first explicitly shareable compatible team reference.
  // The server checks account/team permissions and same game, car and circuit.
  const candidates=Array.isArray(data.sessions)?data.sessions:[];
  if(candidates.length&&window.VCEexternalReferenceLap?.baseId!==target&&app.autoComparedBase!==target){
    app.autoComparedBase=target;
    list.value=candidates[0].session_id;
    await loadOtherReference();
  }
 }catch(e){list.replaceChildren(new Option('Références indisponibles',''));banner('Comparaison : '+e.message,'warn')}
}
async function loadOtherReference(){
 const session=window.vceSession,id=$('vce-other-session')?.value;
 if(!session?.id||!id){banner('Sélectionne un pilote et une session à comparer','warn');return}
 try{
   const data=await api('comparison_laps',{base_session_id:session.id,target_session_id:id});
   const laps=(data.laps||[]).map(normalizeLap).filter(x=>x.valid!==false&&x.samples.length>=10);
   if(!laps.length){banner('Aucun tour comparable enregistré pour cette session','warn');return}
   const best=laps.filter(x=>typeof x.time==='number'&&x.time>0).sort((a,b)=>a.time-b.time)[0]||laps[0];
   window.VCEsetOtherPilotReference?.(data.pilot_slug,best,session.id);
   banner('RÉFÉRENCE CHARGÉE · '+data.pilot_slug+' · '+best.samples.length+' mesures','ok');
 }catch(e){banner('Impossible de comparer : '+e.message,'error')}
}
async function loadSelectedSession(){
 const index=Number($('session')?.value||0);
 const sessions=window.vceTelemetryData?.sessions||[];
 const target=sessions[index];
 if(!target||target.laps?.length||!target.totalLaps)return;
 try{
  banner('Chargement des tours de '+(target.track||'la session')+'…');
  const rows=await fetchSessionLaps(target.id,40);
  target.laps=rows.map(normalizeLap);
  window.VCEloadTelemetry?.({sessions},{source:'cloud'});
  document.dispatchEvent(new Event('vce-cloud-update'));
  banner('Tours chargés · '+target.laps.length,'ok');
 }catch(e){banner('Impossible de charger les tours : '+e.message,'error')}
}
async function exportSelectedSession(){
 const i=Number($('session')?.value||0);
 const session=window.vceTelemetryData?.sessions?.[i];
 if(!session?.id){banner('Aucune séance sélectionnée à exporter','warn');return}
 const button=$('vce-export-session');if(button)button.disabled=true;
 try{
  // Read through the same authenticated Edge Function as the dashboard.
  // The server checks session ownership (or STAFF rights) on every page.
  const all=new Map();
  let before=null,truncated=false;
  for(let page=0;page<125;page++){
   const args={session_id:session.id,lap_limit:8};
   if(before!==null)args.before_lap=before;
   const result=await api('get_laps',args);
   const chunk=Array.isArray(result.laps)?result.laps:[];
   if(!chunk.length)break;
   for(const lap of chunk){if(Number.isInteger(lap.lap_number))all.set(lap.lap_number,lap)}
   const oldest=Math.min(...chunk.map(l=>l.lap_number).filter(Number.isInteger));
   if(chunk.length<8||!Number.isFinite(oldest)||oldest<=1||oldest===before)break;
   before=oldest;
   if(page===124)truncated=true;
  }
  if(!all.size){banner('Cette séance ne contient pas encore de tours enregistrés','warn');return}
  const laps=[...all.values()].sort((a,b)=>a.lap_number-b.lap_number);
  const result={format:'vce-telemetry-session-v1',exported_at:new Date().toISOString(),
   session:{id:session.id,game:session.game,car:session.car,track:session.track,
    pilot_slug:session.pilot_slug,date:session.date,status:session.status,
    total_laps:session.totalLaps},laps:laps.map(normalizeLap),raw_laps:laps,truncated};
  const file=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(file);
  const safe=String(session.track||'circuit').replace(/[^a-z0-9_-]/gi,'_').slice(0,48);
  const a=document.createElement('a');a.href=url;a.download='VCE_'+safe+'_'+String(session.id).slice(0,8)+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  banner('Archive exportée · '+laps.length+' tour(s)'+(truncated?' · limite de 1000 tours atteinte':'')+' · '+laps.reduce((n,l)=>n+(l.samples?.length||0),0)+' échantillons','ok');
 }catch(e){banner('Export impossible : '+e.message,'error')}
 finally{if(button)button.disabled=false}
}
async function fetchOlderLaps(){
 const sessions=window.vceTelemetryData?.sessions||[];
 const index=Number($('session')?.value||0),target=sessions[index];
 if(!target||!target.id)return;
 const oldest=Math.min(...(target.laps||[]).map(l=>Number(l.number)).filter(Number.isFinite));
 if(!Number.isFinite(oldest)||oldest<=1){banner('Tous les tours disponibles sont déjà chargés','warn');return}
 const button=$('vce-load-more-laps');if(button)button.disabled=true;
 try{
  const rows=await api('get_laps',{session_id:target.id,lap_limit:100,before_lap:oldest});
  if(!(rows.laps||[]).length){banner('Aucun tour plus ancien à charger','warn');return}
  const existing=new Map((target.laps||[]).map(l=>[l.number,l]));
  for(const lap of rows.laps)existing.set(lap.lap_number,normalizeLap(lap));
  target.laps=[...existing.values()].sort((a,b)=>a.number-b.number);
  window.VCEloadTelemetry?.({sessions},{source:'cloud'});
  document.dispatchEvent(new Event('vce-cloud-update'));
  banner(target.laps.length+' tours disponibles pour comparaison','ok');
 }catch(e){banner('Chargement impossible : '+e.message,'error')}
 finally{if(button)button.disabled=false}
}
function start(){
 makeUI();if(!window.VCESupabase){banner('Scripts Supabase introuvables','error');return}
 refreshData(true);
 app.poll=setInterval(()=>{if(!document.hidden)refreshData()},2500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
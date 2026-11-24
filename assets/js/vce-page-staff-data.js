/* Staff page login/dashboard controller — extracted verbatim from staff.html. */

const gate=document.getElementById('gate'),dash=document.getElementById('dashboard'),msg=document.getElementById('message');
let __staffCheckSeq=0;
let staffRetryTimer;
let staffCheckInProgress=false;
const staffRetry=document.getElementById('vce-staff-retry');
async function show(){
 if(staffCheckInProgress)return;
 clearTimeout(staffRetryTimer);
 const token=++__staffCheckSeq;
 gate.style.display='block';dash.style.display='none';
 staffRetry.hidden=!VCESupabase.session();
 if(!VCESupabase.session()){msg.textContent='';return;}
 staffCheckInProgress=true;
 staffRetry.disabled=true;
 msg.textContent='Vérification des droits STAFF…';
 try{
  const allowed=await VCESupabase.isStaff();if(token!==__staffCheckSeq)return;
  if(!allowed){staffRetry.hidden=true;msg.textContent='Ce compte ne dispose pas des droits STAFF.';return}
  gate.style.display='none';dash.style.display='block';msg.textContent='';
  requestAnimationFrame(()=>{if(token===__staffCheckSeq){refreshStaffData();window.dispatchEvent(new Event('vce-staff-authenticated'))}});
 }catch(err){
  if(token!==__staffCheckSeq)return;
  staffRetry.hidden=!VCESupabase.session();
  msg.textContent='Vérification indisponible : '+err.message;
  if(!staffRetry.hidden)staffRetryTimer=setTimeout(()=>{if(!document.hidden&&token===__staffCheckSeq)show()},15000);
 }finally{
  if(token===__staffCheckSeq){staffCheckInProgress=false;staffRetry.disabled=false}
 }
}
function recoverStaff(){
 if(!document.hidden&&dash.style.display!=='block'&&VCESupabase.session()&&!staffRetry.hidden)show();
}
window.addEventListener('online',recoverStaff);
document.addEventListener('visibilitychange',recoverStaff);
window.addEventListener('vce-auth-session-ended',()=>{
 staffCheckInProgress=false;
 staffRetry.disabled=false;
 rcSummaryValidUntil=0;clearTimeout(rcRefreshTimer);
 for(const id of ['rcAssigned','rcApproved','rcResults','rcCalendar','rcNotifyCount'])document.getElementById(id).textContent='—';
 document.getElementById('rcFeed').replaceChildren();
 window.dispatchEvent(new Event('vce-staff-logged-out'));
 show();
});
staffRetry.addEventListener('click',show);
document.getElementById('vce-check-health').addEventListener('click',async()=>{const button=document.getElementById('vce-check-health'),target=document.getElementById('vce-health-message');button.disabled=true;target.textContent='Diagnostic en cours…';try{const status=await VCESupabase.healthCheck();target.textContent=status.status==='api_reachable'?'API Auth joignable, mais la connexion à la base et les mots de passe restent à vérifier.':'Réponse du service : '+String(status.status||'inconnue')+'.';}catch(e){target.textContent='Service indisponible : '+e.message}finally{button.disabled=false}});
document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('[type=submit]');if(btn?.disabled)return;if(btn)btn.disabled=true;msg.textContent='Connexion en cours…';try{await VCESupabase.login(document.getElementById('email').value,document.getElementById('password').value,{remember:document.getElementById('remember-staff').checked});document.getElementById('password').value='';await show()}catch(err){msg.textContent='Connexion refusée : '+err.message}finally{if(btn)btn.disabled=false}});
const RC_REFRESH_MS=120_000;
let rcLoading=false,rcManualPending=false,rcRefreshTimer;
let rcFailures=0,rcNextRefresh=0;
function rcClockTick(){const el=document.getElementById('rcClock');if(el)el.textContent=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
rcClockTick();setInterval(rcClockTick,1000);
function rcSafeText(v){return String(v??'')}
let rcSummaryValidUntil=0;
async function rcRefresh(force=false){
 if(rcLoading){rcManualPending ||= force;return}
 if(!VCESupabase.session())return;
 rcLoading=true;const sequence=__staffCheckSeq;
 const current=()=>sequence===__staffCheckSeq&&VCESupabase.session()&&dash.style.display==='block';
 try{
  if(!await VCESupabase.isStaff()){if(current())show();return}
  if(!current())return;
  const sync=document.getElementById('rcSync');sync.textContent='● ACTUALISATION…';
  let errors=0;
  const tasks=[['training_assignments','rcAssigned',d=>Array.isArray(d.items)?d.items.length:0],['resultats','rcResults',d=>(d.presets||[]).filter(x=>x.published).length],['calendrier','rcCalendar',d=>(d.presets||[]).filter(x=>x.published).length]];
  const outcomesPromise=Promise.allSettled([VCESupabase.reviews(),VCESupabase.trainingSubmissions({includePayload:false}),VCESupabase.pendingRaceResults()]);
  if(force||Date.now()>=rcSummaryValidUntil){
   await Promise.all(tasks.map(async([kind,id,count])=>{try{const data=await VCESupabase.read(kind);if(current())document.getElementById(id).textContent=count(data)}catch(error){errors++;if(current())document.getElementById(id).textContent='—'}}));
   if(!errors)rcSummaryValidUntil=Date.now()+RC_REFRESH_MS;
  }
  const outcomes=await outcomesPromise;if(!current())return;
  const values=outcomes.map(x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[]);
  const [reviews,submissions,races]=values;
  const feed=document.getElementById('rcFeed');feed.replaceChildren();
  const add=(title,description,href)=>{const item=document.createElement(href?'a':'div');item.className='rc-feeditem';if(href)item.href=href;const h=document.createElement('b'),p=document.createElement('small');h.textContent=title;p.textContent=description;p.style.display='block';item.append(h,p);feed.append(item)};
  const labels=['Validations','Réception des entraînements','Réception des résultats'];
  outcomes.forEach((x,i)=>{if(x.status==='rejected'){errors++;add('⚠ '+labels[i],x.reason.message)}});
  document.getElementById('rcApproved').textContent=outcomes[0].status==='fulfilled'?reviews.filter(x=>x.decision==='approved').length:'—';
  const reviewed=new Set(reviews.map(x=>String(x.session_id)));
  const waiting=submissions.filter(x=>!reviewed.has(String(x.session_id)));
  const alerts=[...waiting.map(x=>({name:x.pilot,title:'ENTRAÎNEMENT À VALIDER',date:x.submitted_at,href:'validation-seances.html'})),...races.map(x=>({name:x.pilot_slug.replaceAll('-',' '),title:'RÉSULTAT À VALIDER · '+x.event_name,date:x.created_at,href:'team-resultats-recus.html'}))].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const bell=document.getElementById('rcNotifyBell');bell.classList.toggle('has-new',alerts.length>0);bell.setAttribute('aria-label',alerts.length+' envoi(s) en attente · entraînements et résultats');
  document.getElementById('rcNotifyCount').textContent=alerts.length>99?'99+':String(alerts.length);
  document.getElementById('rcPending').textContent=errors?'⚠ DONNÉES PARTIELLES':alerts.length?waiting.length+' entraînement(s) · '+races.length+' résultat(s)':'✓ AUCUN ENVOI EN ATTENTE';
  for(const x of alerts.slice(0,8))add('🔴 '+x.name+' — '+x.title,new Date(x.date).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),x.href);
  for(const x of reviews.slice().reverse().slice(0,Math.max(0,8-alerts.length)))add(x.pilot,(x.decision==='approved'?'✓ Séance validée':'✕ Séance refusée')+' · '+new Date(x.reviewed_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}));
  if(!feed.children.length)feed.textContent='Aucun envoi en attente.';
  sync.textContent=errors?'● DONNÉES PARTIELLES':'● DONNÉES SYNCHRONISÉES';sync.style.color=errors?'#f2b53e':'#4fdaa5';rcFailures=errors?rcFailures+1:0;
 }catch(error){rcFailures++;throw error}
 finally{
  rcLoading=false;
  if(current()){
   const delay=RC_REFRESH_MS*Math.min(4,2**rcFailures);rcNextRefresh=Date.now()+delay;
   clearTimeout(rcRefreshTimer);rcRefreshTimer=setTimeout(()=>{if(!document.hidden&&dash.style.display==='block')refreshStaffData()},delay);
   if(rcManualPending){rcManualPending=false;queueMicrotask(()=>refreshStaffData(true))}
  }else rcManualPending=false;
 }
}
function refreshStaffData(force=false){rcRefresh(force).catch(error=>{document.getElementById('rcSync').textContent='● SYNCHRONISATION À RÉESSAYER';console.warn('STAFF',error)})}
document.getElementById('rcRefresh').addEventListener('click',()=>refreshStaffData(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dash.style.display==='block'&&Date.now()>=rcNextRefresh)refreshStaffData()});
document.getElementById('logout').addEventListener('click',()=>VCESupabase.logout());show();

window.addEventListener('vce-training-updated',()=>{if(dash.style.display==='block')refreshStaffData(true)});
window.addEventListener('storage',event=>{if(['vce_training_updated_at','vce_team_results_updated_at'].includes(event.key)&&dash.style.display==='block')refreshStaffData(true)});

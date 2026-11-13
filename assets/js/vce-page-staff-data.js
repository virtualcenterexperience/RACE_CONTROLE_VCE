/* Staff page login/dashboard controller — extracted verbatim from staff.html. */

const gate=document.getElementById('gate'),dash=document.getElementById('dashboard'),msg=document.getElementById('message');
let __staffCheckSeq=0;
let staffRetryTimer;
const staffRetry=document.getElementById('vce-staff-retry');
async function show(){
 clearTimeout(staffRetryTimer);
 const token=++__staffCheckSeq;
 gate.style.display='block';dash.style.display='none';
 staffRetry.hidden=!VCESupabase.session();
 if(!VCESupabase.session()){msg.textContent='';return;}
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
 }
}
function recoverStaff(){
 if(!document.hidden&&dash.style.display!=='block'&&VCESupabase.session()&&!staffRetry.hidden)show();
}
window.addEventListener('online',recoverStaff);
document.addEventListener('visibilitychange',recoverStaff);
window.addEventListener('vce-auth-session-ended',()=>{
 window.dispatchEvent(new Event('vce-staff-logged-out'));
 show();
});
staffRetry.addEventListener('click',show);
document.getElementById('vce-check-health').addEventListener('click',async()=>{const button=document.getElementById('vce-check-health'),target=document.getElementById('vce-health-message');button.disabled=true;target.textContent='Diagnostic en cours…';try{const status=await VCESupabase.healthCheck();target.textContent=status.status==='api_reachable'?'API Auth joignable, mais la connexion à la base et les mots de passe restent à vérifier.':'Réponse du service : '+String(status.status||'inconnue')+'.';}catch(e){target.textContent='Service indisponible : '+e.message}finally{button.disabled=false}});
document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('[type=submit]');if(btn?.disabled)return;if(btn)btn.disabled=true;msg.textContent='Connexion en cours…';try{await VCESupabase.login(document.getElementById('email').value,document.getElementById('password').value,{remember:document.getElementById('remember-staff').checked});document.getElementById('password').value='';await show()}catch(err){msg.textContent='Connexion refusée : '+err.message}finally{if(btn)btn.disabled=false}});
let rcLoading=false;
function rcClockTick(){const el=document.getElementById('rcClock');if(el)el.textContent=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
rcClockTick();setInterval(rcClockTick,1000);
function rcSafeText(v){return String(v??'')}
async function rcRefresh(){if(rcLoading||!VCESupabase.session())return;rcLoading=true;try{const sync=document.getElementById('rcSync');sync.textContent='● ACTUALISATION…';let errors=0;const tasks=[['training_assignments','rcAssigned',d=>Array.isArray(d.items)?d.items.length:0],['resultats','rcResults',d=>(d.presets||[]).filter(x=>x.published).length],['calendrier','rcCalendar',d=>(d.presets||[]).filter(x=>x.published).length]];const outcomesPromise=Promise.allSettled([VCESupabase.reviews(),VCESupabase.trainingSubmissions()]);await Promise.all(tasks.map(async([kind,id,fn])=>{try{const d=await VCESupabase.read(kind);document.getElementById(id).textContent=fn(d)}catch(e){errors++;document.getElementById(id).textContent='—';console.warn('STAFF',kind,e)}}));const outcomes=await outcomesPromise;const reviews=outcomes[0].status==='fulfilled'?outcomes[0].value:[],submissions=outcomes[1].status==='fulfilled'?outcomes[1].value:[];const feed=document.getElementById('rcFeed');feed.replaceChildren();const warnings=[];if(outcomes[0].status==='rejected'){errors++;document.getElementById('rcApproved').textContent='—';warnings.push('Validations : '+outcomes[0].reason.message)}else document.getElementById('rcApproved').textContent=reviews.filter(x=>x.decision==='approved').length;if(outcomes[1].status==='rejected'){errors++;warnings.push('Réception des entraînements : '+outcomes[1].reason.message)}const reviewedIds=new Set(reviews.map(x=>String(x.session_id)));const waiting=submissions.filter(x=>!reviewedIds.has(String(x.session_id)));const bell=document.getElementById('rcNotifyBell');bell.classList.toggle('has-new',waiting.length>0);bell.setAttribute('aria-label',waiting.length+' entraînement(s) en attente');document.getElementById('rcNotifyCount').textContent=waiting.length>99?'99+':String(waiting.length);document.getElementById('rcPending').textContent=outcomes[1].status==='rejected'?'⚠ RÉCEPTION INDISPONIBLE':waiting.length?'🔴 '+waiting.length+' EN ATTENTE':'✓ AUCUNE EN ATTENTE';for(const sub of waiting.slice(0,8)){const item=document.createElement('a');item.href='validation-seances.html';item.className='rc-feeditem';item.style.cssText='display:block;text-decoration:none;border-left:3px solid #ff3654;padding:10px';const title=document.createElement('b');title.textContent='🔴 '+sub.pilot+' — NOUVEL ENTRAÎNEMENT';const desc=document.createElement('small');desc.style.display='block';desc.textContent=new Date(sub.submitted_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+' · CLIQUER POUR VALIDER';item.append(title,desc);feed.append(item)}for(const v of reviews.slice().reverse().slice(0,Math.max(0,8-waiting.length))){const item=document.createElement('div');item.className='rc-feeditem';const title=document.createElement('b');title.textContent=v.pilot||'Pilote';const desc=document.createElement('small');desc.style.display='block';desc.textContent=(v.decision==='approved'?'✓ Séance validée':'✕ Séance refusée')+' · '+(v.reviewed_at?new Date(v.reviewed_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'Date indisponible');item.append(title,desc);feed.append(item)}for(const message of warnings){const item=document.createElement('div');item.className='rc-feeditem';item.style.color='#ffb55d';item.textContent='⚠ '+message;feed.prepend(item);console.warn('STAFF',message)}if(outcomes[1].status==='rejected'){const link=document.createElement('a');link.href='https://github.com/virtualcenterexperience/RACE_CONTROLE_VCE/blob/main/supabase-training-submissions.sql';link.textContent='Configurer la table Supabase →';link.target='_blank';link.rel='noopener noreferrer';link.style.color='#6cbcff';feed.append(link)}if(!feed.children.length)feed.textContent='Aucune séance reçue.';sync.textContent=errors?'● DONNÉES PARTIELLES':'● DONNÉES SYNCHRONISÉES';sync.style.color=errors?'#f2b53e':'#4fdaa5'}finally{rcLoading=false}}
function refreshStaffData(){rcRefresh().catch(error=>{document.getElementById('rcSync').textContent='● SYNCHRONISATION À RÉESSAYER';console.warn('STAFF',error)})}
document.getElementById('rcRefresh').addEventListener('click',refreshStaffData);
setInterval(()=>{if(!document.hidden&&dash.style.display==='block')refreshStaffData()},10000);
document.getElementById('logout').addEventListener('click',()=>VCESupabase.logout());show();

/* VCE CACHE · STAFF-only remote backups and training-cycle reset. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const cfg=window.VCE_SUPABASE;
let cycle=0,busy=false,authenticated=false;
function status(s,err=false){$('status').textContent=s;$('status').dataset.error=String(err)}
async function api(action,other={}){
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Session STAFF expirée : reconnecte-toi.');
 const res=await fetch(cfg.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',
  headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action,...other})
 });
 const data=await res.json().catch(()=>({error:'Réponse serveur illisible'}));
 if(!res.ok||data.error)throw Error(data.error||('Erreur HTTP '+res.status));
 return data
}
function setBusy(on){
 busy=on;
 for(const id of ['btnRefresh','btnArchive','btnReset'])$(id).disabled=on
}
function display(archives){
 const body=$('archives');body.replaceChildren();
 $('archivesEmpty').hidden=archives.length>0;
 const date=s=>s?new Date(s).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'—';
 for(const a of archives){
  const tr=document.createElement('tr');
  const make=s=>{const td=document.createElement('td');td.textContent=s;tr.append(td);return td};
  make(date(a.created_at));
  make(a.operation==='before_training_reset'?'Avant réinitialisation':'Sauvegarde manuelle');
  const td=make('');
  const button=document.createElement('button');
  button.className='secondary';button.textContent='Exporter JSON';button.type='button';
  button.disabled=busy;
  button.addEventListener('click',()=>exportArchive(a.id));
  td.append(button);body.append(tr)
 }
}
async function refresh(){
 const data=await api('staff_cache_status');
 cycle=data.cycle||0;
 $('cycle').textContent=String(cycle);
 $('assigned').textContent=String(data.training_assignments||0);
 $('pending').textContent=String(data.submissions||0);
 $('reviews').textContent=String(data.reviews||0);
 display(data.archives||[]);
 status('✓ CACHE synchronisé depuis Supabase. Aucune donnée supprimée.')
}
async function perform(fn){
 if(busy)return;setBusy(true);
 try{await fn()}catch(e){status(e.message,true)}
 finally{setBusy(false)}
}
async function createArchive(){
 await perform(async()=>{
  status('Sauvegarde chiffrée par connexion HTTPS vers le stockage privé Supabase…');
  const a=await api('staff_cache_snapshot');
  if(!a.ok||!a.archive_id)throw Error('Le serveur n’a pas confirmé la sauvegarde.');
  await refresh();
  status('✓ Archive créée : '+a.archive_id+' · entraînements et données de publication préservés.')
 })
}
async function reset(){
 if(busy)return;
 const input=$('resetPhrase');
 if(input.value.trim()!=='REINITIALISER ENTRAINEMENTS'){
  status('Pour confirmer, saisis exactement : REINITIALISER ENTRAINEMENTS',true);return
 }
 if(!confirm('Attention : remettre à zéro les entraînements ACTIFS, les soumissions et les validations ?\n\nLe serveur créera d’abord une archive permanente. Les tours télémétriques, résultats, profils, classements et publications TEAM resteront intacts.'))return;
 await perform(async()=>{
  status('Sauvegarde préalable et réinitialisation atomique en cours…');
  const res=await api('staff_cache_reset',{confirmation:'REINITIALISER ENTRAINEMENTS',expected_cycle:cycle});
  if(!res.ok||!res.archive_id)throw Error('Opération non confirmée par le serveur.');
  input.value='';
  await refresh();
  status('✓ Cycle d’entraînement '+res.cycle+' activé. Archive préalable : '+res.archive_id+
   '. Aucun tour, résultat ou profil supprimé.')
 })
}
async function exportArchive(id){
 await perform(async()=>{
  const result=await api('staff_cache_export',{archive_id:id});
  if(!result.archive||result.archive.id!==id)throw Error('Archive non vérifiée.');
  const blob=new Blob([JSON.stringify(result.archive,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='VCE-CACHE-'+id+'.json';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),20000);
  status('✓ Export JSON local demandé. La sauvegarde reste stockée sur Supabase.')
 })
}
async function init(){
 try{
  if(!cfg?.url||!cfg?.key||!window.VCESupabase?.session()||!await VCESupabase.isStaff())
   throw Error('Connexion STAFF requise.');
  authenticated=true;$('gate').hidden=true;$('workspace').hidden=false;
  await perform(refresh)
 }catch(e){$('gate').textContent=e.message+' — Utilise la connexion STAFF.';$('workspace').hidden=true}
}
$('btnRefresh').onclick=()=>perform(refresh);
$('btnArchive').onclick=createArchive;
$('btnReset').onclick=reset;
init()
})();
/* VCE staff provisioning panel: requires a verified Supabase STAFF account. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let accounts=[],pilots=[];
async function api(action,pilot_slug){
 const auth=await VCESupabase.validSession();
 if(!auth?.access_token)throw Error('Compte STAFF requis');
 const c=window.VCE_SUPABASE;
 const r=await fetch(c.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',
  headers:{apikey:c.key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action,pilot_slug})
 });
 const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Erreur de connexion');return d;
}
function update(){
 const active=$('vce-pilot-provision-select').value;
 $('vce-pilot-provision-create').disabled=accounts.includes(active);
 $('vce-pilot-provision-reset').disabled=!accounts.includes(active);
}
async function refresh(){
 const d=await api('staff_pilot_accounts');
 accounts=(d.accounts||[]).map(x=>x.pilot_slug);
 $('vce-pilot-provision-status').textContent=accounts.length+' compte(s) activé(s)';
 update();
}
async function provision(reset){
 const id=$('vce-pilot-provision-select').value;
 if(!id||!confirm((reset?'Réinitialiser':'Créer')+' le compte '+id+' ?'))return;
 try{
  const d=await api(reset?'staff_reset_pilot':'staff_provision_pilot',id);
  $('vce-pilot-provision-result').textContent=
   'Pilote : '+id+'\nIdentifiant : '+d.identifier+
   '\nCode temporaire : '+d.temporary_password+
   '\nÀ changer lors de la première connexion.';
  $('vce-pilot-provision-message').textContent='Remets ce code au pilote en privé. Il ne sera plus affiché après rechargement.';
  await refresh();
 }catch(e){$('vce-pilot-provision-message').textContent=e.message}
}
async function init(){
 const host=$('work');if(!host)return;
 const section=document.createElement('section');section.className='panel';
 section.innerHTML='<h2>ACCÈS PILOTES · COMPTES SUPABASE</h2>'+
 '<p class="muted">Création sécurisée par le STAFF. Chaque profil a un code provisoire individuel.</p>'+
 '<p id="vce-pilot-provision-status">Vérification…</p>'+
 '<select id="vce-pilot-provision-select" style="padding:11px;background:#142a46;color:white"></select> '+
 '<button id="vce-pilot-provision-create">CRÉER</button> '+
 '<button id="vce-pilot-provision-reset">RÉINITIALISER</button> '+
 '<button id="vce-pilot-provision-refresh">ACTUALISER</button>'+
 '<p id="vce-pilot-provision-message" class="muted"></p>'+
 '<pre id="vce-pilot-provision-result" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>';
 host.prepend(section);
 $('vce-pilot-provision-create').onclick=()=>provision(false);
 $('vce-pilot-provision-reset').onclick=()=>provision(true);
 $('vce-pilot-provision-refresh').onclick=refresh;
 $('vce-pilot-provision-select').onchange=update;
 try{
  if(!await VCESupabase.isStaff())return;
  const r=await fetch('data/vce/pilotes.json',{cache:'no-store'});
  if(!r.ok)throw Error('Liste des pilotes introuvable');
  pilots=await r.json();
  const select=$('vce-pilot-provision-select');
  pilots.forEach(p=>select.add(new Option(p.name,p.id)));
  await refresh();
 }catch(e){$('vce-pilot-provision-message').textContent='Configuration requise : '+e.message}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
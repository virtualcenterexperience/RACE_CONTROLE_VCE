/* RACE CONTROL VCE — STAFF native roster tab, backed exclusively by secure Supabase Edge Functions. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const tab=$('rcPilotManage'),dashboard=$('dashboard');
if(!tab||!dashboard)return;
let rows=[],accounts=new Map(),busy=false,loaded=false;
const button=$('rcRosterCreate'),form=$('rcRosterForm'),list=$('rcRosterList'),status=$('rcRosterStatus');
const privateBox=$('rcRosterCredentials'),privateText=$('rcRosterSecret');
function tell(message,isError=false){
 status.textContent=message;status.dataset.error=String(isError)
}
function clearSecret(){privateText.textContent='';privateBox.hidden=true}
async function api(action,extras={}){
 const auth=await window.VCESupabase?.validSession();
 const cfg=window.VCE_SUPABASE;
 if(!auth?.access_token||!cfg?.url||!cfg?.key)throw Error('Session STAFF expirée. Reconnecte-toi.');
 const response=await fetch(cfg.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',headers:{
   apikey:cfg.key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'
  },body:JSON.stringify({action,...extras})
 });
 const body=await response.json().catch(()=>({error:'Réponse serveur invalide'}));
 if(!response.ok||body.error)throw Error(body.error||'Erreur serveur HTTP '+response.status);
 return body
}
function toggleBusy(value){
 busy=value;button.disabled=value;$('rcRosterReload').disabled=value;
 list.querySelectorAll('button').forEach(b=>b.disabled=value)
}
function credentials(name,info){
 if(!info?.temporary_password)return;
 privateText.textContent='Pilote : '+name+'\nIdentifiant : '+info.identifier+
  '\nCode provisoire : '+info.temporary_password+
  '\nPremière connexion : le pilote doit choisir un mot de passe personnel.';
 privateBox.hidden=false
}
function element(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node
}
function render(){
 list.replaceChildren();
 $('rcRosterCount').textContent=rows.length+' pilote'+(rows.length>1?'s':'');
 if(!rows.length){list.append(element('p','', 'Aucun pilote enregistré dans Supabase.'));return}
 for(const p of rows){
  const line=element('div','vce-roster-row');
  const identity=element('div','vce-roster-identity');
  identity.append(element('span','vce-roster-avatar',(p.name||'?').charAt(0)));
  const label=element('div');
  label.append(element('strong','',p.name));
  const current=accounts.get(p.id);
  const subtitle=current?.active===false?'Compte désactivé':current?'Compte pilote créé':'Compte non activé';
  label.append(element('small','',subtitle));
  identity.append(label);
  const actions=element('div','vce-roster-actions');
  if(current?.active===false){
   const restore=element('button','vce-roster-restore','Réactiver');
   restore.type='button';restore.disabled=busy;
   restore.addEventListener('click',()=>reactivate(p));
   actions.append(restore)
  }
  const remove=element('button','vce-roster-danger','Retirer');
  remove.type='button';remove.disabled=busy;
  remove.setAttribute('aria-label','Retirer '+p.name);
  remove.addEventListener('click',()=>removePilot(p));
  actions.append(remove);
  line.append(identity,actions);list.append(line)
 }
}
async function reload({preserveSecret=false}={}){
 if(busy)return;
 toggleBusy(true);
 if(!preserveSecret)clearSecret();
 tell('Synchronisation avec le STAFF Supabase…');
 try{
  if(!await window.VCESupabase?.isStaff())throw Error('Accès STAFF requis.');
  const data=await api('staff_roster_list');
  if(!Array.isArray(data.items))throw Error('Liste de pilotes invalide.');
  rows=data.items.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string');
  try{
   const result=await api('staff_pilot_accounts');
   accounts=new Map((result.accounts||[]).map(a=>[a.pilot_slug,a]));
  }catch(err){accounts=new Map();console.warn('Comptes pilote',err)}
  loaded=true;render();
  tell('✓ '+rows.length+' pilote(s) synchronisés avec Supabase.')
 }catch(err){tell('Chargement impossible : '+err.message,true)}
 finally{toggleBusy(false)}
}
async function addPilot(event){
 event.preventDefault();if(busy)return;
 const input=$('rcRosterName'),name=input.value.trim().replace(/\s+/g,' ');
 if(name.length<3||name.length>100||name.split(' ').length<2||!/^[\p{L}\p{M} '-]+$/u.test(name)){
  tell('Renseigne le prénom et le nom du pilote (lettres, espaces, tirets, apostrophes).',true);return
 }
 toggleBusy(true);clearSecret();tell('Création du profil pilote et de son accès Supabase…');
 try{
  const result=await api('staff_roster_add',{pilot_name:name});
  if(!result.ok||!Array.isArray(result.items)||!result.credentials?.temporary_password)
   throw Error('Création non confirmée par le serveur.');
  rows=result.items;input.value='';render();
  credentials(name,result.credentials);
  tell('✓ '+name.toUpperCase()+' ajouté. Remets son code provisoire en privé.');
  // Cross-tab consistency; the PILOTE page already checks changes in Supabase.
  window.dispatchEvent(new Event('vce-roster-updated'))
 }catch(err){tell('Ajout impossible : '+err.message,true)}
 finally{toggleBusy(false)}
}
async function removePilot(p){
 if(busy)return;
 if(!confirm('Retirer '+p.name+' et DÉSACTIVER sa connexion ?\n\nLes résultats, chronos et entraînements enregistrés seront conservés.'))return;
 toggleBusy(true);clearSecret();tell('Retrait du pilote en cours…');
 try{
  const result=await api('staff_roster_remove',{pilot_slug:p.id});
  if(!result.ok||!Array.isArray(result.items))throw Error('Retrait non confirmé par Supabase.');
  rows=result.items;accounts.delete(p.id);render();
  tell('✓ '+p.name+' retiré. Son historique est conservé.');
  window.dispatchEvent(new Event('vce-roster-updated'))
 }catch(err){tell('Retrait impossible : '+err.message,true)}
 finally{toggleBusy(false)}
}
async function reactivate(p){
 if(busy)return;
 if(!confirm('Réactiver '+p.name+' ? Son ancien mot de passe sera remplacé par un nouveau code provisoire.'))return;
 toggleBusy(true);clearSecret();tell('Réactivation du compte…');
 try{
  const result=await api('staff_reset_pilot',{pilot_slug:p.id});
  if(!result.ok||!result.temporary_password)throw Error('Réactivation non confirmée.');
  accounts.set(p.id,{pilot_slug:p.id,active:true});
  render();credentials(p.name,result);
  tell('✓ '+p.name+' réactivé. Transmets le nouveau code en privé.')
 }catch(err){tell('Réactivation impossible : '+err.message,true)}
 finally{toggleBusy(false)}
}
function route(){
 const active=location.hash==='#gestion-pilotes';
 dashboard.classList.toggle('rc-pilot-tab',active);
 tab.hidden=!active;
 for(const link of dashboard.querySelectorAll('.rc-navlink[href="#overview"],.rc-navlink[data-vce-roster-tab]')){
  link.classList.toggle('selected',link.getAttribute('href')===(active?'#gestion-pilotes':'#overview'))
 }
 if(active){
  if(dashboard.style.display==='block'&&window.VCESupabase?.session()){
   if(!loaded)reload();else render()
  }
 }else clearSecret()
}
form.addEventListener('submit',addPilot);
$('rcRosterReload').addEventListener('click',()=>reload());
$('rcRosterHide').addEventListener('click',clearSecret);
window.addEventListener('hashchange',route);
window.addEventListener('pageshow',route);
window.addEventListener('vce-staff-authenticated',()=>{
 if(location.hash==='#gestion-pilotes')reload()
});
window.addEventListener('vce-staff-logged-out',()=>{
 loaded=false;rows=[];accounts.clear();clearSecret();tab.hidden=true
});
route()
})();

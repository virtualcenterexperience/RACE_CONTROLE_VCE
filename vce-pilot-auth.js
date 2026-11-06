/* VCE PILOTE — verified Supabase Auth gate, no localStorage password and no trust in URL identity. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const internalEmail=id=>'vce-pilote+'+id+'@virtual-center-experience.fr';
const state={checked:'',seq:0,identity:null,verified:''};
window.VCEPilotAuthCanAccess=id=>state.verified===slug(id)&&Boolean(id);
let card=null;
const current=()=>slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''));
const cfg=()=>window.VCE_SUPABASE||{};
function lock(value){document.documentElement.classList.toggle('vce-pilot-auth-locked',value);const el=$('pilotDashboard');if(el)el.style.setProperty('display',value?'none':'block','important')}
async function isAccountReady(id){
 const config=cfg();
 if(!window.VCESupabase?.configured())return false;
 try{
  const response=await fetch(config.url+'/functions/v1/vce-telemetry',{
   method:'POST',cache:'no-store',
   headers:{apikey:config.key,'Content-Type':'application/json'},
   body:JSON.stringify({action:'pilot_account_ready',pilot_slug:id})
  });
  if(!response.ok)return false;
  const body=await response.json();
  return body?.ready===true;
 }catch{return false}
}
async function api(action,extra={}){
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Session de connexion absente');
 const config=cfg();if(!window.VCESupabase.configured())throw Error('Supabase non configuré');
 const r=await fetch(config.url+'/functions/v1/vce-telemetry',{
  method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+session.access_token,
    'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,...extra})
 });
 const data=await r.json().catch(()=>({error:'Réponse invalide du serveur'}));
 if(!r.ok||data.error)throw Error(data.error||'HTTP '+r.status);
 return data;
}
function mount(){
 if(card)return;
 card=document.createElement('div');card.id='vce-pilot-auth-gate';card.hidden=true;
 card.innerHTML='<section class="vce-login-panel" role="dialog" aria-modal="true" aria-labelledby="vce-pilot-auth-title">'+
 '<div class="vce-login-kicker">VCE ESPORT · ACCÈS PILOTE</div>'+
 '<h2 id="vce-pilot-auth-title">CONNEXION <span>PILOTE</span></h2>'+
 '<p id="vce-pilot-auth-name"></p><p id="vce-pilot-auth-message" role="status" aria-live="polite"></p>'+
 '<form id="vce-pilot-login-form"><label>Identifiant<input readonly autocomplete="username" value="virtualcenterexperience"></label>'+
 '<label>Mot de passe personnel ou code provisoire<input id="vce-pilot-secret" type="password" autocomplete="current-password" required></label>'+
 '<button type="submit">ACCÉDER À MON PROFIL</button></form>'+
 '<form id="vce-pilot-change-form" hidden><p>Première connexion : remplace le code provisoire par un mot de passe personnel.</p>'+
 '<label>Nouveau mot de passe (12 caractères minimum)<input type="password" id="vce-pilot-new" minlength="12" autocomplete="new-password" required></label>'+
 '<label>Confirmer le mot de passe<input type="password" id="vce-pilot-confirm" minlength="12" autocomplete="new-password" required></label>'+
 '<button type="submit">VALIDER MON NOUVEAU MOT DE PASSE</button></form>'+
 '<div class="vce-login-actions"><button type="button" id="vce-pilot-reconnect" hidden>Déconnecter ce compte</button>'+
 '<a href="pilote.html" id="vce-pilot-auth-back">← Retour à la liste des pilotes</a></div></section>';
 document.body.append(card);
 $('vce-pilot-login-form').addEventListener('submit',signIn);
 $('vce-pilot-change-form').addEventListener('submit',changePassword);
 $('vce-pilot-reconnect').onclick=()=>{window.VCESupabase?.logout();state.identity=null;showForm('Compte déconnecté. Connecte-toi avec les identifiants de ce pilote.')};
}
function show(message=''){
 mount();card.hidden=false;
 const currentName=current().replace(/-/g,' ').toUpperCase();
 $('vce-pilot-auth-name').textContent=currentName;
 $('vce-pilot-auth-message').textContent=message;
}
function showForm(message=''){
 show(message||'Saisis le code provisoire fourni par le STAFF ou ton mot de passe personnel.');
 $('vce-pilot-login-form').hidden=false;$('vce-pilot-change-form').hidden=true;
 $('vce-pilot-reconnect').hidden=!window.VCESupabase?.session();
}
function showChange(){
 show('Pour protéger ta télémétrie, choisis un mot de passe personnel à la première connexion.');
 $('vce-pilot-login-form').hidden=true;$('vce-pilot-change-form').hidden=false;
 $('vce-pilot-reconnect').hidden=false;
}
function openDashboard(){
 state.verified=current();card.hidden=true;lock(false);
 // The existing profile router handles visible data and navigation.
 window.dispatchEvent(new Event('vce-pilot-verified'));
}
async function route(){
 const id=current(),request=++state.seq;state.verified='';
 if(!id){lock(true);if(card)card.hidden=true;return}
 lock(true);show('Vérification de ton compte VCE ESPORT…');
 try{
  const isReady=await isAccountReady(id);
  if(request!==state.seq)return;
  // Until a staff-provisioned account exists, leave the pre-existing public dashboard usable.
  if(!isReady){openDashboard();return}
  const session=await window.VCESupabase?.validSession();
  if(request!==state.seq)return;
  if(!session?.access_token){showForm();return}
  let isStaff=false;try{isStaff=await window.VCESupabase.isStaff()}catch{}
  if(request!==state.seq)return;
  if(isStaff){openDashboard();return}
  const identity=await api('pilot_whoami');
  if(request!==state.seq)return;
  state.identity=identity;
  if(slug(identity.pilot_slug)!==id){showForm('Ce navigateur est connecté à un autre pilote. Déconnecte ce compte pour ouvrir ce profil.');return}
  if(identity.password_change_required){showChange();return}
  openDashboard();
 }catch(e){if(request===state.seq)showForm('Connexion indisponible : '+e.message)}
}
async function signIn(e){
 e.preventDefault();const id=current(),input=$('vce-pilot-secret'),secret=input.value;
 const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 show('Vérification des identifiants…');
 try{
  if(!id)throw Error('Sélectionne ton profil pilote.');
  await window.VCESupabase.login(internalEmail(id),secret);
  input.value='';
  await route();
 }catch(err){showForm('Connexion impossible : '+err.message)}
 finally{button.disabled=false}
}
async function changePassword(e){
 e.preventDefault();const password=$('vce-pilot-new').value,confirmation=$('vce-pilot-confirm').value;
 const id=current(),button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 try{
  if(password!==confirmation)throw Error('Les deux mots de passe sont différents.');
  if(password.length<12)throw Error('12 caractères minimum.');
  await api('pilot_change_password',{new_password:password});
  $('vce-pilot-new').value='';$('vce-pilot-confirm').value='';
  // Supabase may revoke the previous token on password change: establish a fresh session.
  await window.VCESupabase.login(internalEmail(id),password);
  await route();
 }catch(err){showChange();$('vce-pilot-auth-message').textContent='Modification impossible : '+err.message}
 finally{button.disabled=false}
}
function start(){mount();route();window.addEventListener('hashchange',route)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
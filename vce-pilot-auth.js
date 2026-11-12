/* VCE PILOTE — verified Supabase Auth gate, no localStorage password and no trust in URL identity. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const internalEmail=id=>'vce-pilote+'+id+'@virtual-center-experience.fr';
const state={checked:'',seq:0,identity:null,verified:'',verification:null,verificationId:'',inFlightStatus:new Map()};
window.VCEPilotAuthCanAccess=id=>state.verified===slug(id)&&Boolean(id);
let card=null;
const current=()=>slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''));
const cfg=()=>window.VCE_SUPABASE||{};
function lock(value){document.documentElement.classList.toggle('vce-pilot-auth-locked',value);const el=$('pilotDashboard');if(el)el.style.setProperty('display',value?'none':'block','important')}
async function accountStatus(id){
 if(state.inFlightStatus.has(id))return state.inFlightStatus.get(id);
 const promise=(async()=>{
  const config=cfg();
  if(!window.VCESupabase?.configured())throw Error('Supabase indisponible');
  const response=await fetch(config.url+'/functions/v1/vce-telemetry',{
   method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
   headers:{apikey:config.key,'Content-Type':'application/json'},
   body:JSON.stringify({action:'pilot_account_ready',pilot_slug:id})
  });
  if(!response.ok)throw Error('Vérification serveur HTTP '+response.status);
  const body=await response.json();
  if(typeof body?.ready!=='boolean'||(body.listed!==null&&body.listed!==undefined&&typeof body.listed!=='boolean'))throw Error('Réponse de vérification incomplète');
  return {ready:body.ready,listed:body.listed};
 })().finally(()=>state.inFlightStatus.delete(id));
 state.inFlightStatus.set(id,promise);
 return promise;
}
async function api(action,extra={}){
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Session de connexion absente');
 const config=cfg();if(!window.VCESupabase.configured())throw Error('Supabase non configuré');
 const r=await fetch(config.url+'/functions/v1/vce-telemetry',{
  method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:config.key,Authorization:'Bearer '+session.access_token,
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
 '<label class="vce-remember-pilot"><input id="vce-pilot-remember" type="checkbox"> Rester connecté (ordinateur personnel uniquement)</label>'+
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
 lock(true);
 // Open the credential form immediately, without waiting for Edge cold starts.
 // Server checks still gate all access to the dashboard.
 showForm('Saisis ton code ou ton mot de passe. Vérification du profil en arrière-plan…');
 const accessPromise=accountStatus(id).then(value=>({value}),error=>({error}));
 try{
  const session=await window.VCESupabase?.validSession().catch(err=>{if(err?.message)showForm('Connexion au serveur perturbée : '+err.message);return null});
  if(request!==state.seq)return;
  if(!session?.access_token){
   accessPromise.then(result=>{
    if(request!==state.seq||state.verified)return;
    if(result.value?.listed===false)showForm('Ce pilote ne figure plus dans l’effectif actif. Contacte le STAFF.');
    else if(result.value?.ready===false)showForm('Profil non activé. Demande un code d’accès au STAFF.');
    else if(result.error)showForm('Le contrôle du compte est momentanément indisponible. Tu peux réessayer de te connecter.');
    else showForm();
   });
   return;
  }
  // Concurrent authorization checks: no login bypass when an API is slow.
  const [accessResult,staffResult,identityResult]=await Promise.all([
   accessPromise,
   window.VCESupabase.isStaff().then(value=>({value}),error=>({error})),
   api('pilot_whoami').then(value=>({value}),error=>({error}))
  ]);
  if(request!==state.seq)return;
  if(accessResult.error)throw accessResult.error;
  const access=accessResult.value;
  if(access?.listed!==true){
   showForm('Ce pilote a été retiré de l’équipe ou la liste active est indisponible. Contacte le STAFF.');
   return;
  }
  if(staffResult.value===true){openDashboard();return}
  if(!access.ready){
   showForm('Ce compte pilote doit être activé par le STAFF avant la connexion.');
   return;
  }
  if(identityResult.error)throw identityResult.error;
  const identity=identityResult.value;
  state.identity=identity;
  if(slug(identity?.pilot_slug)!==id){
   showForm('Ce navigateur est connecté à un autre pilote. Déconnecte ce compte pour ouvrir ce profil.');
   return;
  }
  if(identity.password_change_required){showChange();return}
  openDashboard();
 }catch(e){if(request===state.seq)showForm('Vérification impossible : '+e.message)}
}
async function signIn(e){
 e.preventDefault();const id=current(),input=$('vce-pilot-secret'),secret=input.value;
 const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 show('Vérification des identifiants…');
 try{
  if(!id)throw Error('Sélectionne ton profil pilote.');
  await window.VCESupabase.login(internalEmail(id),secret,{remember:$('vce-pilot-remember')?.checked===true});
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
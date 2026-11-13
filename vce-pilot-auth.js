/* VCE PILOTE — verified Supabase Auth gate, no localStorage password and no trust in URL identity. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const internalEmail=id=>'vce-pilote+'+id+'@virtual-center-experience.fr';
const state={seq:0,verified:'',retry:null};
window.VCEPilotAuthCanAccess=id=>state.verified===slug(id)&&Boolean(id);
let card=null;
const spectatorRequested=location.pathname.endsWith('/pilote.html')&&new URLSearchParams(location.search).get('view')==='spectateur';
const current=()=>{try{return slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''))}catch{return ''}};
const cfg=()=>window.VCE_SUPABASE||{};
function lock(value){document.documentElement.classList.toggle('vce-pilot-auth-locked',value);const el=$('pilotDashboard');if(el)el.style.setProperty('display',value?'none':'block','important')}
async function api(action,extra={}){
 const session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Session de connexion absente');
 const config=cfg();if(!window.VCESupabase.configured())throw Error('Supabase non configuré');
 const send=token=>fetch(config.url+'/functions/v1/vce-telemetry',{
  method:'POST',signal:AbortSignal.timeout(14000),headers:{apikey:config.key,Authorization:'Bearer '+token,
    'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,...extra})
 });
 let r=await send(session.access_token);
 if(action==='pilot_whoami'&&r.status===401){
  const latest=window.VCESupabase.session();
  if(latest){
   const fresh=latest.access_token!==session.access_token?latest:await window.VCESupabase.validSession(true);
   if(fresh)r=await send(fresh.access_token);
  }
 }
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
 '<div class="vce-login-actions"><button type="button" id="vce-pilot-retry" hidden>Réessayer ma session</button><button type="button" id="vce-pilot-reconnect" hidden>Déconnecter ce compte</button>'+
 '<a href="pilote.html" id="vce-pilot-auth-back">← Retour à la liste des pilotes</a></div></section>';
 document.body.append(card);
 $('vce-pilot-login-form').addEventListener('submit',signIn);
 $('vce-pilot-change-form').addEventListener('submit',changePassword);
 $('vce-pilot-retry').onclick=()=>route();
 $('vce-pilot-reconnect').onclick=()=>{window.VCESupabase?.logout();showForm('Compte déconnecté. Connecte-toi avec les identifiants de ce pilote.')};
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
 $('vce-pilot-retry').hidden=!window.VCESupabase?.session();
}
function showSpectatorStatus(message){
 show(message);
 $('vce-pilot-login-form').hidden=true;
 $('vce-pilot-change-form').hidden=true;
 $('vce-pilot-reconnect').hidden=true;
 $('vce-pilot-retry').hidden=!window.VCESupabase?.session();
 $('vce-pilot-auth-back').href='staff.html#staff-administratif';
 $('vce-pilot-auth-back').textContent='← Retour au Staff';
}
function showChange(){
 show('Pour protéger ta télémétrie, choisis un mot de passe personnel à la première connexion.');
 $('vce-pilot-login-form').hidden=true;$('vce-pilot-change-form').hidden=false;
 $('vce-pilot-reconnect').hidden=false;
}
function openDashboard(spectator=false){
 document.documentElement.classList.toggle('vce-pilot-spectator',spectator);
 state.verified=current();card.hidden=true;lock(false);
 // The existing profile router handles visible data and navigation.
 window.dispatchEvent(new Event('vce-pilot-verified'));
}
async function route(){
 clearTimeout(state.retry);
 const id=current(),request=++state.seq;
 if(state.verified===id&&id&&window.VCESupabase?.session())return;
 state.verified='';
 document.documentElement.classList.remove('vce-pilot-spectator');
 lock(true);
 if(!id){if(card)card.hidden=true;return}
 const supabase=window.VCESupabase;
 const showStatus=spectatorRequested?showSpectatorStatus:showForm;
 if(!supabase?.session()){
  showStatus(spectatorRequested?'Connecte-toi au Staff pour ouvrir ce profil en vue spectateur.':'');
  return;
 }
 showStatus('Vérification de la session…');
 try{
  const session=await supabase.validSession();
  if(request!==state.seq)return;
  if(!session){showStatus();return}
  // The server already verifies the selected pilot’s active account and roster.
  let identity=null,identityError=null;
  if(!spectatorRequested){
   try{identity=await api('pilot_whoami')}catch(error){identityError=error}
   if(request!==state.seq)return;
   if(slug(identity?.pilot_slug)===id){
    if(identity.password_change_required)showChange();else openDashboard();
    return;
   }
  }
  const staff=await supabase.isStaff();
  if(request!==state.seq)return;
  if(staff){
   const roster=await supabase.read('pilotes');
   if(request!==state.seq)return;
   if(!Array.isArray(roster?.items))throw Error('Effectif momentanément indisponible.');
   if(roster.items.some(pilot=>slug(pilot?.id)===id)){openDashboard(spectatorRequested);return}
   showStatus('Ce pilote ne figure plus dans l’effectif actif.');
   return;
  }
  if(spectatorRequested){showStatus('La vue spectateur est réservée au Staff.');return}
  if(identityError)throw identityError;
  showForm('Ce navigateur est connecté à un autre compte. Déconnecte ce compte pour ouvrir ce profil.');
 }catch(error){
  if(request!==state.seq)return;
  if(!supabase.session()){showStatus('Session expirée. Reconnecte-toi.');return}
  showStatus('Vérification momentanément indisponible : '+error.message);
  state.retry=setTimeout(()=>{if(!document.hidden&&request===state.seq)route()},15000);
 }
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
function start(){
 mount();route();
 window.addEventListener('hashchange',route);
 window.addEventListener('online',()=>{if(!state.verified&&window.VCESupabase?.session())route()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.verified&&window.VCESupabase?.session())route()});
 window.addEventListener('vce-auth-session-ended',()=>{
  state.verified='';
  route();
  window.dispatchEvent(new Event('vce-pilot-verified'));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
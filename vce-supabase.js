(function(){
'use strict';
const cfg=window.VCE_SUPABASE||{},key='vce_supabase_session';
const configured=()=>/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.url)&&cfg.key&&!cfg.key.startsWith('VOTRE_');
// By default, a session lasts for this tab only. Users on personal devices may
// explicitly opt into browser persistence, mirroring supabase-js persistSession.
// Never persist passwords; both stores contain ONLY Supabase-issued session tokens.
function localStore(){try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}}
function getStored(k,storage){try{return storage?.getItem(k)||null}catch{return null}}
function delStored(k,storage){try{storage?.removeItem(k)}catch{}}
function session(){
 const raw=getStored(key,sessionStorage)||getStored(key,localStore());
 if(!raw)return null;
 try{const data=JSON.parse(raw);return data&&data.access_token&&data.refresh_token?data:null}catch{return null}
}
function rememberCurrentSession(){return !getStored(key,sessionStorage)&&!!getStored(key,localStore())}
function saveSession(data,remember=false){
 const raw=JSON.stringify(data);
 if(remember&&localStore()){
  try{localStore().setItem(key,raw);delStored(key,sessionStorage);return true}catch{}
 }
 try{sessionStorage.setItem(key,raw);delStored(key,localStore());return false}catch{throw Error('Le navigateur bloque le stockage de session. Autorise le stockage pour ce site.')}
}
let refreshPromise=null;
const inFlightReads=new Map();
const requestTimeout=14000;
let staffCheck=null, staffCacheUntil=0, staffPromise=null;
function clearStaffCache(){staffCheck=null;staffCacheUntil=0;staffPromise=null}
async function validSession(){
 const d=session();if(!d)return null;
 if(d.expires_at&&d.expires_at*1000>Date.now()+60000)return d;
 if(!d.refresh_token){logout();throw Error('Session expirée. Reconnecte-toi.')}
 if(!refreshPromise)refreshPromise=(async()=>{
  const keep=rememberCurrentSession();
  let r;
  try{
   r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',signal:AbortSignal.timeout(requestTimeout),
    headers:{apikey:cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:d.refresh_token})
   });
  }catch(err){
   // Never sign out a valid user because Supabase Auth is restarting or offline.
   throw Error('Supabase Auth momentanément indisponible : session conservée. Réessaie lorsque le serveur répond.');
  }
  if(!r.ok){
   if([400,401,403].includes(r.status)){
    // Another open tab may have already rotated the single-use refresh token.
    const current=session();
    if(current?.refresh_token&&current.refresh_token!==d.refresh_token)return current;
    logout();throw Error('Session expirée ou révoquée. Reconnecte-toi.');
   }
   throw Error('Renouvellement de session indisponible (Supabase HTTP '+r.status+'). La session locale a été conservée.');
  }
  const next=await r.json().catch(()=>null);
  if(!next?.access_token||!next?.refresh_token||!Number.isFinite(next.expires_in))
   throw Error('Réponse de renouvellement Supabase incomplète. Session conservée.');
  next.expires_at=Math.floor(Date.now()/1000)+next.expires_in;
  const latest=session();
  if(latest?.refresh_token&&latest.refresh_token!==d.refresh_token)return latest;
  saveSession(next,keep);return next;
 })().finally(()=>{refreshPromise=null});
 try{return await refreshPromise}
 catch(error){
  // An access JWT remains usable until its real expiry even if its refresh
  // endpoint is temporarily down. Server-side JWT and RLS still authorize it.
  if(d.expires_at&&d.expires_at*1000>Date.now()+5000&&
     /momentanément indisponible|Renouvellement de session indisponible|Réponse de renouvellement Supabase incomplète/.test(String(error?.message||'')))return d;
  throw error;
 }
}
async function request(path,opts={},auth=false){
 if(!configured())throw Error('Configurer vce-supabase-config.js');
 const token=auth?(await validSession())?.access_token:null;
 if(auth&&!token)throw Error('Connectez-vous en STAFF.');
 // Publishable keys (sb_publishable_*) are NOT JWTs. Only a real Auth session belongs in Authorization.
 const credentials={apikey:cfg.key,...(token?{Authorization:'Bearer '+token}:/^sb_publishable_/.test(cfg.key)?{}:{Authorization:'Bearer '+cfg.key})};
 let r;
 try{r=await fetch(cfg.url+path,{...opts,signal:opts.signal||AbortSignal.timeout(requestTimeout),cache:'no-store',headers:{...credentials,...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}})}
 catch(e){if(e?.name==='TimeoutError'||e?.name==='AbortError'||/timed out|timeout/i.test(String(e?.message||'')))throw Error('Délai dépassé : le serveur Supabase ne répond pas. Réessaie après rétablissement du service.');throw Error('Serveur Supabase injoignable : '+String(e?.message||'erreur réseau'))}
 if(!r.ok){let t=await r.text().catch(()=>''),endpoint=path.startsWith('/auth/v1/');if(endpoint&&r.status>=500)throw Error('Service de connexion Supabase indisponible (HTTP '+r.status+'). Les comptes ne sont pas en cause.');throw Error('Supabase HTTP '+r.status+' : '+t.slice(0,180))}
 if(r.status===204||r.status===205)return null;const body=await r.text();if(!body.trim())return null;try{return JSON.parse(body)}catch{throw Error('Réponse Supabase invalide (HTTP '+r.status+')')}
}
async function login(email,password,options={}){
 let d;
 // A retry is only allowed for server/network failures, never for wrong passwords.
 for(let attempt=0;attempt<2;attempt++){
  try{d=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});break}
  catch(err){
   const msg=String(err?.message||'');
   const transient=/Service de connexion Supabase indisponible|Délai dépassé|Serveur Supabase injoignable|signal timed out|HTTP 50[0234]/i.test(msg);
   if(attempt===1||!transient)throw err;
   // Avoid firing two password requests simultaneously during a restart.
   await new Promise(resolve=>setTimeout(resolve,900));
  }
 }
 if(!d?.access_token||!d?.refresh_token||!Number.isFinite(d.expires_in))
  throw Error('Réponse de connexion incomplète de Supabase.');
 d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;
 saveSession(d,options?.remember===true);
 clearStaffCache();return d
}
function logout(){
 window.dispatchEvent(new Event('vce-pilot-presence-logout'));
 delStored(key,sessionStorage);delStored(key,localStore());
 clearStaffCache();inFlightReads.clear()
}
async function read(kind){
 if(inFlightReads.has(kind))return inFlightReads.get(kind);
 const task=(async()=>{const a=await request('/rest/v1/vce_publications?kind=eq.'+encodeURIComponent(kind)+'&select=payload');return a[0]?.payload||{version:1,presets:[]}})().finally(()=>inFlightReads.delete(kind));
 inFlightReads.set(kind,task);
 return task;
}
async function save(kind,payload){return request('/rest/v1/vce_publications?on_conflict=kind',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({kind,payload,updated_at:new Date().toISOString()})},true)}
async function isStaff(){
 if(!session()){clearStaffCache();return false}
 if(staffCheck!==null&&Date.now()<staffCacheUntil)return staffCheck;
 if(staffPromise)return staffPromise;
 staffPromise=(async()=>{const r=await request('/rest/v1/rpc/vce_is_staff',{method:'POST',body:'{}'},true);staffCheck=r===true;staffCacheUntil=Date.now()+20000;return staffCheck})().finally(()=>{staffPromise=null});
 return staffPromise;
}
async function reviews(){return request('/rest/v1/vce_training_reviews?select=session_id,pilot,decision,reviewed_at&order=reviewed_at.asc')}
async function review(session_id,pilot,decision){
 if(!['approved','rejected'].includes(decision))throw Error('Décision invalide');
 if(!session_id||!pilot)throw Error('Séance ou pilote manquant');
 const rows=await request('/rest/v1/vce_training_reviews?on_conflict=session_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({session_id,pilot,decision})},true);
 return rows?.[0]||null;
}
async function submitTraining(item){if(!item?.id||!item?.driver)throw Error('Séance invalide');return request('/rest/v1/vce_training_submissions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({session_id:String(item.id),pilot:String(item.driver),payload:item})})}
async function trainingSubmissions(){return request('/rest/v1/vce_training_submissions?select=session_id,pilot,payload,submitted_at&order=submitted_at.desc',{},true)}
// New endpoints are deliberately read-only: no automatic writes or account migrations.
const services=new Set(['vce-pilot-accounts','vce-roster-sync','vce-training','vce-team','vce-telemetry-history','vce-pilot-presence']);
async function serviceRead(name){if(!services.has(name))throw Error('Service inconnu');return request('/functions/v1/'+name,{method:'GET'},true)}
async function healthCheck(){return request('/functions/v1/vce-system-health',{method:'GET'})}
window.VCESupabase={configured,login,logout,session,validSession,read,save,isStaff,reviews,review,submitTraining,trainingSubmissions,serviceRead,healthCheck};
})();

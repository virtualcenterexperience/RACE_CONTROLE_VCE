(function(){
'use strict';
const cfg=window.VCE_SUPABASE||{},key='vce_supabase_session';
const configured=()=>/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.url)&&cfg.key&&!cfg.key.startsWith('VOTRE_');
// By default, a session lasts for this tab only. Users on personal devices may
// explicitly opt into browser persistence, mirroring supabase-js persistSession.
// Never persist passwords; both stores contain ONLY Supabase-issued session tokens.
function tabStore(){try{return globalThis.sessionStorage}catch{return null}}
function localStore(){try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}}
function getStored(k,storage){try{return storage?.getItem(k)||null}catch{return null}}
function delStored(k,storage){try{storage?.removeItem(k)}catch{}}
function session(){
 const raw=getStored(key,tabStore())||getStored(key,localStore());
 if(!raw)return null;
 try{const data=JSON.parse(raw);return data&&data.access_token&&data.refresh_token?data:null}catch{return null}
}
function rememberCurrentSession(){return !getStored(key,tabStore())&&!!getStored(key,localStore())}
function saveSession(data,remember=false){
 const raw=JSON.stringify(data);
 if(remember&&localStore()){
  try{localStore().setItem(key,raw);delStored(key,tabStore());return true}catch{}
 }
 try{const storage=tabStore();if(!storage)throw Error('Stockage absent');storage.setItem(key,raw);delStored(key,localStore());return false}catch{throw Error('Le navigateur bloque le stockage de session. Autorise le stockage pour ce site.')}
}
let refreshPromise=null;
let refreshBackoff=null;
let sessionGeneration=0;
const inFlightReads=new Map();
const requestTimeout=14000;
let staffCheck=null,staffCacheUntil=0,staffPromise=null,staffIdentity=null;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transientStatus=status=>[408,425,429,500,502,503,504].includes(status);
const authTimeout=22000;
function clearStaffCache(){staffCheck=null;staffCacheUntil=0;staffPromise=null}
const sessionId=data=>{
 try{
  const payload=data.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const claims=JSON.parse(atob(payload));
  return claims.session_id||null;
 }catch{return null}
};
async function renewSession(previous,force){
 const current=session();
 if(!current||current.refresh_token!==previous.refresh_token)return current;
 const remaining=()=>current.expires_at*1000-Date.now();
 if(!force&&remaining()>60000)return current;
 if(refreshBackoff?.token===current.refresh_token&&Date.now()<refreshBackoff.until){
  if(!force&&remaining()>5000)return current;
  throw refreshBackoff.error;
 }
 const generation=sessionGeneration;
 const keep=rememberCurrentSession();
 const sameSession=()=>generation===sessionGeneration&&session()?.refresh_token===current.refresh_token;
 const transient=new Error('Renouvellement temporairement indisponible. La session sera réessayée automatiquement.');
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{
   response=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',signal:AbortSignal.timeout(authTimeout),cache:'no-store',
    headers:{apikey:cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:current.refresh_token})
   });
  }catch{}
  const body=await response?.json().catch(()=>null);
  if(!sameSession())return generation===sessionGeneration?session():null;
  if(response?.ok&&body?.access_token&&body?.refresh_token&&Number.isFinite(body.expires_in)){
   body.expires_at=Math.floor(Date.now()/1000)+body.expires_in;
   saveSession(body,keep);
   refreshBackoff=null;
   return body;
  }
  const code=body?.error_code||body?.code;
  if([400,401,403].includes(response?.status)&&
     ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_not_found','user_banned'].includes(code)){
   logout();
   throw Error('Session expirée ou révoquée. Reconnecte-toi.');
  }
  if(response&&!response.ok&&!transientStatus(response.status))break;
  if(attempt===0){
   await delay(900);
   if(!sameSession())return generation===sessionGeneration?session():null;
  }
 }
 refreshBackoff={token:current.refresh_token,until:Date.now()+10000,error:transient};
 if(!force&&remaining()>5000)return current;
 throw transient;
}
async function validSession(force=false){
 const current=session();
 if(!current)return null;
 if(!force&&current.expires_at*1000>Date.now()+60000)return current;
 const id=sessionId(current);
 if(refreshPromise?.token===current.refresh_token)return refreshPromise.task;
 const locks=globalThis.navigator?.locks;
 const task=(id&&locks?locks.request('vce-auth-refresh:'+id,()=>renewSession(current,force)):renewSession(current,force))
  .finally(()=>{if(refreshPromise?.task===task)refreshPromise=null});
 refreshPromise={token:current.refresh_token,task};
 return task;
}
async function request(path,opts={},auth=false){
 if(!configured())throw Error('Configurer vce-supabase-config.js');
 const initial=auth?await validSession():null;
 const token=initial?.access_token;
 if(auth&&!token)throw Error('Connectez-vous en STAFF.');
 const retryable=(!opts.method||opts.method==='GET'||path==='/rest/v1/rpc/vce_is_staff')&&!opts.signal;
 const generation=sessionGeneration;
 async function send(accessToken){
  const credentials={apikey:cfg.key,...(accessToken?{Authorization:'Bearer '+accessToken}:/^sb_publishable_/.test(cfg.key)?{}:{Authorization:'Bearer '+cfg.key})};
  return fetch(cfg.url+path,{...opts,signal:opts.signal||AbortSignal.timeout(path.startsWith('/auth/v1/')?authTimeout:requestTimeout),cache:'no-store',headers:{...credentials,...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
 }
 let r;
 try{
  try{r=await send(token)}
  catch(error){if(!retryable)throw error}
  if(retryable&&(!r||transientStatus(r.status))){
   await delay(700);
   const renewed=auth?await validSession():null;
   if(auth&&(generation!==sessionGeneration||!renewed))throw Error('Session modifiée.');
   r=await send(auth?renewed.access_token:token);
  }
 }catch(e){if(e?.name==='TimeoutError'||e?.name==='AbortError'||/timed out|timeout/i.test(String(e?.message||'')))throw Error('Délai dépassé : Supabase ne répond pas.');throw Error('Supabase indisponible : '+String(e?.message||'erreur réseau'))}
 if(auth&&r.status===401&&generation===sessionGeneration&&session()){
  const latest=session();
  const renewed=latest.access_token!==token?latest:await validSession(true);
  if(renewed&&generation===sessionGeneration)r=await send(renewed.access_token);
 }
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
   const transient=/Service de connexion Supabase indisponible|Délai dépassé|Supabase indisponible|signal timed out|HTTP 50[0234]/i.test(msg);
   if(attempt===1||!transient)throw err;
   // Avoid firing two password requests simultaneously during a restart.
   await new Promise(resolve=>setTimeout(resolve,900));
  }
 }
 if(!d?.access_token||!d?.refresh_token||!Number.isFinite(d.expires_in))
  throw Error('Réponse de connexion incomplète de Supabase.');
 d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;
 sessionGeneration++;
 saveSession(d,options?.remember===true);
 refreshBackoff=null;
 clearStaffCache();return d
}
function logout(){
 sessionGeneration++;
 refreshBackoff=null;
 window.dispatchEvent(new Event('vce-pilot-presence-logout'));
 delStored(key,tabStore());delStored(key,localStore());
 clearStaffCache();inFlightReads.clear();
 window.dispatchEvent(new Event('vce-auth-session-ended'));
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
 const current=session();
 const identity=sessionId(current)||current.refresh_token;
 if(staffIdentity!==identity){clearStaffCache();staffIdentity=identity}
 if(staffCheck!==null&&Date.now()<staffCacheUntil)return staffCheck;
 if(staffPromise)return staffPromise;
 const generation=sessionGeneration;
 const id=sessionId(session());
 const task=request('/rest/v1/rpc/vce_is_staff',{method:'POST',body:'{}'},true).then(result=>{
  if(generation!==sessionGeneration||!session()||(id&&sessionId(session())!==id))return false;
  if(typeof result!=='boolean')throw Error('Vérification des droits incomplète.');
  staffCheck=result;staffCacheUntil=Date.now()+20000;return result;
 }).finally(()=>{if(staffPromise===task)staffPromise=null});
 staffPromise=task;
 return task;
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
window.addEventListener('storage',event=>{
 if(event.key!==key||event.storageArea!==localStore()||getStored(key,tabStore())||!event.oldValue)return;
 let previous;
 try{previous=JSON.parse(event.oldValue)}catch{return}
 const current=session();
 if(current&&sessionId(previous)&&sessionId(previous)===sessionId(current))return;
 sessionGeneration++;
 refreshBackoff=null;
 clearStaffCache();
 window.dispatchEvent(new Event('vce-auth-session-ended'));
});
window.VCESupabase={configured,login,logout,session,validSession,read,save,isStaff,reviews,review,submitTraining,trainingSubmissions,serviceRead,healthCheck};
})();

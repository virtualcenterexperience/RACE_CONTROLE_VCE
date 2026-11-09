(function(){
'use strict';
const cfg=window.VCE_SUPABASE||{},key='vce_supabase_session';
const configured=()=>/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.url)&&cfg.key&&!cfg.key.startsWith('VOTRE_');
function session(){try{return JSON.parse(sessionStorage.getItem(key))}catch{return null}}
let refreshPromise=null;
let staffCheck=null, staffCacheUntil=0, staffPromise=null;
function clearStaffCache(){staffCheck=null;staffCacheUntil=0;staffPromise=null}
async function validSession(){
 const d=session();if(!d)return null;
 if(!d.expires_at||d.expires_at*1000>Date.now()+60000)return d;
 if(!d.refresh_token){logout();throw Error('Session expirée. Reconnecte-toi.')}
 if(!refreshPromise)refreshPromise=(async()=>{
  const r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:d.refresh_token})});
  if(!r.ok){logout();throw Error('Session expirée. Reconnecte-toi.')}
  const next=await r.json();next.expires_at=Math.floor(Date.now()/1000)+next.expires_in;sessionStorage.setItem(key,JSON.stringify(next));return next;
 })().finally(()=>{refreshPromise=null});
 return refreshPromise;
}
async function request(path,opts={},auth=false){
 if(!configured())throw Error('Configurer vce-supabase-config.js');
 const token=auth?(await validSession())?.access_token:null;
 if(auth&&!token)throw Error('Connectez-vous en STAFF.');
 const r=await fetch(cfg.url+path,{...opts,cache:'no-store',headers:{apikey:cfg.key,Authorization:'Bearer '+(token||cfg.key),...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
 if(!r.ok){let t=await r.text();throw Error('Supabase HTTP '+r.status+' : '+t.slice(0,180))}
 if(r.status===204||r.status===205)return null;const body=await r.text();if(!body.trim())return null;try{return JSON.parse(body)}catch{throw Error('Réponse Supabase invalide (HTTP '+r.status+')')}
}
async function login(email,password){const d=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;sessionStorage.setItem(key,JSON.stringify(d));clearStaffCache();return d}
function logout(){sessionStorage.removeItem(key);clearStaffCache()}
async function read(kind){const a=await request('/rest/v1/vce_publications?kind=eq.'+encodeURIComponent(kind)+'&select=payload');return a[0]?.payload||{version:1,presets:[]}}
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
window.VCESupabase={configured,login,logout,session,validSession,read,save,isStaff,reviews,review,submitTraining,trainingSubmissions};
})();

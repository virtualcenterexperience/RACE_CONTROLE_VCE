(function(){
'use strict';
const cfg=window.VCE_SUPABASE||{},key='vce_supabase_session';
const configured=()=>/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.url)&&cfg.key&&!cfg.key.startsWith('VOTRE_');
function session(){try{return JSON.parse(sessionStorage.getItem(key))}catch{return null}}
async function request(path,opts={},auth=false){
 if(!configured())throw Error('Configurer vce-supabase-config.js');
 const token=auth?session()?.access_token:null;
 if(auth&&!token)throw Error('Connectez-vous en STAFF.');
 const r=await fetch(cfg.url+path,{...opts,cache:'no-store',headers:{apikey:cfg.key,Authorization:'Bearer '+(token||cfg.key),...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
 if(!r.ok){let t=await r.text();throw Error('Supabase HTTP '+r.status+' : '+t.slice(0,180))}
 return r.status===204?null:r.json();
}
async function login(email,password){const d=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});sessionStorage.setItem(key,JSON.stringify(d));return d}
function logout(){sessionStorage.removeItem(key)}
async function read(kind){const a=await request('/rest/v1/vce_publications?kind=eq.'+encodeURIComponent(kind)+'&select=payload');return a[0]?.payload||{version:1,presets:[]}}
async function save(kind,payload){return request('/rest/v1/vce_publications?on_conflict=kind',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({kind,payload,updated_at:new Date().toISOString()})},true)}
window.VCESupabase={configured,login,logout,session,read,save};
})();

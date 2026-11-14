/* VCE — authenticated driver website presence.
   Server timestamps and RLS; per-auth-session, no telemetry-agent conflation. */
(()=>{'use strict';
 const INTERVAL=120_000, cfg=()=>window.VCE_SUPABASE||{};
 let verified=false,busy=false,done=false,loop=null;
 async function call(method,{keepalive=false}={}){
  const supa=window.VCESupabase;
  if(!supa?.configured())return false;
  // Never use an anonymous key as a fabricated pilot identity.
  const session=await supa.validSession().catch(()=>null);
  if(!session?.access_token)return false;
  const c=cfg();
  const res=await fetch(c.url+'/rest/v1/rpc/'+method,{
   method:'POST',cache:'no-store',keepalive,
   ...(keepalive?{}:{signal:AbortSignal.timeout(8000)}),
   headers:{apikey:c.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
   body:'{}'
  });
  if(!res.ok)throw Error('Présence VCE HTTP '+res.status);
  return (await res.json().catch(()=>false))===true;
 }
 async function heartbeat(force=false){
  if(!verified||document.hidden||busy||done||!window.VCEPilotAuthCanAccess?.(currentPilot()))return;
  if(!force&&loop)return;
  clearTimeout(loop);
  busy=true;
  try{await call('vce_touch_pilot_presence')}
  catch(e){console.warn('Présence pilote indisponible',e.message)}
  finally{
   busy=false;
   if(verified&&!done)loop=setTimeout(()=>{loop=null;heartbeat()},INTERVAL)
  }
 }
 function currentPilot(){try{return decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||'').trim().toLowerCase()}catch{return ''}}
 function onVerified(){
  if(document.documentElement.classList.contains('vce-pilot-spectator')){verified=false;return}
  verified=true;done=false;
  heartbeat(true);
 }
 function disconnect(){
  if(done||!verified)return;
  done=true;verified=false;clearTimeout(loop);loop=null;
  // Capture the JWT synchronously, before logout clears sessionStorage.
  const c=cfg(),token=window.VCESupabase?.session()?.access_token;
  if(!c.url||!c.key||!token)return;
  fetch(c.url+'/rest/v1/rpc/vce_disconnect_pilot_presence',{
   method:'POST',cache:'no-store',keepalive:true,
   headers:{apikey:c.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:'{}'
  }).catch(()=>{});
 }
 window.addEventListener('vce-pilot-verified',onVerified);
 window.addEventListener('vce-pilot-presence-logout',disconnect);
 window.addEventListener('pagehide',disconnect);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)heartbeat()});
 // If this script is loaded after auth has already unlocked, catch the state.
 if(window.VCEPilotAuthCanAccess?.(currentPilot()))onVerified();
})();
/* RACE CONTROL VCE: training cache generation.
 * Only local training drafts/assignments are invalidated after a STAFF reset.
 * All server-sourced course results, pilots, telemetry and photos are untouched.
 */
(()=>{'use strict';
 const cfg=()=>window.VCE_SUPABASE||{};
 const generationKey='vce_training_cache_generation_v1';
 const keys=['vce_training_assignments_v1','vce_staff_training_drafts_v1'];
 let inProgress=false,checkedAt=0;
 async function sync(){
  if(inProgress||Date.now()-checkedAt<10000)return;
  const c=cfg();if(!c.url||!c.key)return;
  inProgress=true;checkedAt=Date.now();
  try{
   const response=await fetch(c.url+'/rest/v1/vce_training_control?id=eq.1&select=cycle',{headers:{apikey:c.key},cache:'no-store'});
   if(!response.ok)throw Error('Cycle HTTP '+response.status);
   const rows=await response.json();
   const generation=rows?.[0]?.cycle;
   if(!Number.isInteger(generation)||generation<0)return;
   const previous=Number(localStorage.getItem(generationKey));
   const exists=localStorage.getItem(generationKey)!==null;
   const changed=(exists&&Number.isInteger(previous)&&previous!==generation)||(!exists&&generation>0);
   if(changed){
    const data={savedAt:new Date().toISOString(),previousGeneration:exists?previous:null,generation,entries:{}};
    for(const key of keys){const value=localStorage.getItem(key);if(value!==null)data.entries[key]=value}
    if(Object.keys(data.entries).length){
     try{localStorage.setItem('vce_training_local_cache_'+Date.now(),JSON.stringify(data))}
     catch(e){console.warn('Cache local saturé, les données cloud restent dans Supabase',e);return}
    }
    for(const key of keys)localStorage.removeItem(key);
    for(let i=localStorage.length-1;i>=0;i--){
     const key=localStorage.key(i);
     if(key?.startsWith('vce_read_'))localStorage.removeItem(key)
    }
    localStorage.setItem(generationKey,String(generation));
    window.dispatchEvent(new CustomEvent('vce-training-cycle-reset',{detail:{generation}}));
    // Force the active training page to rebuild from the new Supabase cycle.
    if(/(?:coach-irl|entrainement-staff|pilote)\.html$/.test(location.pathname)){
     const marker='vce-training-cache-refreshed';
     if(sessionStorage.getItem(marker)!==String(generation)){
       sessionStorage.setItem(marker,String(generation));location.reload()
     }
    }
   }else localStorage.setItem(generationKey,String(generation));
  }catch(e){console.warn('CACHE entraînements : synchronisation différée',e)}
  finally{inProgress=false}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>sync(),{once:true});else sync();
 window.addEventListener('pageshow',()=>sync());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
 setInterval(()=>{if(!document.hidden)sync()},30000);
 window.VCETrainingCache={sync}
})();
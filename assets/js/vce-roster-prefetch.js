/* VCE — warm up the public pilot roster before entering the pilot dashboard.
   Only public names/slugs are cached for 2 minutes; access requires server auth. */
(()=>{'use strict';
const key='vce_verified_public_roster_v2';
try{
 const old=JSON.parse(sessionStorage.getItem(key)||'null');
 if(old&&Array.isArray(old.rows)&&Date.now()-old.at<95000)return;
}catch{}
const cfg=window.VCE_SUPABASE;
if(!cfg||!/^https:\/\/[^/]+\.supabase\.co$/.test(cfg.url||'')||!cfg.key)return;
fetch(cfg.url+'/rest/v1/vce_publications?kind=eq.pilotes&select=payload',{
 cache:'no-store',signal:AbortSignal.timeout(9000),
 headers:{apikey:cfg.key}
}).then(async r=>{
 if(!r.ok)throw Error('HTTP '+r.status);
 const rows=await r.json(),roster=rows?.[0]?.payload?.items;
 if(!Array.isArray(roster))return;
 const safe=roster.filter(p=>p&&typeof p.id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)&&typeof p.name==='string'&&p.name.trim())
  .map(p=>({id:p.id,name:p.name}));
 try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),rows:safe}))}catch{}
}).catch(()=>{/* Form selection stays usable; profile page retries directly. */});
})();
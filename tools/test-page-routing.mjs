/* VCE final static routing regression checks; never sends credentials or writes data. */
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const load=p=>readFileSync(p,"utf8");
const pages=["pilote.html","staff.html","strategie.html","endurances.html"];
const runtime={
 "pilote.html":["assets/js/vce-page-pilote-data.js","vce-supabase.js","vce-pilot-auth.js"],
 "staff.html":["assets/js/vce-page-staff-data.js","vce-supabase.js"],
 "strategie.html":["assets/js/vce-endurance-core-data.js","assets/js/vce-endurance-v19-data.js"],
 "endurances.html":["assets/js/vce-endurance-core-data.js","assets/js/vce-endurance-v19-data.js"]
};
for(const page of pages){
 const html=load(page);
 for(const asset of runtime[page]){
  assert.ok(existsSync(asset),page+" missing "+asset);
  assert.ok(html.includes(asset),page+" does not reference "+asset);
 }
 assert.ok((html.match(/\.css\?v=/g)||[]).length>=1,page+" should version its single stylesheet");
}
assert.equal(load("vce-github-config.js").includes('repo:"RACE_CONTROLE_VCE"'),true,"Current Github repository must match the deployed GitHub Pages repository");
for(const page of ["calendrier.html","calendrier-staff.html","lineup.html","lineup-staff.html","resultats.html","resultats-staff.html"]){
 const html=load(page);
 assert.ok(html.includes("vce-github-config.js?v=20261112-final"),page+" uses stale Github configuration");
 assert.ok(html.includes("vce-github-sync.js?v=20261112-final"),page+" uses stale data-sync script");
}
const pilot=load("assets/js/vce-page-pilote-data.js");
assert.ok(pilot.includes("VCEPilotAuthCanAccess"),"Never render another pilot without access check");
assert.ok(pilot.includes("__vceCached"),"Pilot datasets should use scoped in-memory cache");
const pilotSync=load("vce-pilot-sync.js");
const verification=pilotSync.indexOf("if(!p||!window.VCEPilotAuthCanAccess?.(p.id))return;");
const dataRead=pilotSync.indexOf("const [attributions,notifications,seances]=");
assert.ok(verification>=0&&dataRead>verification,"Pilot sessions/assignments must load only after verified profile access.");

assert.ok(load("pilote.html").includes("assets/js/vce-pilot-presence.js"),"Keep authenticated pilot presence.");
assert.ok(!load("pilote.html").includes('vce-pilot-presence-20261105'),"Remove obsolete anonymous Realtime presence.");
assert.ok(!load("pilote.html").includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'),"Do not load redundant CDN client on pilot dashboard.");
assert.ok(!load("pilote.html").includes("const VCE=(()=>"),"Pilot data script must not be duplicated inline");
assert.ok(!load("strategie.html").includes("const inputIds=['liveLaps'"),"Strategy must load shared controller");
assert.ok(!load("endurances.html").includes("const inputIds=['liveLaps'"),"Endurance must load shared controller");
for(const p of ["supabase/functions/vce-pilot-accounts/index.ts","supabase/functions/vce-telemetry-history/index.ts"]){
 const s=load(p);
 assert.match(s,/vce_is_staff/,"Server Staff authorization missing: "+p);
 assert.match(s,/SUPABASE_SERVICE_ROLE_KEY/,"Server authorization required: "+p);
 assert.ok(!s.includes('Access-Control-Allow-Origin":"*"'),"Open CORS is not accepted on Staff function: "+p);
}
// Telemetry ingestion must preserve every lap segment, but must not rewrite
// whole session metadata for each of the hundreds of chunks in a long stint.
const telemetrySrc=load("supabase/functions/vce-telemetry/index.ts");
const segmentStart=telemetrySrc.indexOf('if(action==="upload_segment"){');
const segmentEnd=telemetrySrc.indexOf('if(action==="live_batch"){',segmentStart);
assert.ok(segmentStart>0&&segmentEnd>segmentStart,"Upload segment handler missing");
const segmentHandler=telemetrySrc.slice(segmentStart,segmentEnd);
assert.match(segmentHandler,/if\(offset!==0&&!previous\.data\)return reply/,"Resumed chunk must require an initialized verified session");
assert.match(segmentHandler,/if\(offset===0\)\{[\s\S]*?vce_agent_sessions"\)\.upsert\(/,"Only first segment may initialize session metadata");
assert.equal((segmentHandler.match(/vce_agent_sessions"\)\.upsert\(/g)||[]).length,1,"Only one session upsert path allowed per lap transfer");
assert.match(segmentHandler,/vce_agent_lap_segments"\)\.upsert\(/,"Full segment data must still be stored");
assert.ok(!telemetrySrc.includes('db.from("vce_agent_devices").select("*")'),"Don't read unnecessary private device columns on every telemetry chunk");

console.log("PASS: data scripts, cached page loads, correct GitHub repo, Staff-protected read endpoints.");

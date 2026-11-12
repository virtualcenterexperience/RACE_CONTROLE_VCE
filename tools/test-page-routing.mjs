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
assert.ok(!load("pilote.html").includes("const VCE=(()=>"),"Pilot data script must not be duplicated inline");
assert.ok(!load("strategie.html").includes("const inputIds=['liveLaps'"),"Strategy must load shared controller");
assert.ok(!load("endurances.html").includes("const inputIds=['liveLaps'"),"Endurance must load shared controller");
for(const p of ["supabase/functions/vce-pilot-accounts/index.ts","supabase/functions/vce-telemetry-history/index.ts"]){
 const s=load(p);
 assert.match(s,/vce_is_staff/,"Server Staff authorization missing: "+p);
 assert.match(s,/SUPABASE_SERVICE_ROLE_KEY/,"Server authorization required: "+p);
 assert.ok(!s.includes('Access-Control-Allow-Origin":"*"'),"Open CORS is not accepted on Staff function: "+p);
}
console.log("PASS: data scripts, cached page loads, correct GitHub repo, Staff-protected read endpoints.");

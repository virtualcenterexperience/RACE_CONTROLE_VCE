import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('vce-pilot-sync.js','utf8');
function runtime(){
 const nodes={assignedList:{innerHTML:'',replaceChildren(){this.innerHTML=''},textContent:''}};
 const events={};let finish;
 const pending=new Promise(resolve=>finish=resolve);
 const context={window:{VCE_PILOT_ROSTER:[{id:'driver-a',name:'DRIVER A'},{id:'driver-b',name:'DRIVER B'}],VCEPilotAuthCanAccess:()=>true,VCESupabase:{read:()=>pending},addEventListener:(name,fn)=>events[name]=fn},document:{readyState:'complete',hidden:false,getElementById:id=>nodes[id]||null,addEventListener:()=>{}},location:{hash:'#driver-a',search:'',pathname:'/pilote.html'},URLSearchParams,setInterval:()=>{},localStorage:{getItem(){throw Error('blocked storage')}},console};
 runInNewContext(source,context);return {context,events,nodes,finish};
}
// Pending data for A must never render after navigating to B or logging out.
for(const change of ['hashchange','vce-auth-session-ended']){
 const r=runtime();if(change==='hashchange')r.context.location.hash='#driver-b';r.events[change]();
 r.finish({items:[{id:'a1',driver:'DRIVER A',exercise:'Old private assignment'}]});await new Promise(setImmediate);
 assert.equal(r.nodes.assignedList.innerHTML,'');
}
const r=runtime();r.finish({items:[{id:'cloud',pilotSlug:'driver-a',driver:'Renamed Driver',exercise:'Cloud exercise',circuit:'Spa',car:'GT3',laps:5},{id:'b',pilotSlug:'driver-b',driver:'DRIVER B',exercise:'Other driver'}]});await new Promise(setImmediate);
assert.match(r.nodes.assignedList.innerHTML,/Cloud exercise/);assert.doesNotMatch(r.nodes.assignedList.innerHTML,/Other driver/);
assert.ok(r.events['vce-roster-updated'],'Roster arriving after authentication must refresh assignments');
const profile=readFileSync('assets/js/vce-page-pilote-data.js','utf8');assert.doesNotMatch(profile,/function showAssignments/,'No second local writer may erase cloud assignments');
const norm=s=>String(s).replaceAll('-',' ').toUpperCase();
const context={VCE:{norm,arr:x=>Array.isArray(x)?x:[],names:['DRIVER A','DRIVER B'],completed:({session})=>session.status==='approved'},Intl,Date,Map,Set};
runInNewContext(profile.slice(profile.indexOf('const Rating=(()=>'),profile.indexOf('async function publishedRaceEntries()'))+';globalThis.rating=Rating;',context);
const cfg={startDate:'2026-11-02',dailyTrainingPoints:3,maxRewardedSessionsPerDay:3,classes:[{code:'R',name:'ROOKIE',xpPer15Points:150,xpToNext:1000}]};
const data={seances:[...Array.from({length:4},(_,i)=>({id:'s'+i,pilot:'DRIVER A',date:'2026-11-24T12:00:00Z',status:'approved'})),{id:'pending',pilot:'DRIVER A',date:'2026-11-24T12:00:00Z',status:'submitted'},{id:'b',pilot:'DRIVER B',date:'2026-11-24T12:00:00Z',status:'approved'}]};
const records=context.rating.allRecords(data);
assert.equal(context.rating.pilotProgress(records,'DRIVER A',cfg,new Date('2026-11-24T18:00:00Z')).earned,9,'Three approved sessions per Paris day maximum; pending gives no points');
assert.equal(context.rating.pilotProgress(records,'DRIVER B',cfg,new Date('2026-11-24T18:00:00Z')).earned,3,'Other driver points stay separate');
const staff=readFileSync('entrainement-staff.html','utf8');assert.match(staff,/await publish\(item\)/);assert.match(staff,/saveTrainingAssignment/);assert.doesNotMatch(staff,/save\('training_assignments'/,'Never replace the full assignment list from a stale STAFF tab');
const coach=readFileSync('assets/js/vce-coach-irl-dashboard.js','utf8');assert.doesNotMatch(coach,/getItem\('vce_current_pilot'/);assert.match(coach,/version!==loadVersion/);assert.match(coach,/access.pilot.id!==state.pilot/);
assert.match(readFileSync('assets/js/vce-page-staff-data.js','utf8'),/pendingRaceResults\(\)/);
console.log('PASS: cloud assignments, late roster, account-change race, training points cap, atomic STAFF publication and result alerts');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const window={};runInNewContext(readFileSync('assets/js/vce-race-rating.js','utf8'),{window});
const R=window.VCERaceRating;
const row=(type,position,starters)=>({race:{scoringVersion:3,competitionType:type,starters},result:{position}});
const order=['hotlap','daily','open','esport_qualifying','championship','endurance','championship_overall','esport_race'];
assert.equal(R.delta(row('hotlap',5,20)),24);
assert.equal(R.delta(row('esport_race',5,20)),128);
assert.equal(R.delta(row('esport_race',1,20)),320);
for(const n of [2,5,20,450,1200,5000]){
 for(const type of Object.keys(R.types)){
  let prior=Infinity;
  for(let p=1;p<=n;p++){
   const points=R.delta(row(type,p,n));assert.ok(Number.isInteger(points)&&points>=1);assert.ok(points<=prior,`${type}: ${p}/${n}`);prior=points;
  }
  assert.ok(R.delta(row(type,1,n))>R.delta(row(type,2,n)),'A victory must outrank runner-up, even in very large hotlap fields');
 }
 for(const p of [1,Math.ceil(n/2),n]){
  let prior=0;for(const type of order){const points=R.delta(row(type,p,n));assert.ok(points>=prior,'Event hierarchy must never be reversed');prior=points}
 }
}
assert.equal(R.delta({...row('esport_race',1,20),result:{position:1,status:'DNF'}}),0);
assert.ok(R.delta(row('hotlap',25,1200))>R.delta(row('hotlap',15,20)),'Relative field position still matters');
const base={pilot_slug:'driver-a',event_name:'Evening',race_date:'2026-11-26',track:'Spa',category:'esport_race',finishing_position:5,starters:20,scoring_version:3};
const races=[{...base,id:'race1',race_number:1},{...base,id:'race2',race_number:2}];
const combined=R.merge({},[...races,races[0]]);assert.equal(combined.length,2,'Course 1 and Course 2 both count once');assert.equal(combined.reduce((s,r)=>s+R.delta(r),0),256);
const poster={presets:[{id:'p',published:true,data:{event:'Evening',date:base.race_date,circuit:'Spa',raceNumber:1,scoringVersion:2,results:[{firstName:'Driver',lastName:'A',position:5,eventType:'daily',scoringVersion:2}]}}]};
const merged=R.merge(poster,races);assert.equal(merged.length,2);assert.equal(R.delta(merged[0]),128,'Canonical reviewed V3 data must override older image context');
assert.equal(poster.presets[0].data.results[0].scoringVersion,2,'Cached publication is immutable');
console.log('PASS V3: hierarchy, podium, positive gains, field sizes, two-race evenings and canonical scoring');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const window={};runInNewContext(readFileSync('assets/js/vce-race-rating.js','utf8'),{window});
const R=window.VCERaceRating;
const result=(type,position,starters,version=2)=>({race:{scoringVersion:version,competitionType:type,starters},result:{position}});
assert.equal(R.delta(result('hotlap',25,1200)),85);
assert.equal(R.delta(result('daily',15,20)),3);
assert.equal(R.delta(result('esport_race',15,20)),15);
assert.equal(Object.keys(R.types).length,9);
for(const type of ['championship','daily','hotlap','esport_qualifying','esport_race','rally']){
 for(const size of [2,5,20,450,1200,5000]){
  let previous=Infinity;
  for(let p=1;p<=size;p++){
   const score=R.delta(result(type,p,size));
   assert.ok(score<=previous,`${type}: score must not improve as position worsens`);previous=score;
   assert.ok(score>=1&&score<=120);
  }
 }
 assert.ok(R.delta(result(type,1,2))<R.delta(result(type,1,20)),'A tiny grid must not earn full-field victory points');
}
assert.equal(R.delta(result('hotlap',25,1200,1)),-25,'Historical results retain the exact prior barème');
assert.equal(R.delta(result('daily',1,20,1)),100);
for(const [p,n] of [[0,20],[21,20],[2,null],[2,1],[1,5001],[1.5,20]])assert.match(R.breakdown(result('hotlap',p,n)).reason,/confirmer/);
assert.equal(R.delta({...result('esport_race',3,20),result:{position:3,status:'DNF'}}),0);
const accepted={id:'v2',pilot_slug:'driver-a',event_name:'Hotlap',race_date:'2026-11-24',track:'Spa',category:'hotlap',finishing_position:25,starters:1200,scoring_version:2};
assert.equal(R.delta(R.merge({},[accepted])[0]),85,'Accepted projection must carry category, version and field size');
const poster={presets:[{id:'poster',published:true,data:{event:'Hotlap',date:'2026-11-24',circuit:'Spa',results:[{firstName:'Driver',lastName:'A',position:25}]}}]};
const merged=R.merge(poster,[accepted]);assert.equal(merged.length,1);assert.equal(R.delta(merged[0]),85,'An older poster must not replace the accepted v2 score with a legacy penalty');
assert.equal(poster.presets[0].data.scoringVersion,undefined,'Do not mutate the cached official publication');
console.log('PASS: six event scales, 25/1200 hotlap +85, 15/20 Daily +3, Esport +15, monotonic ranks, field size, historical scores and poster deduplication');

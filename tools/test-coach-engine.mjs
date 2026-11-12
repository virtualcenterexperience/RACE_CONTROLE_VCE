/* VCE contextual coaching smoke tests (no network, static VCE circuits & cars). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync('assets/js/vce-coach-engine-v2.js','utf8');
const context={};vm.runInNewContext(script,context,{timeout:2000});
const e=context.VCECoachEngine;assert.ok(e,'engine exposed');
const countries=['europe','asie','afrique','amerique-du-nord','amerique-du-sud','oceanie'];
const tracks=countries.flatMap(x=>JSON.parse(fs.readFileSync('data/'+x+'.json','utf8')).circuits||[]);
const cars=JSON.parse(fs.readFileSync('data/vce-cars-database-v20.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('data/catalogue_voitures_circuits.json','utf8'));
const resources=JSON.parse(fs.readFileSync('data/ressources/coach-index-v1.json','utf8'));
const data={tracks,cars,catalog,resources};
const example=e.analyze('Je perds la voiture virage 5 à Monza en GT3',{},data);
assert.equal(example.context.category,'GT3');
assert.match(example.context.trackLabel,/monza/i);
assert.equal(example.context.cornerNumber,5);
assert.equal(example.stages.length,3);
assert.equal(example.context.issue,'unknown','do not assume front/rear loss');
assert.ok(example.followups.some(q=>/arrière/i.test(q)),'asks whether front or rear');
for(const phase of example.stages){assert.ok(phase.placement.length>30);assert.ok(phase.correction.length>30);assert.ok(phase.exercise.length>30)}
const exit=e.analyze('L’arrière décroche en sortie du virage 5 à Monza en GT3',{setup:'standard'},data);
assert.equal(exit.context.issue,'rear');
assert.equal(exit.context.phase,'sortie');
assert.equal(exit.context.setup,'standard');
const open=e.analyze('Je perds la voiture',{},data,{track:example.context.track,category:'GT3',cornerNumber:5});
assert.equal(open.context.trackLabel,example.context.trackLabel);
assert.equal(open.context.cornerNumber,5);
console.log('PASS: VCE coach GT3 Monza T5, distinct phases, uncertain symptoms and contextual follow-up');

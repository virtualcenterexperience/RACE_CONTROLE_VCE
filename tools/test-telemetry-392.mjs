import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const world=readFileSync('telemetry-replay-world3d.js','utf8');
const geometry={};runInNewContext(world.slice(world.indexOf('function locate('),world.indexOf('function animate(')),geometry);
const line=[{x:0,z:0,height:0,t:0},{x:4,z:2,height:0,t:.02},{x:8,z:-2,height:0,t:.04}];
assert.equal(geometry.locate(line,.02).z,2,'Lateral deviation must remain visible');
assert.equal(geometry.locate(line,.03).x,6);
assert.equal(geometry.locate([{...line[0]},{...line[1],t:2}],1),null,'Do not bridge missing telemetry');
let drawn;class BufferGeometry{setFromPoints(p){drawn=p;return this}}
const traces={THREE:{BufferGeometry,Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z})}},Line:class{},LineBasicMaterial:class{}},group:{add(){}},center:{x:0,z:0}};
runInNewContext(world.slice(world.indexOf('function polyline('),world.indexOf('function road(')),traces);
traces.polyline(line,123,1);assert.deepEqual(drawn.map(p=>p.z),[0,2,-2],'No centerline snapping or spline overshoot');
const cloud=readFileSync('telemetry-cloud.js','utf8');
const normal={numberOrNull:v=>v==null?null:Number(v)};
runInNewContext(cloud.slice(cloud.indexOf('function normalizeSample('),cloud.indexOf('function normalizeLap(')),normal);
const sample=normal.normalizeSample({t:1,world_x:0,world_z:-1,brake:.012345,brake_raw:.023456},1);
assert.equal(sample.brake_raw,.023456);assert.equal(sample.brake,.012345);assert.equal(sample.x,0);
const nodes={};const events={};
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.value='';this.style={};}
 set id(v){this._id=v;nodes[v]=this}get id(){return this._id}
 setAttribute(){}append(...xs){this.children.push(...xs)}after(){}
 replaceChildren(...xs){this.children=xs;if(this.tag==='select')this.value=xs[0]?.value||''}
 querySelector(q){if(q==='tbody')return this.body||=(new Node('tbody'));return null}
 addEventListener(k,f){events[k]=f}
}
nodes['tt-sessions']=new Node('section');nodes.session=new Node('select');
const session={id:'A',participants:[{id:'1',name:'Driver A',is_player:true,best_lap_s:90,last_lap_s:91},{id:'2',name:'Driver B',best_lap_s:91,last_lap_s:90}]};
const ui={window:{vceSession:session},document:{getElementById:id=>nodes[id],createElement:t=>new Node(t),addEventListener:(k,f)=>events[k]=f},Option:class{constructor(t,v){this.textContent=t;this.value=v}},setTimeout:fn=>fn()};
runInNewContext(readFileSync('telemetry-session-timing.js','utf8'),ui);
assert.match(nodes['vce-session-timing-delta'].textContent,/-1.000 s/);
assert.equal(nodes['vce-timing-b'].value,'2');
events['vce-live-frame']({detail:{session_id:'OTHER',participants:[{id:'3',name:'Wrong driver'}]}});
assert.equal(nodes['vce-timing-a'].children.length,2,'Ignore another session');
events['vce-live-frame']({detail:{session_id:'A',participants:[{id:'1',name:'<script>text only</script>',best_lap_s:89},{id:'2',name:'Driver B',best_lap_s:91}]}});
assert.match(nodes['vce-session-timing-delta'].textContent,/-2.000 s/);
console.log('Replay measured coordinates/gaps, precise pedal channels and isolated session timing passed');

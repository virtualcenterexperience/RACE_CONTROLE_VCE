/* Offline action regression checks. No requests, credentials or production writes. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
for(const name of readdirSync('.').filter(x=>x.endsWith('.html'))){
 const source=readFileSync(name,'utf8');
 const scripts=[...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)/gi)].map(x=>x[1].split('?')[0]);
 assert.equal(new Set(scripts).size,scripts.length,'Duplicate script on '+name);
 if(!name.startsWith('overlay-')&&name!=='preset-resultat-pilote.html')assert.match(source,/assets\/css\/vce-ui-controls\.css\?v=/,'Common sizing missing: '+name);
}
for(const page of ['strategie.html','endurances.html']){
 const dialogs=[...readFileSync(page,'utf8').matchAll(/<form method="dialog">([\s\S]*?)<\/form>/g)];
 assert.equal(dialogs.length,page==='strategie.html'?3:0);
 for(const [,markup] of dialogs)assert.match(markup,/<button[^>]*type="submit"/,'Dialog close must retain native submission');
}
class Node{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.disabled=false;this.hidden=false;this.listeners={};}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=[...children]}
 prepend(...children){this.children.unshift(...children)}
 addEventListener(name,fn){this.listeners[name]=fn}
 querySelectorAll(selector){return this.children.flatMap(x=>[...(x.tagName==='button'&&(!selector.includes('[data-')||x.dataset.vceReviewSession)?[x]:[]),...x.querySelectorAll(selector)])}
}
const validation=readFileSync('validation-seances.html','utf8');
const script=validation.match(/<script>\s*(async function init[\s\S]*?)<\/script>/)[1];
function validationRuntime(){
 const nodes=Object.fromEntries(['pending','history','count'].map(id=>[id,new Node()]));let calls=0,approved=false,resolve,reject;
 const deferred=new Promise((yes,no)=>{resolve=yes;reject=no});
 const VCESupabase={reviews:async()=>approved?[{session_id:'session1',decision:'approved',reviewed_at:'2026-11-23'}]:[],trainingSubmissions:async()=>[{session_id:'session1',pilot:'TEST PILOT',submitted_at:'2026-11-23',payload:{exercise:'Test'}}],review:()=>{calls++;return deferred.then(()=>{approved=true})}};
 const document={getElementById:id=>nodes[id],createElement:tag=>new Node(tag),querySelectorAll:selector=>Object.values(nodes).flatMap(n=>n.querySelectorAll(selector))};
 const context={document,VCESupabase,Map,Set,Date,Promise,console,URLSearchParams,location:{search:''},alert:()=>{}};
 runInNewContext(script.slice(0,script.indexOf('const selection=new URLSearchParams(location.search);\nif(selection')),context);
 return {context,nodes,calls:()=>calls,resolve,reject};
}
const runtime=validationRuntime();await runtime.context.render();
let buttons=runtime.nodes.pending.children[0].querySelectorAll('button');
const approval=buttons[0].onclick();await buttons[1].onclick();
assert.equal(runtime.calls(),1,'Approve/refuse double click must send one decision');
await runtime.context.render();buttons=runtime.nodes.pending.children[0].querySelectorAll('button');
assert.ok(buttons.every(x=>x.disabled),'A refresh must preserve the in-flight session lock');
await buttons[1].onclick();assert.equal(runtime.calls(),1);
runtime.resolve();await approval;
assert.equal(runtime.nodes.pending.children.length,0);
assert.equal(runtime.nodes.history.children.length,1);
const failure=validationRuntime();await failure.context.render();buttons=failure.nodes.pending.children[0].querySelectorAll('button');
const failed=buttons[0].onclick();await failure.context.render();failure.reject(Error('offline'));await failed;
assert.ok(failure.nodes.pending.children[0].querySelectorAll('button').every(x=>!x.disabled),'Network failure must restore both actions');
let mounted=null,mounts=0,requests=0,finish;
const form=new Node('form'),input={value:'test-webhook'},button=new Node('button'),output={textContent:''};
form.querySelector=()=>button;
const discordDocument={getElementById:id=>id==='overview'?{after:panel=>{mounted=panel;mounts++}}:id==='vceDiscordTrainingSettings'?mounted:null,createElement:()=>({querySelector:selector=>selector==='form'?form:selector==='input'?input:output,addEventListener:()=>{}})};
const configPromise=new Promise(resolve=>{finish=resolve});
const discordContext={document:discordDocument,window:{VCESupabase:{session:()=>null},addEventListener:()=>{}},VCESupabase:{discordTrainingConfig:()=>{requests++;return configPromise}}};
const discord=readFileSync('assets/js/vce-staff-discord.js','utf8');runInNewContext(discord,discordContext);runInNewContext(discord,discordContext);
assert.equal(mounts,1,'Discord settings must be mounted once');
const save=form.listeners.submit({preventDefault(){}});await form.listeners.submit({preventDefault(){}});assert.equal(requests,1,'Webhook save must reject a second click while pending');
finish({});await save;assert.equal(button.disabled,false);
console.log('UI actions passed: script uniqueness, dialog close types, approval/refusal locking across refresh, retry after error and Discord save deduplication.');

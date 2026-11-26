import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('vce-pilot-auth.js','utf8');
function browser(){
 const ids=new Map(),winEvents=new Map(),docEvents=new Map();
 class Element{
  constructor(){this.hidden=false;this.value='';this.checked=false;this.disabled=false;this.dataset={};this.attributes={};this.listeners={};this.classList={toggle(){},remove(){}};this.style={setProperty:(k,v)=>this.attributes[k]=v}}
  set innerHTML(s){for(const m of s.matchAll(/id="([^"]+)"/g))ids.set(m[1],new Element())}
  addEventListener(k,cb){this.listeners[k]=cb}
  setAttribute(k,v){this.attributes[k]=v}
  querySelector(){return this.button??=new Element()}
 }
 ids.set('pilotDashboard',new Element());
 const document={readyState:'loading',hidden:false,documentElement:new Element(),getElementById:id=>ids.get(id),createElement:()=>new Element(),body:{append(el){ids.set(el.id,el)}},addEventListener:(k,cb)=>docEvents.set(k,cb)};
 let session=null,calls=0;const backend={loginError:null,verificationError:false,loginWait:null};
 const api={session:()=>session,validSession:async()=>session,configured:()=>true,isStaff:async()=>false,login:async()=>{calls++;if(backend.loginWait)await backend.loginWait;if(backend.loginError)throw Error(backend.loginError);session={access_token:'fake',refresh_token:'fake'}},logout:()=>session=null};
 const window={VCESupabase:api,VCE_SUPABASE:{url:'https://example.supabase.co',key:'mock'},addEventListener:(k,cb)=>winEvents.set(k,cb),dispatchEvent(){}};
 runInNewContext(source,{window,document,location:{pathname:'/pilote.html',hash:'#driver-a',search:''},URLSearchParams,AbortSignal,Error,Event:class{},setTimeout:()=>1,clearTimeout(){},fetch:async()=>({ok:!backend.verificationError,status:backend.verificationError?503:200,json:async()=>backend.verificationError?{error:'temporary failure'}:{pilot_slug:'driver-a',password_change_required:false}})});
 docEvents.get('DOMContentLoaded')();
 return {ids,backend,window,calls:()=>calls,session:()=>session,visibility:()=>docEvents.get('visibilitychange')(),online:()=>winEvents.get('online')(),submit:()=>{const form=ids.get('vce-pilot-login-form');return form.listeners.submit({preventDefault(){},currentTarget:form})}};
}
let b=browser();b.ids.get('vce-pilot-secret').value='typed-secret';b.backend.loginError='invalid_credentials';await b.submit();
assert.match(b.ids.get('vce-pilot-auth-message').textContent,/incorrect/);assert.equal(b.ids.get('vce-pilot-auth-message').attributes.role,'alert');assert.equal(b.ids.get('vce-pilot-secret').value,'typed-secret','A refusal must not silently clear the typed field');
b.visibility();b.online();assert.match(b.ids.get('vce-pilot-auth-message').textContent,/incorrect/,'Automatic recovery must preserve the actual login refusal');
b=browser();let release;b.backend.loginWait=new Promise(r=>release=r);b.ids.get('vce-pilot-secret').value='typed-secret';const pending=b.submit();await b.submit();b.visibility();b.online();assert.equal(b.calls(),1,'No duplicate sign-in on focus, online or second click');release();await pending;
assert.equal(b.window.VCEPilotAuthCanAccess('driver-a'),true);assert.equal(b.ids.get('vce-pilot-auth-gate').hidden,true);assert.equal(b.ids.get('pilotDashboard').attributes.display,'block');assert.equal(b.ids.get('vce-pilot-secret').value,'','Clear the secret after successful authentication');
b=browser();b.backend.verificationError=true;b.ids.get('vce-pilot-secret').value='typed-secret';await b.submit();assert.ok(b.session());assert.equal(b.ids.get('vce-pilot-login-form').hidden,true,'An authenticated session must not return to password entry during a verification outage');assert.match(b.ids.get('vce-pilot-auth-message').textContent,/sans ressaisir/);assert.equal(b.window.VCEPilotAuthCanAccess('driver-a'),false,'A temporary verification error must never unlock the dashboard');
b.backend.verificationError=false;await b.ids.get('vce-pilot-retry').onclick();await new Promise(r=>setImmediate(r));assert.equal(b.window.VCEPilotAuthCanAccess('driver-a'),true,'Session retry opens the verified dashboard without another password request');assert.equal(b.calls(),1);
console.log('PASS: complete pilot login flow, persistent refusal, no duplicate submit, verified dashboard and password-free session recovery');
// The presentation roster may still be loading after the server verified the owner.
const profileSource=readFileSync('assets/js/vce-page-pilote-data.js','utf8');
const routing=profileSource.slice(profileSource.indexOf('function routePilot(){'),profileSource.indexOf("document.getElementById('pilotSearch').oninput=showPilotList"));
let authorized=false;const visible={};
const context={allPilots:[],location:{hash:'#driver-a',search:''},URLSearchParams,document:{getElementById:id=>({classList:{toggle(){}},style:{setProperty:(k,v)=>visible[id]=v},setAttribute(){}})},window:{VCEPilotAuthCanAccess:()=>authorized,scrollTo(){}},VCE:{selectPilot(){},$:()=>({})},clearOfficialEvaluation(){},render(){}};
runInNewContext(routing,context);context.routePilot();assert.equal(visible.pilotDashboard,'none');authorized=true;context.routePilot();assert.equal(visible.pilotDashboard,'block','A server-verified pilot must reach the dashboard while the presentation roster is unavailable');
console.log('PASS: roster-loading delays cannot hide a server-verified dashboard');

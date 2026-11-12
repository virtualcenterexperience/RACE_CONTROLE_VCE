/* VCE Auth continuity tests — simulated browser close, refresh outages and logout.
 * No production credentials, users, server calls or private data.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync('vce-supabase.js','utf8'),KEY='vce_supabase_session';
const backend={refreshStatus:200,access:1};
const mapStore=(map)=>({
  getItem:k=>map.get(k)??null,
  setItem:(k,v)=>map.set(k,v),
  removeItem:k=>map.delete(k)
});
function browser(shared,tab=new Map()){
 const localStorage=mapStore(shared),sessionStorage=mapStore(tab);
 let calls=0;
 async function fetch(url,opts={}){
  calls++;
  const path=String(url);
  if(path.includes('/auth/v1/token?grant_type=password'))return {
   ok:true,status:200,text:async()=>JSON.stringify({
    access_token:'jwt-'+backend.access,refresh_token:'refresh-'+backend.access,
    expires_in:3600
   })
  };
  if(path.includes('/auth/v1/token?grant_type=refresh_token')){
   if(backend.refreshStatus!==200)return {ok:false,status:backend.refreshStatus};
   backend.access++;
   return {ok:true,status:200,json:async()=>({
    access_token:'jwt-'+backend.access,refresh_token:'refresh-'+backend.access,expires_in:3600
   })};
  }
  throw Error('unexpected endpoint: '+path);
 }
 const window={VCE_SUPABASE:{url:'https://example.supabase.co',key:'sb_publishable_TEST'},dispatchEvent(){}};
 runInNewContext(script,{window,localStorage,sessionStorage,fetch,setTimeout,AbortSignal,Date,JSON,Map,Promise,Error,Event:class{constructor(type){this.type=type}}});
 return {client:window.VCESupabase,localStorage,sessionStorage,calls:()=>calls};
}
const memory=new Map();
let first=browser(memory);
await first.client.login('staff@example.invalid','mock',{remember:true});
assert.equal(first.sessionStorage.getItem(KEY),null,'remembered staff session does not use tab storage');
assert.ok(first.localStorage.getItem(KEY),'remembered session saved in browser storage');
// Simulate closing and reopening the browser. The previous tab storage is gone.
let restored=browser(memory,new Map());
assert.equal(restored.client.session().access_token,'jwt-1','remembered account survives browser restart');
assert.equal((await restored.client.validSession()).access_token,'jwt-1');
const stale=JSON.parse(restored.localStorage.getItem(KEY));
stale.expires_at=Math.floor(Date.now()/1000)-10;
restored.localStorage.setItem(KEY,JSON.stringify(stale));
backend.refreshStatus=504;
await assert.rejects(restored.client.validSession(),/indisponible.*504/);
assert.equal(restored.client.session().refresh_token,stale.refresh_token,'server outage must not erase refresh token');
// A still-valid JWT can be used briefly even if proactive refresh fails.
stale.expires_at=Math.floor(Date.now()/1000)+20;
restored.localStorage.setItem(KEY,JSON.stringify(stale));
assert.equal((await restored.client.validSession()).access_token,'jwt-1');
backend.refreshStatus=200;
assert.equal((await restored.client.validSession()).access_token,'jwt-2','session recovers when backend returns');
assert.equal(JSON.parse(restored.localStorage.getItem(KEY)).access_token,'jwt-2');
restored.client.logout();
assert.equal(restored.localStorage.getItem(KEY),null,'logout must delete persisted token');
assert.equal(restored.sessionStorage.getItem(KEY),null,'logout must delete tab token');
first=browser(memory,new Map());
await first.client.login('pilot@example.invalid','mock');
assert.equal(first.localStorage.getItem(KEY),null,'pilot session not persistent by default');
assert.ok(first.sessionStorage.getItem(KEY),'pilot session exists in tab storage');
assert.equal(browser(memory,new Map()).client.session(),null,'new browser session needs login without opt-in');
console.log('PASS: remembered sessions survive restart, 504 preserves token, refresh recovers, logout clears, pilot defaults to session-only');

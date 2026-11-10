/* Regression test: Supabase publishable key must NEVER be sent as a Bearer JWT.
   This test uses a mock endpoint and cannot contact the real project. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const calls=[];
const key='sb_publishable_TEST_ONLY';
const local=new Map();
const sessionStorage={
 getItem:k=>local.get(k)||null,
 setItem:(k,v)=>{local.set(k,v)},
 removeItem:k=>{local.delete(k)}
};
const mockFetch=async(url,opts={})=>{
 const hdr=opts.headers||{};
 calls.push({url:String(url),headers:hdr});
 let value;
 if(String(url).includes('/auth/v1/token?grant_type=password'))
  value={access_token:'signed-user-jwt',refresh_token:'refresh',expires_in:3600};
 else if(String(url).includes('/rest/v1/rpc/vce_is_staff'))value=true;
 else if(String(url).includes('vce_publications'))value=[{payload:{items:[{id:'driver-one',name:'Driver One'}]}}];
 else throw Error('Unexpected endpoint '+url);
 return {ok:true,status:200,text:async()=>JSON.stringify(value)};
};
const window={VCE_SUPABASE:{url:'https://testing.supabase.co',key}};
runInNewContext(readFileSync('vce-supabase.js','utf8'),{
 window,sessionStorage,fetch:mockFetch,AbortSignal,Date,JSON,Map,Promise,Error
});
await Promise.all([window.VCESupabase.read('pilotes'),window.VCESupabase.read('pilotes')]);
assert.equal(calls.length,1,'Concurrent public roster requests must share one fetch');
assert.equal(calls[0].headers.apikey,key);
assert.equal(calls[0].headers.Authorization,undefined,'Do not send publishable key as JWT');
await window.VCESupabase.login('driver@example.com','test-only');
assert.equal(calls[1].headers.Authorization,undefined,'Auth login must not contain bogus JWT');
assert.equal(await window.VCESupabase.isStaff(),true);
assert.equal(calls[2].headers.Authorization,'Bearer signed-user-jwt');
window.VCESupabase.logout();
assert.equal(window.VCESupabase.session(),null);
console.log('PASS: Supabase publishable API key, authenticated user JWT and read deduplication');

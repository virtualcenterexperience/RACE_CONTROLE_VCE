/* Supabase Auth regression: temporary Auth failures must not erase valid local refresh tokens.
 * Runs entirely offline with mocked fetch; no user credentials or project endpoints.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const program=readFileSync('vce-supabase.js','utf8');
function setup(status){
 const local=new Map();
 local.set('vce_supabase_session',JSON.stringify({access_token:'prior-access-token',refresh_token:'prior-refresh-token',expires_at:Math.floor(Date.now()/1000)-120}));
 let calls=0;
 const sessionStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const fetch=async(url,opts)=>{calls++;assert.match(String(url),/\/auth\/v1\/token\?grant_type=refresh_token$/);assert.equal(opts.method,'POST');return {ok:false,status};};
 const window={VCE_SUPABASE:{url:'https://testing.supabase.co',key:'sb_publishable_TEST'},dispatchEvent(){}};
 runInNewContext(program,{window,fetch,sessionStorage,AbortSignal,Date,JSON,Map,Promise,Error,Event:class{constructor(type){this.type=type}}});
 return {client:window.VCESupabase,sessionStorage,calls:()=>calls};
}
const down=setup(504);
await assert.rejects(down.client.validSession(),/indisponible.*504/);
assert.equal(down.calls(),1);
assert.equal(down.client.session()?.refresh_token,'prior-refresh-token','503/504 must not clear client session');
const revoked=setup(401);
await assert.rejects(revoked.client.validSession(),/Session expirée ou révoquée/);
assert.equal(revoked.calls(),1);
assert.equal(revoked.client.session(),null,'401 must sign out');
console.log('PASS: Auth 504 preserves session, Auth 401 clears revoked session');

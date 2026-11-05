// supabase/functions/vce-telemetry-ingest/index.ts
// Deploy with: supabase functions deploy vce-telemetry-ingest --no-verify-jwt
// Authentication is enforced here with a per-device bearer token.
import { createClient } from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false}});
const encoder=new TextEncoder();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token||token.length<32||token.length>256)return json({error:'Unauthorized'},401);
 const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))));
 const {data:credentials,error:ce}=await db.from('vce_telemetry_device_credentials').select('device_id,revoked_at').eq('token_hash',digest).is('revoked_at',null).limit(1);
 if(ce||!credentials?.length)return json({error:'Unauthorized'},401);
 const deviceId=credentials[0].device_id;
 const {data:device,error:de}=await db.from('vce_telemetry_devices').select('id,status,pilot_slug').eq('id',deviceId).single();
 if(de||device?.status!=='approved'||!device.pilot_slug)return json({error:'Device not approved or unlinked'},403);
 let body:any;
 try{const raw=await req.text();if(raw.length>12000)return json({error:'Payload too large'},413);body=JSON.parse(raw)}
 catch{return json({error:'Invalid JSON'},400)}
 const sessionId=body.session_id;
 if(typeof sessionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId))return json({error:'Invalid session_id'},400);
 const validText=(x:unknown)=>typeof x==='string'?x.slice(0,120):null;
 const validNumber=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:null;
 const {data:existing,error:se}=await db.from('vce_telemetry_sessions').select('id,device_id,state').eq('id',sessionId).maybeSingle();
 if(se)return json({error:'Database error'},500);
 if(existing&&existing.device_id!==deviceId)return json({error:'Session belongs to another device'},403);
 if(existing?.state==='completed'||existing?.state==='interrupted')return json({error:'Session already ended'},409);
 if(!existing){
  const {error:e}=await db.from('vce_telemetry_sessions').insert({id:sessionId,device_id:deviceId,game:validText(body.game),car:validText(body.car),track:validText(body.track),layout:validText(body.layout),state:'running',started_at:new Date().toISOString()});
  if(e)return json({error:'Unable to create session'},500);
 }
 const ended=body.event==='end';
 const sample=body.sample&&typeof body.sample==='object'?body.sample:{};
 const clean={
  throttle:validNumber(sample.throttle,0,100),brake:validNumber(sample.brake,0,100),
  steering:validNumber(sample.steering,-1080,1080),speed:validNumber(sample.speed,0,650),
  gear:validNumber(sample.gear,-1,12),slip:validNumber(sample.slip,-100,100),
  x:validNumber(sample.x,-1e9,1e9),y:validNumber(sample.y,-1e9,1e9),
  z:validNumber(sample.z,-1e9,1e9)
 };
 const lap=validNumber(body.lap_number,0,100000);
 const elapsed=validNumber(body.elapsed_ms,0,1e12);
 const {error:le}=await db.from('vce_telemetry_live').upsert({
  session_id:sessionId,device_id:deviceId,pilot_slug:device.pilot_slug,
  lap_number:lap,position:validNumber(body.position,0,10000),
  elapsed_ms:elapsed,sample:clean,updated_at:new Date().toISOString()
 },{onConflict:'session_id'});
 if(le)return json({error:'Unable to update live telemetry'},500);
 if(ended){
  const {error:e}=await db.from('vce_telemetry_sessions').update({state:'completed',ended_at:new Date().toISOString()}).eq('id',sessionId).eq('device_id',deviceId);
  if(e)return json({error:'Unable to end session'},500);
 }
 return json({ok:true,session_id:sessionId,state:ended?'completed':'running'});
});

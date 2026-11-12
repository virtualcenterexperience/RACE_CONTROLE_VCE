import { createClient } from "npm:@supabase/supabase-js@2.95.0";
/* Staff applications notifications. Never collect candidate answers or names.
 * verify_jwt=false because Apps Script webhook uses a separately rotated secret.
 * All STAFF reads/writes require Supabase Auth + vce_is_staff verification.
 */
const ALLOWED_ORIGIN = "https://virtualcenterexperience.github.io";
const HEADERS = {"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Headers":"apikey, authorization, content-type, x-vce-hook-secret, x-client-info","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store","Content-Type":"application/json"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const hash=async(text:string)=>{
  const input=new TextEncoder().encode(text);
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",input));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
};
const equal=(a:string,b:string)=>{
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
};
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
  const origin=req.headers.get("Origin");
  if(origin && origin!==ALLOWED_ORIGIN)return json({error:"origin_not_allowed"},403);
  const url=Deno.env.get("SUPABASE_URL");
  const publishable=Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!publishable||!secretKey)return json({error:"service_configuration_unavailable"},503);
  if(req.method!=="GET"&&req.method!=="POST")return json({error:"method_not_allowed"},405);
  let input:Record<string,unknown>={};
  if(req.method==="POST"){
    try{input=await req.json();if(!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid")}
    catch{return json({error:"invalid_json"},400)}
  }
  const service=createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});
  if(req.method==="POST"&&input.action==="ingest"){
    const token=req.headers.get("x-vce-hook-secret")||"";
    if(!/^[a-f0-9]{64}$/.test(token))return json({error:"invalid_webhook_secret"},403);
    const {data:setting,error:settingError}=await service.from("vce_application_webhook_settings").select("secret_sha256").eq("id",1).maybeSingle();
    if(settingError)return json({error:"webhook_config_unavailable"},503);
    if(!setting?.secret_sha256||!equal(await hash(token),setting.secret_sha256))return json({error:"invalid_webhook_secret"},403);
    const eventId=typeof input.event_id==="string"?input.event_id.trim():"";
    if(!/^[A-Za-z0-9_.:\-]{5,160}$/.test(eventId))return json({error:"invalid_event_id"},400);
    let when:string|null=null;
    if(typeof input.submitted_at==="string"&&Number.isFinite(Date.parse(input.submitted_at)))when=new Date(input.submitted_at).toISOString();
    const {data,error}=await service.from("vce_application_notifications")
      .upsert({event_id:eventId,submitted_at:when,source:"google_forms"},{onConflict:"event_id",ignoreDuplicates:true})
      .select("id");
    if(error)return json({error:"event_not_saved"},503);
    return json({ok:true,duplicate:!data?.length},202);
  }
  const bearer=req.headers.get("Authorization")||"";
  if(!/^Bearer \S+$/.test(bearer))return json({error:"staff_authentication_required"},401);
  const token=bearer.slice(7);
  const authClient=createClient(url,publishable,{global:{headers:{Authorization:bearer}},auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await authClient.auth.getUser(token);
  if(!user||authError)return json({error:"staff_authentication_unavailable"},401);
  const {data:staff,error:staffError}=await authClient.rpc("vce_is_staff");
  if(staffError)return json({error:"staff_verification_unavailable"},503);
  if(staff!==true)return json({error:"staff_required"},403);
  if(req.method==="GET"){
    const {data,error}=await service.from("vce_application_notifications").select("id,message,source,submitted_at,received_at,read_at").order("received_at",{ascending:false}).limit(50);
    if(error)return json({error:"notifications_unavailable"},503);
    const {count,error:countError}=await service.from("vce_application_notifications").select("id",{count:"exact",head:true}).is("read_at",null);
    if(countError)return json({error:"notification_count_unavailable"},503);
    const {data:setting}=await service.from("vce_application_webhook_settings").select("id").eq("id",1).maybeSingle();
    return json({items:data||[],unread:count||0,configured:Boolean(setting),poll_seconds:30});
  }
  if(input.action==="read"){
    const {error}=await service.from("vce_application_notifications").update({read_at:new Date().toISOString()}).is("read_at",null);
    if(error)return json({error:"mark_read_failed"},503);
    return json({ok:true});
  }
  if(input.action==="rotate_token"){
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const newToken=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
    const {error}=await service.from("vce_application_webhook_settings")
      .upsert({id:1,secret_sha256:await hash(newToken),updated_at:new Date().toISOString()},{onConflict:"id"});
    if(error)return json({error:"webhook_configuration_failed"},503);
    return json({ok:true,webhook_secret:newToken,warning:"Token shown once. Copy to Apps Script Properties. Never put it in HTML or GitHub."});
  }
  return json({error:"unknown_action"},400);
});

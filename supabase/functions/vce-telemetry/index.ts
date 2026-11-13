// RACE CONTROLE VCE 2.5 — Supabase Edge Function "vce-telemetry"
// Deploy with verify_jwt=false ONLY for this function.
// Every device request is authenticated with its 256-bit device secret.
// Staff requests validate Supabase Auth + vce_is_staff(), not an anon key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const base=Deno.env.get("SUPABASE_URL")!;
const adminKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const db=createClient(base,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET=/^[0-9a-f]{64}$/i,STEAM=/^7656119\d{10}$/;
const GAMES=["AC","ACC","LMU","ACEVO","R3E"];
function lanIp(raw:unknown){
 const v=clean(raw,45);
 if(!v)return null;
 const parts=v.split(".");
 if(parts.length!==4||parts.some(x=>!/^(0|[1-9][0-9]{0,2})$/.test(x)||Number(x)>255))return null;
 const [a,b]=parts.map(Number);
 if(a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168))return v;
 return null;
}
function reply(o:unknown,s=200){return new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}})}
function requireOk(r:{error:any}){if(r.error)throw Error(r.error.message)}
function clean(v:unknown,max=120){return typeof v==="string"?v.trim().slice(0,max):""}
function slug(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100)}
function n(v:unknown,min:number,max:number){if(v===null||v===undefined)return null;const x=Number(v);return Number.isFinite(x)&&x>=min&&x<=max?x:null}
async function digest(secret:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));return [...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,"0")).join("")}
async function device(b:any){
 if(!UUID.test(b.device_id||"")||!SECRET.test(b.device_secret||""))throw Error("Identifiant ou secret appareil invalide");
 const res=await db.from("vce_agent_devices").select("device_id,secret_hash,status,pilot_slug,pilot_auth_user,allow_team_comparison").eq("device_id",b.device_id).maybeSingle();requireOk(res);
 if(!res.data||res.data.secret_hash!==await digest(b.device_secret))throw Error("PC inconnu ou secret incorrect");
 return res.data;
}
async function authorizedStaff(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const user=await db.auth.getUser(token);if(user.error||!user.data.user)throw Error("Connexion STAFF requise");
 const asUser=createClient(base,publicKey,{auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{Authorization:"Bearer "+token}}});
 const flag=await asUser.rpc("vce_is_staff");requireOk(flag);
 if(flag.data!==true)throw Error("Accès réservé au STAFF");
 return user.data.user;
}
async function authUser(req:Request,allowPasswordChange=false){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const x=await db.auth.getUser(token);if(x.error||!x.data.user)throw Error("Connexion pilote requise");
 const meta=x.data.user.app_metadata||{};
 if(meta.vce_pilot_slug){
  if(meta.vce_pilot_active===false)throw Error("Ce profil pilote a été désactivé par le STAFF.");
  const roster=await readPilotRoster();
  if(!roster.some((p:any)=>p.id===meta.vce_pilot_slug))
   throw Error("Ce pilote ne figure plus dans l'équipe active.");
 }
 if(!allowPasswordChange&&meta.vce_password_change_required===true)
   throw Error("Modifie le mot de passe provisoire dans ton espace pilote.");
 return x.data.user;
}
function normalizedSession(s:any,d:any,status:string){
 const start=n(s.started_at,946684800,5000000000),end=n(s.ended_at,946684800,5000000000);
 const live=s.live_sample&&typeof s.live_sample==="object"?
 {t:n(s.live_sample.t,0,5000000000),lap_pos:n(s.live_sample.lap_pos,0,1),
  speed_kmh:n(s.live_sample.speed_kmh,0,800),brake:n(s.live_sample.brake,0,1),
  throttle:n(s.live_sample.throttle,0,1),steer:n(s.live_sample.steer,-100,100),
  gear:n(s.live_sample.gear,-2,20),rpm:n(s.live_sample.rpm,0,30000),
  fuel_l:n(s.live_sample.fuel_l,0,1000),position:n(s.live_sample.position,0,1000),
  sector_index:n(s.live_sample.sector_index,0,50)}:null;
 if(!UUID.test(s.session_id||"")||!GAMES.includes(s.game)||start===null)throw Error("Session invalide");
 if(status==="completed"&&end===null)throw Error("Date de fin manquante");
 return {session_id:s.session_id,device_id:d.device_id,pilot_slug:d.pilot_slug,
 pilot_auth_user:d.pilot_auth_user,game:s.game,track:clean(s.track),car:clean(s.car),
 started_at:new Date(start*1000).toISOString(),ended_at:end?new Date(end*1000).toISOString():null,
 laps_count:Math.min(100000,Math.max(0,Number(s.laps_count)||0)),
 best_lap_ms:n(s.best_lap_ms,10000,3600000),
 status,live_sample:live,session_type:clean(s.session_type,32),last_heartbeat_at:new Date().toISOString()};
}
// VCE pilot portal: privileged provisioning is STAFF-only, never trust client profile names.
const VCE_PILOT_DOMAIN="virtual-center-experience.fr";
function pilotMail(id:string){return "vce-pilote+"+id+"@"+VCE_PILOT_DOMAIN}
async function pilotAccounts(){
 const result=await db.auth.admin.listUsers({page:1,perPage:1000});requireOk(result);
 return (result.data.users||[]).filter((u:any)=>typeof u.app_metadata?.vce_pilot_slug==="string");
}
async function pilotAccount(id:string){
 const users=await pilotAccounts();
 return users.find((u:any)=>u.app_metadata.vce_pilot_slug===id)||null;
}
function temporaryPassword(){
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
 const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
 return [...bytes].map(i=>alphabet[i%alphabet.length]).join("");
}
async function readPilotRoster(){
 const r=await db.from("vce_publications").select("payload").eq("kind","pilotes").maybeSingle();
 requireOk(r);
 const raw=Array.isArray(r.data?.payload?.items)?r.data.payload.items:[];
 return raw.filter((p:any)=>p&&typeof p.name==="string"&&typeof p.id==="string")
  .map((p:any)=>({id:slug(p.id),name:clean(p.name,120)}))
  .filter((p:any)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)&&p.name.length>2);
}
async function writePilotRoster(items:{id:string,name:string}[]){
 const r=await db.from("vce_publications").upsert({
  kind:"pilotes",payload:{version:2,items,updatedAt:new Date().toISOString()},
  updated_at:new Date().toISOString()
 },{onConflict:"kind"});
 requireOk(r);
}
async function provisionVcePilot(id:string){
 const account=await pilotAccount(id),password=temporaryPassword();
 let uid=account?.id||"";
 if(account){
  const r=await db.auth.admin.updateUserById(account.id,{
   password,app_metadata:{...account.app_metadata,vce_pilot_slug:id,
    vce_pilot_active:true,vce_password_change_required:true}
  });
  requireOk(r);
 }else{
  const r=await db.auth.admin.createUser({
   email:pilotMail(id),password,email_confirm:true,
   app_metadata:{vce_pilot_slug:id,vce_pilot_active:true,vce_password_change_required:true}
  });
  requireOk(r);
  if(!r.data.user)throw Error("Impossible de créer le compte pilote");
  uid=r.data.user.id;
 }
 await associatePilotRecord(id,uid);
 return {pilot_slug:id,identifier:"virtualcenterexperience",temporary_password:password};
}
async function deactivateVcePilot(id:string){
 const account=await pilotAccount(id);
 if(!account)return;
 const r=await db.auth.admin.updateUserById(account.id,{
  app_metadata:{...account.app_metadata,vce_pilot_active:false}
 });
 requireOk(r);
}
async function associatePilotRecord(id:string,uid:string){
 const dev=await db.from("vce_agent_devices").update({pilot_auth_user:uid})
   .eq("pilot_slug",id).eq("status","approved").is("pilot_auth_user",null);
 requireOk(dev);
 const sessions=await db.from("vce_agent_sessions").update({pilot_auth_user:uid})
   .eq("pilot_slug",id).is("pilot_auth_user",null);
 requireOk(sessions);
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return reply({error:"POST requis"},405);
 let b:any;
 try{const raw=await req.text();if(raw.length>550000)return reply({error:"Requête trop grande"},413);b=JSON.parse(raw)}
 catch{return reply({error:"JSON invalide"},400)}
 try{
 const action=clean(b?.action,40);
 if(action==="register"){
   const id=clean(b.device_id,50),secret=clean(b.device_secret,64),requested=clean(b.requested_pilot,100),steam=clean(b.steam_id64,17);
   if(!UUID.test(id)||!SECRET.test(secret)||requested.length<2||steam&&!STEAM.test(steam))return reply({error:"Demande incomplète"},400);
   const hashed=await digest(secret),local_ip=lanIp(b.local_ip);
   const old=await db.from("vce_agent_devices").select("secret_hash,status,steam_id64,requested_pilot").eq("device_id",id).maybeSingle();requireOk(old);
   if(old.data){
     if(old.data.secret_hash!==hashed)return reply({error:"Identifiant déjà utilisé"},403);
     // A STAFF approval binds the verified device to its pilot until STAFF revokes it.
     // Device ID + 256-bit secret authenticate the computer; Steam ID and IP are diagnostics.
     // Updating those diagnostics must NEVER revoke an existing approved association.
     if(old.data.status==="approved"){
       const metadata:any={};
       if(steam&&steam!==old.data.steam_id64)metadata.steam_id64=steam;
       if(local_ip)metadata.local_ip=local_ip;
       if(Object.keys(metadata).length)
         requireOk(await db.from("vce_agent_devices").update(metadata).eq("device_id",id));
       return reply({status:"approved",device_id:id,linked:true});
     }
     // Pending/rejected devices still need STAFF approval before telemetry transmission.
     const storedSteam=old.data.steam_id64||"";
     const metadata:any={};
     if(old.data.requested_pilot!==requested)metadata.requested_pilot=requested;
     if(steam&&steam!==storedSteam)metadata.steam_id64=steam;
     if(local_ip)metadata.local_ip=local_ip;
     if(Object.keys(metadata).length)
       requireOk(await db.from("vce_agent_devices").update(metadata).eq("device_id",id));
     return reply({status:old.data.status,device_id:id});
   }
   requireOk(await db.from("vce_agent_devices").insert({device_id:id,secret_hash:hashed,requested_pilot:requested,
     steam_id64:steam||null,local_ip,status:"pending"}));
   return reply({status:"pending",device_id:id});
 }
 // Optional AC physics channels, accepted only as finite numbers in safe bounds.
 // The Windows collector must explicitly transmit a channel; missing is never zero.
 const PHYSICS_FIELDS=["g_long","g_lat","clutch","ride_height_front","ride_height_rear",
   "air_temp","track_temp","suspension_fl","suspension_fr","suspension_rl","suspension_rr",
   "tyre_temp_fl","tyre_temp_fr","tyre_temp_rl","tyre_temp_rr",
   "tyre_temp_inner_fl","tyre_temp_inner_fr","tyre_temp_inner_rl","tyre_temp_inner_rr",
   "tyre_temp_center_fl","tyre_temp_center_fr","tyre_temp_center_rl","tyre_temp_center_rr",
   "tyre_temp_outer_fl","tyre_temp_outer_fr","tyre_temp_outer_rl","tyre_temp_outer_rr",
   "brake_temp_fl","brake_temp_fr","brake_temp_rl","brake_temp_rr",
   "tyre_wear_fl","tyre_wear_fr","tyre_wear_rl","tyre_wear_rr",
   "camber_fl","camber_fr","camber_rl","camber_rr",
   // LMU native player inputs and chassis channels (only measured values).
   "throttle_raw","brake_raw","steer_raw","clutch_raw",
   "steering_torque_nm","front_downforce","rear_downforce","drag_n",
   "engine_water_temp","engine_oil_temp"];
 function readPhysics(v:any){
   const extra:Record<string,number>={};
   for(const key of PHYSICS_FIELDS){
     if(v?.[key]===null||v?.[key]===undefined)continue;
     const cap=key.endsWith("_raw")||key==="clutch"?1:
       key==="steering_torque_nm"?2000:
       key==="front_downforce"||key==="rear_downforce"||key==="drag_n"?100000:
       key.startsWith("brake_temp")?1600:
       key.startsWith("camber")||key.startsWith("g_")?30:2000;
     const min=key==="steer_raw"?-1:key.endsWith("_raw")||key==="clutch"?0:-cap;
     const value=n(v[key],min,cap);
     if(value!==null)extra[key]=value;
   }
   return extra;
 }
 // VCE 3.4: incremental, resumable-sized transfer of native high-frequency laps.
 // Each device is authenticated by its existing 256-bit secret; ownership never changes.
 if(action==="upload_segment"){
   const d=await device(b);
   if(d.status!=="approved"||!d.pilot_slug)return reply({error:"Appareil non approuvé"},403);
   const sess=b.session||{},lap=b.lap||{},number=Number(lap.lap_number);
   const offset=Number(b.offset),total=Number(b.total_samples);
   if(!UUID.test(sess.session_id||"")||!Number.isInteger(number)||number<1||number>100000||
     !Number.isInteger(offset)||offset<0||!Number.isInteger(total)||total<10||total>100000||
     !Array.isArray(lap.samples)||lap.samples.length<1||lap.samples.length>160||
     offset+lap.samples.length>total)return reply({error:"Segment de tour invalide"},400);
   const previous=await db.from("vce_agent_sessions").select("device_id,status")
     .eq("session_id",sess.session_id).maybeSingle();requireOk(previous);
   if(previous.data&&previous.data.device_id!==d.device_id)return reply({error:"Session d'un autre PC"},403);
   // A 120 Hz lap uploads many small segments; session metadata must not be
   // rewritten for each chunk. The first chunk establishes the session and
   // each later chunk verifies that the existing session belongs to this PC.
   // This avoids ~1 SQL upsert per incoming chunk without dropping samples.
   if(offset!==0&&!previous.data)return reply({error:"Session non initialisée : premier segment manquant",expected_offset:0},409);
   if(offset===0){
     const effective=previous.data?.status||"in_progress";
     const row=normalizedSession(sess,d,effective);
     if(effective!=="completed")row.ended_at=null;
     requireOk(await db.from("vce_agent_sessions").upsert(row,{onConflict:"session_id"}));
   }
   const points=lap.samples.map((x:any)=>({
     t:n(x.t,0,5000000000),lap_pos:n(x.lap_pos,0,1),speed_kmh:n(x.speed_kmh,0,800),
     brake:n(x.brake,0,1),throttle:n(x.throttle,0,1),steer:n(x.steer,-100,100),
     gear:n(x.gear,-2,20),lap_time_ms:n(x.lap_time_ms,0,3600000),
     world_x:n(x.world_x,-1e9,1e9),world_z:n(x.world_z,-1e9,1e9),
     rpm:n(x.rpm,0,30000),fuel_l:n(x.fuel_l,0,1000),position:n(x.position,0,1000),
     sector_index:n(x.sector_index,0,50),...readPhysics(x)
   }));
   if(points.some((p:any)=>p.t===null))return reply({error:"Horodatage de segment invalide"},400);
   // The first segment starts a fresh idempotent upload; never alter a completed
   // archived lap until every chunk has arrived and passed the ordering check.
   if(offset===0){
     requireOk(await db.from("vce_agent_lap_segments").delete()
       .eq("session_id",sess.session_id).eq("lap_number",number));
   }
   requireOk(await db.from("vce_agent_lap_segments").upsert({
     session_id:sess.session_id,lap_number:number,sample_offset:offset,
     total_samples:total,samples:points
   },{onConflict:"session_id,lap_number,sample_offset"}));
   const next=offset+points.length;
   if(next!==total)return reply({ok:true,offset:next,complete:false});
   const collected=await db.from("vce_agent_lap_segments")
     .select("sample_offset,total_samples,samples")
     .eq("session_id",sess.session_id).eq("lap_number",number)
     .order("sample_offset",{ascending:true}).limit(1000);
   requireOk(collected);
   const combined:any[]=[];let expected=0;
   for(const part of collected.data||[]){
     if(part.sample_offset!==expected||part.total_samples!==total||
        !Array.isArray(part.samples))return reply({error:"Segment manquant ou incohérent",expected_offset:expected},409);
     combined.push(...part.samples);expected=combined.length;
   }
   if(expected!==total)return reply({error:"Enregistrement incomplet",expected_offset:expected},409);
   requireOk(await db.from("vce_agent_laps").upsert({
     session_id:sess.session_id,lap_number:number,
     lap_time_ms:n(lap.lap_time_ms,10000,3600000),
     valid:typeof lap.valid==="boolean"?lap.valid:null,
     sample_count:combined.length,samples:combined
   },{onConflict:"session_id,lap_number"}));
   // All samples are now safely archived as a full lap; discard transfer staging.
   requireOk(await db.from("vce_agent_lap_segments").delete()
     .eq("session_id",sess.session_id).eq("lap_number",number));
   requireOk(await db.from("vce_agent_devices").update({last_seen_at:new Date().toISOString()}).eq("device_id",d.device_id));
   return reply({ok:true,offset:total,complete:true});
 }
 if(action==="live_batch"){
   const d=await device(b);
   if(d.status!=="approved"||!d.pilot_slug)return reply({error:"PC non approuvé"},403);
   const source=b.session||{};
   if(!UUID.test(source.session_id||"")||!["AC","ACC","LMU","ACEVO"].includes(source.game)||
      !Array.isArray(source.samples)||source.samples.length<1||source.samples.length>12)
      return reply({error:"Lot live invalide"},400);
   const points=source.samples.map((x:any)=>({
     t:n(x.t,946684800,5000000000),lap_pos:n(x.lap_pos,0,1),
     speed_kmh:n(x.speed_kmh,0,800),brake:n(x.brake,0,1),
     throttle:n(x.throttle,0,1),steer:n(x.steer,-100,100),
     gear:n(x.gear,-2,20),rpm:n(x.rpm,0,30000),
     fuel_l:n(x.fuel_l,0,1000),position:n(x.position,0,1000),
     sector_index:n(x.sector_index,0,50),world_x:n(x.world_x,-1e7,1e7),
     world_z:n(x.world_z,-1e7,1e7),...readPhysics(x)
   })).filter((x:any)=>x.t!==null);
   if(!points.length)return reply({error:"Aucune donnée valide"},400);
   const payload={device_id:d.device_id,session_id:source.session_id,
     game:source.game,track:clean(source.track,100),car:clean(source.car,100),
     session_type:clean(source.session_type,40),
     lap_number:n(source.lap_number,0,100000),
     timestamp:Date.now(),samples:points};
   const topic="vce:device:"+d.device_id;
   const result=await fetch(base+"/realtime/v1/api/broadcast/"+
     encodeURIComponent(topic)+"/events/frame?private=true",{
     method:"POST",headers:{"apikey":adminKey,"Authorization":"Bearer "+adminKey,
       "Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(!result.ok)return reply({error:"Realtime "+result.status},503);
   return reply({ok:true,frames:points.length});
 }
 if(["status","presence","session_state","upload"].includes(action)){
   const d=await device(b);
   if(action==="status")return reply({status:d.status,pilot_slug:d.status==="approved"?d.pilot_slug:null});
   if(d.status!=="approved"||!d.pilot_slug)return reply({error:"En attente de validation STAFF"},403);
   if(action==="presence"){
     if(b.game!==null&&!GAMES.includes(b.game))return reply({error:"Jeu invalide"},400);
     if(!["idle","game_detected","in_progress"].includes(b.state))return reply({error:"État invalide"},400);
     requireOk(await db.from("vce_agent_devices").update({current_game:b.game||null,current_state:b.state,
       last_seen_at:new Date().toISOString()}).eq("device_id",d.device_id));
     return reply({ok:true});
   }
   const s=b.session||{},state=action==="upload"?"in_progress":String(b.status||"");
   if(action==="session_state"&&!["in_progress","completed"].includes(state))return reply({error:"État invalide"},400);
   const previous=await db.from("vce_agent_sessions").select("device_id,status").eq("session_id",s.session_id||"").maybeSingle();requireOk(previous);
   if(previous.data&&previous.data.device_id!==d.device_id)return reply({error:"Session d’un autre PC"},403);
   const effective=action==="session_state"?(previous.data?.status==="completed"?"completed":state)
     :(previous.data?.status||"in_progress");
   const row=normalizedSession(s,d,effective);
   if(effective!=="completed"&&action==="upload")row.ended_at=null;
   requireOk(await db.from("vce_agent_sessions").upsert(row,{onConflict:"session_id"}));
   if(action==="session_state")return reply({ok:true,status:effective});
   const lap=b.lap||{},number=Number(lap.lap_number);
   if(!Number.isInteger(number)||number<1||number>100000||!Array.isArray(lap.samples)||lap.samples.length<10||lap.samples.length>12000)
     return reply({error:"Tour ou échantillons invalides"},400);
   const samples=lap.samples.map((x:any)=>({t:n(x.t,0,5000000000),lap_pos:n(x.lap_pos,0,1),
     speed_kmh:n(x.speed_kmh,0,800),brake:n(x.brake,0,1),throttle:n(x.throttle,0,1),
     steer:n(x.steer,-100,100),gear:n(x.gear,-2,20),lap_time_ms:n(x.lap_time_ms,0,3600000),
     world_x:n(x.world_x,-1000000000,1000000000),world_z:n(x.world_z,-1000000000,1000000000),
 rpm:n(x.rpm,0,30000),fuel_l:n(x.fuel_l,0,1000),position:n(x.position,0,1000),
 sector_index:n(x.sector_index,0,50),...readPhysics(x)}));
   requireOk(await db.from("vce_agent_laps").upsert({session_id:s.session_id,lap_number:number,
     lap_time_ms:n(lap.lap_time_ms,10000,3600000),valid:typeof lap.valid==="boolean"?lap.valid:null,
     sample_count:samples.length,samples},{onConflict:"session_id,lap_number"}));
   requireOk(await db.from("vce_agent_devices").update({last_seen_at:new Date().toISOString()}).eq("device_id",d.device_id));
   return reply({ok:true,session_id:s.session_id,lap_number:number});
 }
 if(action==="pilot_share"){
   const user=await authUser(req);
   if(typeof b.enabled!=="boolean")return reply({error:"Option de partage invalide"},400);
   const result=await db.from("vce_agent_devices").update({allow_team_comparison:b.enabled})
      .eq("pilot_auth_user",user.id).eq("status","approved").select("device_id");
   requireOk(result);
   if(!result.data?.length)return reply({error:"Aucun appareil lié au compte pilote"},403);
   return reply({ok:true,sharing:b.enabled});
 }
 if(action==="comparison_catalog"||action==="comparison_laps"){
   const user=await authUser(req);
   let staff=false;
   try{const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
     const asUser=createClient(base,publicKey,{auth:{persistSession:false,autoRefreshToken:false},
       global:{headers:{Authorization:"Bearer "+token}}});
     const flag=await asUser.rpc("vce_is_staff");
     staff=flag.data===true&&!flag.error;
   }catch{}
   const baseId=clean(b.base_session_id,50);
   if(!UUID.test(baseId))return reply({error:"Session principale invalide"},400);
   const own=await db.from("vce_agent_sessions").select("session_id,game,track,car,pilot_auth_user")
     .eq("session_id",baseId).maybeSingle();requireOk(own);
   if(!own.data)return reply({error:"Session introuvable"},404);
   if(!staff&&own.data.pilot_auth_user!==user.id)return reply({error:"Accès à la session refusé"},403);
   if(action==="comparison_catalog"){
     const list=await db.from("vce_agent_sessions")
       .select("session_id,device_id,pilot_slug,game,track,car,best_lap_ms,started_at")
       .eq("game",own.data.game).eq("track",own.data.track).eq("car",own.data.car)
       .neq("session_id",baseId).order("started_at",{ascending:false}).limit(80);requireOk(list);
     const candidates=list.data||[];
     if(!candidates.length)return reply({sessions:[]});
     const deviceIds=[...new Set(candidates.map((s:any)=>s.device_id))];
     const dev=await db.from("vce_agent_devices").select("device_id,allow_team_comparison,pilot_auth_user,status")
       .in("device_id",deviceIds);requireOk(dev);
     const allowed=new Set((dev.data||[]).filter((d:any)=>d.status==="approved"&&
       (staff||d.allow_team_comparison===true||d.pilot_auth_user===user.id)).map((d:any)=>d.device_id));
     return reply({sessions:candidates.filter((s:any)=>allowed.has(s.device_id)).slice(0,40)});
   }
   const targetId=clean(b.target_session_id,50);
   if(!UUID.test(targetId))return reply({error:"Session de référence invalide"},400);
   const other=await db.from("vce_agent_sessions")
     .select("session_id,device_id,pilot_slug,game,track,car,pilot_auth_user")
     .eq("session_id",targetId).maybeSingle();requireOk(other);
   if(!other.data)return reply({error:"Session de référence introuvable"},404);
   if(other.data.track!==own.data.track||other.data.car!==own.data.car||
      other.data.game!==own.data.game)return reply({error:"Jeu, circuit ou voiture différents"},409);
   const dev=await db.from("vce_agent_devices").select("status,allow_team_comparison")
      .eq("device_id",other.data.device_id).maybeSingle();requireOk(dev);
   if(dev.data?.status!=="approved"||(!staff&&!dev.data?.allow_team_comparison&&other.data.pilot_auth_user!==user.id))
     return reply({error:"Ce pilote n'a pas autorisé la comparaison"},403);
   const laps=await db.from("vce_agent_laps")
     .select("lap_number,lap_time_ms,valid,samples,sample_count")
     .eq("session_id",targetId).order("lap_time_ms",{ascending:true,nullsFirst:false}).limit(5);
   requireOk(laps);
   return reply({pilot_slug:other.data.pilot_slug,session_id:targetId,laps:laps.data||[]});
 }
  // Compatibility during rollout: legacy profiles stay usable until the STAFF provisions an account.
 if(action==="pilot_account_ready"){
   const id=slug(clean(b.pilot_slug,100));
   if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))return reply({ready:false,listed:false});
   const roster=await readPilotRoster();
   const listed=roster.some((p:any)=>p.id===id);
   const account=listed?await pilotAccount(id):null;
   return reply({listed,ready:listed&&!!account&&account.app_metadata?.vce_pilot_active!==false});
 }
 // VCE CACHE (STAFF only). Only aggregates and metadata leave the server,
 // except for an explicitly requested STAFF export of one existing archive.
 if(action==="staff_cache_status"||action==="staff_cache_snapshot"||
    action==="staff_cache_reset"||action==="staff_cache_export"){
   const staff=await authorizedStaff(req);
   if(action==="staff_cache_status"){
     const cycle=await db.from("vce_training_control").select("cycle,updated_at,last_archive_id")
       .eq("id",1).single();requireOk(cycle);
     const archives=await db.from("vce_cache_archives")
       .select("id,operation,created_at,created_by")
       .order("created_at",{ascending:false}).limit(15);requireOk(archives);
     const submissions=await db.from("vce_training_submissions").select("session_id",{count:"exact",head:true});requireOk(submissions);
     const reviews=await db.from("vce_training_reviews").select("session_id",{count:"exact",head:true});requireOk(reviews);
     const assignment=await db.from("vce_publications").select("payload").eq("kind","training_assignments").maybeSingle();requireOk(assignment);
     return reply({cycle:cycle.data?.cycle||0,last_reset_at:cycle.data?.updated_at,
       archives:archives.data||[],training_assignments:Array.isArray(assignment.data?.payload?.items)?
       assignment.data.payload.items.length:0,submissions:submissions.count||0,reviews:reviews.count||0});
   }
   if(action==="staff_cache_export"){
     if(!UUID.test(b.archive_id||""))return reply({error:"Archive CACHE invalide"},400);
     const archive=await db.from("vce_cache_archives").select("id,created_at,operation,payload")
      .eq("id",b.archive_id).maybeSingle();requireOk(archive);
     if(!archive.data)return reply({error:"Archive CACHE introuvable"},404);
     return reply({archive:archive.data});
   }
   if(action==="staff_cache_reset"){
     if(b.confirmation!=="REINITIALISER ENTRAINEMENTS")
       return reply({error:"Confirmation écrite obligatoire : REINITIALISER ENTRAINEMENTS"},400);
     if(Number(b.expected_cycle)!==Number((await (async()=>{
       const row=await db.from("vce_training_control").select("cycle").eq("id",1).single();
       requireOk(row);return row.data?.cycle
     })())))return reply({error:"Cycle modifié entre-temps. Actualise avant de réessayer."},409);
   }
   const result=await db.rpc("vce_staff_cache_action",{
     p_staff_id:staff.id,
     p_operation:action==="staff_cache_snapshot"?"manual":"before_training_reset"
   });requireOk(result);
   return reply(result.data);
 }
 if(action==="staff_roster_list"){
   await authorizedStaff(req);
   return reply({items:await readPilotRoster()});
 }
 if(action==="staff_roster_add"){
   await authorizedStaff(req);
   const name=clean(b.pilot_name,120).replace(/\s+/g," ").trim().toUpperCase();
   if(name.length<3||name.length>100||name.split(" ").length<2||
      !/^[\p{L}\p{M} '-]+$/u.test(name))
     return reply({error:"Indique un prénom et un nom valides (100 caractères maximum)."},400);
   const id=slug(name);
   if(!id||id.length>100)return reply({error:"Identifiant pilote invalide"},400);
   const roster=await readPilotRoster();
   if(roster.some((p:any)=>p.id===id))
     return reply({error:"Ce pilote existe déjà dans la liste."},409);
   if(roster.length>=250)return reply({error:"Limite de 250 pilotes atteinte."},400);
   const credentials=await provisionVcePilot(id);
   try{await writePilotRoster([...roster,{id,name}]);}
   catch(e){await deactivateVcePilot(id).catch(()=>{});throw e}
   return reply({ok:true,items:[...roster,{id,name}],credentials});
 }
 if(action==="staff_roster_remove"){
   await authorizedStaff(req);
   const id=slug(clean(b.pilot_slug,100));
   const roster=await readPilotRoster();
   if(!roster.some((p:any)=>p.id===id))return reply({error:"Pilote absent de la liste."},404);
   await deactivateVcePilot(id);
   const next=roster.filter((p:any)=>p.id!==id);
   try{await writePilotRoster(next);}
   catch(e){
    const account=await pilotAccount(id);
    if(account)await db.auth.admin.updateUserById(account.id,{
     app_metadata:{...account.app_metadata,vce_pilot_active:true}
    }).catch(()=>{});
    throw e;
   }
   return reply({ok:true,items:next,disabled:id,history_preserved:true});
 }
 if(action==="staff_pilot_accounts"){
   await authorizedStaff(req);
   const users=await pilotAccounts();
   return reply({accounts:users.map((u:any)=>({
    pilot_slug:u.app_metadata.vce_pilot_slug,
    created_at:u.created_at,
    active:u.app_metadata.vce_pilot_active!==false,
    password_change_required:u.app_metadata.vce_password_change_required===true
   }))});
 }
 if(action==="staff_provision_pilot"||action==="staff_reset_pilot"){
   await authorizedStaff(req);
   const id=slug(clean(b.pilot_slug,100));
   if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))return reply({error:"Profil pilote invalide"},400);
   const roster=await readPilotRoster();
   if(!roster.some((p:any)=>p.id===id))return reply({error:"Pilote non présent dans le roster STAFF"},404);
   const existing=await pilotAccount(id),password=temporaryPassword();
   if(action==="staff_provision_pilot"&&existing)return reply({error:"Compte déjà créé. Utiliser réinitialisation si nécessaire."},409);
   if(action==="staff_reset_pilot"&&!existing)return reply({error:"Compte absent. Créer le compte."},404);
   let uid="";
   if(existing){
     const changed=await db.auth.admin.updateUserById(existing.id,{
       password,app_metadata:{...existing.app_metadata,vce_pilot_slug:id,vce_pilot_active:true,vce_password_change_required:true}
     });requireOk(changed);uid=existing.id;
   }else{
     const created=await db.auth.admin.createUser({
      email:pilotMail(id),password,email_confirm:true,
      app_metadata:{vce_pilot_slug:id,vce_password_change_required:true}
     });requireOk(created);if(!created.data.user)throw Error("Création du compte impossible");
     uid=created.data.user.id;
   }
   await associatePilotRecord(id,uid);
   return reply({ok:true,pilot_slug:id,identifier:"virtualcenterexperience",
    temporary_password:password,note:"Code provisoire visible une seule fois. À transmettre au pilote par un canal privé."});
 }
 if(action==="pilot_whoami"){
   const user=await authUser(req,true);
   return reply({pilot_slug:user.app_metadata?.vce_pilot_slug||null,
     password_change_required:user.app_metadata?.vce_password_change_required===true});
 }
 // VCE avatar: an authenticated, active pilot can publish only their OWN profile picture.
 // The bucket is public read-only; the service role remains exclusively in this Edge Function.
 if(action==="pilot_avatar_save"||action==="staff_avatar_save"){
   const isStaff=action==="staff_avatar_save";
   const user=isStaff?await authorizedStaff(req):await authUser(req);
   const id=isStaff?slug(clean(b.pilot_slug,100)):user.app_metadata?.vce_pilot_slug;
   if(isStaff){
     const currentRoster=await readPilotRoster();
     if(!currentRoster.some((p:any)=>p.id===id))
       return reply({error:"Pilote inexistant dans l'effectif actif."},404);
   }
   if(typeof id!=="string"||!id||slug(id)!==id)
     return reply({error:"Connexion avec un compte pilote requise."},403);
   const encoded=typeof b.image_base64==="string"?b.image_base64:"";
   if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length>245000||encoded.length<150)
     return reply({error:"Image JPEG invalide ou trop volumineuse (180 Ko maximum)."},400);
   let bytes:Uint8Array;
   try{bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))}
   catch{return reply({error:"Format image incorrect."},400)}
   if(bytes.length>180000||bytes.length<128||
     bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||
     bytes.at(-2)!==255||bytes.at(-1)!==217)
     return reply({error:"Fichier JPEG non valide."},400);
   const previous=await db.from("vce_pilot_avatars").select("storage_path")
      .eq("pilot_slug",id).maybeSingle();requireOk(previous);
   const path=id+"/"+crypto.randomUUID()+".jpg";
   const saved=await db.storage.from("vce-pilot-avatars")
     .upload(path,bytes,{contentType:"image/jpeg",cacheControl:"3600",upsert:false});
   requireOk(saved);
   const stamp=new Date().toISOString();
   const updated=await db.from("vce_pilot_avatars")
     .upsert({pilot_slug:id,storage_path:path,updated_at:stamp},{onConflict:"pilot_slug"});
   if(updated.error){
     await db.storage.from("vce-pilot-avatars").remove([path]);
     requireOk(updated);
   }
   if(previous.data?.storage_path&&previous.data.storage_path!==path){
     // Removal is best-effort; the new profile must never disappear after upload.
     try{await db.storage.from("vce-pilot-avatars").remove([previous.data.storage_path])}catch{}
   }
   return reply({ok:true,pilot_slug:id,storage_path:path,updated_at:stamp});
 }
 if(action==="pilot_change_password"){
   const user=await authUser(req,true);
   const id=user.app_metadata?.vce_pilot_slug;
   if(typeof id!=="string"||!id)return reply({error:"Compte pilote requis"},403);
   const password=typeof b.new_password==="string"?b.new_password:"";
   if(password.length<12||password.length>128||password.toLowerCase().includes("virtualcenterexperience")||
     id.split("-").some((part:string)=>part.length>=3&&password.toLowerCase().includes(part))||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))
     return reply({error:"Choisis 12 caractères minimum avec majuscule, minuscule et chiffre, sans ton prénom."},400);
   const updated=await db.auth.admin.updateUserById(user.id,{
    password,app_metadata:{...user.app_metadata,vce_pilot_slug:id,vce_password_change_required:false}
   });requireOk(updated);
   return reply({ok:true});
 }
 if(action==="staff_identity_diagnostics"){
   await authorizedStaff(req);
   const [devices,sessions]=await Promise.all([
     db.from("vce_agent_devices").select("device_id,status,steam_id64,local_ip,last_seen_at,pilot_slug").limit(500),
     db.from("vce_agent_sessions").select("session_id,pilot_slug,live_sample,created_at").order("created_at",{ascending:false}).limit(500)
   ]);
   requireOk(devices);requireOk(sessions);
   const ds=devices.data||[],ss=sessions.data||[];
   const recent=(time:any)=>Boolean(time&&Date.now()-new Date(time).getTime()<60000);
   return reply({ok:true,devices:ds.length,approved:ds.filter((x:any)=>x.status==="approved").length,
     steam_identified:ds.filter((x:any)=>!!x.steam_id64).length,
     ip_identified:ds.filter((x:any)=>!!x.local_ip).length,
     recently_seen:ds.filter((x:any)=>recent(x.last_seen_at)).length,
     sessions:ss.length,linked_sessions:ss.filter((x:any)=>!!x.pilot_slug).length,
     sessions_with_live:ss.filter((x:any)=>!!x.live_sample).length});
 }
 if(action==="staff_list"){
   await authorizedStaff(req);
   const rows=await db.from("vce_agent_devices")
     .select("device_id,requested_pilot,pilot_slug,steam_id64,local_ip,status,created_at,last_seen_at,current_game,current_state")
     .order("created_at",{ascending:false}).limit(200);requireOk(rows);
   return reply({devices:rows.data});
 }
 if(action==="staff_approve"){
   await authorizedStaff(req);
   if(!UUID.test(b.target_device_id||"")||!["approved","rejected"].includes(b.decision))return reply({error:"Décision invalide"},400);
   const pilot=slug(clean(b.pilot_slug,100));
   if(b.decision==="approved"&&!pilot)return reply({error:"Profil pilote requis"},400);
   const roster=b.decision==="approved"?await readPilotRoster():[];
   if(b.decision==="approved"&&!roster.some((p:any)=>p.id===pilot))
      return reply({error:"Ajoute ce pilote à la liste STAFF avant d'approuver son PC."},409);
   const account=b.decision==="approved"?await pilotAccount(pilot):null;
   const user=account&&account.app_metadata?.vce_pilot_active!==false?account.id:null;
   requireOk(await db.from("vce_agent_devices").update({status:b.decision,
     pilot_slug:b.decision==="approved"?pilot:null,pilot_auth_user:b.decision==="approved"?user:null,
     approved_at:b.decision==="approved"?new Date().toISOString():null}).eq("device_id",b.target_device_id));
   return reply({ok:true});
 }
 // STAFF history: paginate at the database, never return the entire session table.
 // Date arguments are local-day boundaries already converted to UTC ISO by the UI.
 if(action==="staff_session_history"){
   await authorizedStaff(req);
   const page=Number(b.page??0),pageSize=15;
   if(!Number.isSafeInteger(page)||page<0||page>99999)
     return reply({error:"Page d'historique invalide"},400);
   let query=db.from("vce_agent_sessions")
     .select("session_id,pilot_slug,game,track,car,started_at,ended_at,status,laps_count,best_lap_ms",{count:"exact"});
   const pilot=clean(b.pilot_slug,100);
   if(pilot){
     if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pilot))
       return reply({error:"Filtre pilote invalide"},400);
     query=query.eq("pilot_slug",pilot);
   }
   const game=clean(b.game,12);
   if(game){
     if(!GAMES.includes(game))return reply({error:"Filtre jeu invalide"},400);
     query=query.eq("game",game);
   }
   const status=clean(b.status,24);
   if(status){
     if(!["in_progress","completed","stopped"].includes(status))
       return reply({error:"Filtre état invalide"},400);
     query=query.eq("status",status);
   }
   for(const [field,operator] of [["after", "gte"],["before", "lt"]] as const){
     const value=clean(b[field],35);
     if(!value)continue;
     if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||
        !Number.isFinite(Date.parse(value)))
       return reply({error:"Filtre date invalide"},400);
     query=operator==="gte"?query.gte("started_at",value):query.lt("started_at",value);
   }
   const rows=await query.order("started_at",{ascending:false})
     .order("session_id",{ascending:false})
     .range(page*pageSize,(page+1)*pageSize-1);
   requireOk(rows);
   const total=rows.count??0;
   return reply({ok:true,sessions:rows.data||[],total,page,page_size:pageSize,
     pages:Math.ceil(total/pageSize),has_more:(page+1)*pageSize<total});
 }
 if(action==="staff_sessions"||action==="pilot_sessions"){
   const actor=action==="staff_sessions"?await authorizedStaff(req):null;
   const uid=actor?null:(await authUser(req)).id;
   let query=db.from("vce_agent_sessions")
    .select("session_id,device_id,pilot_slug,game,track,car,session_type,started_at,ended_at,status,laps_count,best_lap_ms,last_heartbeat_at,live_sample")
    .order("started_at",{ascending:false}).limit(100);
   if(uid)query=query.eq("pilot_auth_user",uid);
   const rows=await query;requireOk(rows);return reply({sessions:rows.data});
 }
 // Track quality is diagnostic only: never reconstruct a fake circuit on the server.
 function mapQuality(samples:any[]){
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,usable=0;
   for(const sample of samples||[]){
     const x=n(sample?.world_x,-1000000000,1000000000);
     const z=n(sample?.world_z,-1000000000,1000000000);
     if(x===null||z===null)continue;
     minX=Math.min(minX,x);maxX=Math.max(maxX,x);
     minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);usable++;
   }
   const spanX=usable?Math.round((maxX-minX)*100)/100:null;
   const spanZ=usable?Math.round((maxZ-minZ)*100)/100:null;
   const valid=usable>=8&&(spanX||0)>=3&&(spanZ||0)>=3;
   return {valid,coordinates:usable,total:Array.isArray(samples)?samples.length:0,
      span_x:spanX,span_z:spanZ,
      reason:valid?"ok":usable<8?"missing_xy":(spanZ||0)<3?"flat_z":(spanX||0)<3?"flat_x":"incomplete"};
 }
 if(action==="get_laps"){
   const u=await authUser(req),id=clean(b.session_id,50);
   if(!UUID.test(id))return reply({error:"Session invalide"},400);
   const session=await db.from("vce_agent_sessions").select("pilot_auth_user").eq("session_id",id).maybeSingle();requireOk(session);
   if(!session.data)return reply({error:"Session inconnue"},404);
   if(session.data.pilot_auth_user!==u.id)await authorizedStaff(req);
   const wanted=Math.min(8,Math.max(1,Number.isInteger(b.lap_limit)?b.lap_limit:5));
   let query=db.from("vce_agent_laps").select("lap_number,lap_time_ms,valid,samples,sample_count")
    .eq("session_id",id);
   const older=Number(b.before_lap);
   if(Number.isInteger(older)&&older>1)query=query.lt("lap_number",older);
   const rows=await query.order("lap_number",{ascending:false}).limit(wanted);requireOk(rows);
   rows.data?.reverse();
   return reply({laps:(rows.data||[]).map((row:any)=>({...row,map_quality:mapQuality(row.samples)}))});
 }
 return reply({error:"Action inconnue"},404);
 }catch(e){return reply({error:e instanceof Error?e.message:String(e)},403)}
});
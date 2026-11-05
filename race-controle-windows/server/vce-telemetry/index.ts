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
function reply(o:unknown,s=200){return new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}})}
function requireOk(r:{error:any}){if(r.error)throw Error(r.error.message)}
function clean(v:unknown,max=120){return typeof v==="string"?v.trim().slice(0,max):""}
function slug(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100)}
function n(v:unknown,min:number,max:number){if(v===null||v===undefined)return null;const x=Number(v);return Number.isFinite(x)&&x>=min&&x<=max?x:null}
async function digest(secret:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));return [...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,"0")).join("")}
async function device(b:any){
 if(!UUID.test(b.device_id||"")||!SECRET.test(b.device_secret||""))throw Error("Identifiant ou secret appareil invalide");
 const res=await db.from("vce_agent_devices").select("*").eq("device_id",b.device_id).maybeSingle();requireOk(res);
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
async function authUser(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const x=await db.auth.getUser(token);if(x.error||!x.data.user)throw Error("Connexion pilote requise");
 return x.data.user;
}
function normalizedSession(s:any,d:any,status:string){
 const start=n(s.started_at,946684800,5000000000),end=n(s.ended_at,946684800,5000000000);
 if(!UUID.test(s.session_id||"")||!GAMES.includes(s.game)||start===null)throw Error("Session invalide");
 if(status==="completed"&&end===null)throw Error("Date de fin manquante");
 return {session_id:s.session_id,device_id:d.device_id,pilot_slug:d.pilot_slug,
 pilot_auth_user:d.pilot_auth_user,game:s.game,track:clean(s.track),car:clean(s.car),
 started_at:new Date(start*1000).toISOString(),ended_at:end?new Date(end*1000).toISOString():null,
 laps_count:Math.min(100000,Math.max(0,Number(s.laps_count)||0)),
 best_lap_ms:n(s.best_lap_ms,10000,3600000),
 status,last_heartbeat_at:new Date().toISOString()};
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
   const hashed=await digest(secret);
   const old=await db.from("vce_agent_devices").select("secret_hash,status,steam_id64,requested_pilot").eq("device_id",id).maybeSingle();requireOk(old);
   if(old.data){
     if(old.data.secret_hash!==hashed)return reply({error:"Identifiant déjà utilisé"},403);
     if(old.data.requested_pilot!==requested||(old.data.steam_id64||"")!==steam){
       const up=await db.from("vce_agent_devices").update({requested_pilot:requested,steam_id64:steam||null,
         status:"pending",pilot_slug:null,pilot_auth_user:null,approved_at:null}).eq("device_id",id);requireOk(up);
       return reply({status:"pending",device_id:id});
     }
     return reply({status:old.data.status,device_id:id});
   }
   requireOk(await db.from("vce_agent_devices").insert({device_id:id,secret_hash:hashed,requested_pilot:requested,
     steam_id64:steam||null,status:"pending"}));
   return reply({status:"pending",device_id:id});
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
     world_x:n(x.world_x,-1000000000,1000000000),world_z:n(x.world_z,-1000000000,1000000000)}));
   requireOk(await db.from("vce_agent_laps").upsert({session_id:s.session_id,lap_number:number,
     lap_time_ms:n(lap.lap_time_ms,10000,3600000),valid:typeof lap.valid==="boolean"?lap.valid:null,
     sample_count:samples.length,samples},{onConflict:"session_id,lap_number"}));
   requireOk(await db.from("vce_agent_devices").update({last_seen_at:new Date().toISOString()}).eq("device_id",d.device_id));
   return reply({ok:true,session_id:s.session_id,lap_number:number});
 }
 if(action==="staff_list"){
   await authorizedStaff(req);
   const rows=await db.from("vce_agent_devices")
     .select("device_id,requested_pilot,pilot_slug,steam_id64,status,created_at,last_seen_at,current_game,current_state")
     .order("created_at",{ascending:false}).limit(200);requireOk(rows);
   return reply({devices:rows.data});
 }
 if(action==="staff_approve"){
   await authorizedStaff(req);
   if(!UUID.test(b.target_device_id||"")||!["approved","rejected"].includes(b.decision))return reply({error:"Décision invalide"},400);
   const pilot=slug(clean(b.pilot_slug,100));
   if(b.decision==="approved"&&!pilot)return reply({error:"Profil pilote requis"},400);
   const user=b.pilot_auth_user?String(b.pilot_auth_user):null;
   if(user&&!UUID.test(user))return reply({error:"Compte pilote invalide"},400);
   requireOk(await db.from("vce_agent_devices").update({status:b.decision,
     pilot_slug:b.decision==="approved"?pilot:null,pilot_auth_user:b.decision==="approved"?user:null,
     approved_at:b.decision==="approved"?new Date().toISOString():null}).eq("device_id",b.target_device_id));
   return reply({ok:true});
 }
 if(action==="staff_sessions"||action==="pilot_sessions"){
   const actor=action==="staff_sessions"?await authorizedStaff(req):null;
   const uid=actor?null:(await authUser(req)).id;
   let query=db.from("vce_agent_sessions")
    .select("session_id,device_id,pilot_slug,game,track,car,started_at,ended_at,status,laps_count,best_lap_ms,last_heartbeat_at")
    .order("started_at",{ascending:false}).limit(100);
   if(uid)query=query.eq("pilot_auth_user",uid);
   const rows=await query;requireOk(rows);return reply({sessions:rows.data});
 }
 if(action==="get_laps"){
   const u=await authUser(req),id=clean(b.session_id,50);
   if(!UUID.test(id))return reply({error:"Session invalide"},400);
   const session=await db.from("vce_agent_sessions").select("pilot_auth_user").eq("session_id",id).maybeSingle();requireOk(session);
   if(!session.data)return reply({error:"Session inconnue"},404);
   if(session.data.pilot_auth_user!==u.id)await authorizedStaff(req);
   const rows=await db.from("vce_agent_laps").select("lap_number,lap_time_ms,valid,samples")
    .eq("session_id",id).order("lap_number").limit(100);requireOk(rows);
   return reply({laps:rows.data});
 }
 return reply({error:"Action inconnue"},404);
 }catch(e){return reply({error:e instanceof Error?e.message:String(e)},403)}
});

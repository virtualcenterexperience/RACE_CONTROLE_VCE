import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const origin="https://virtualcenterexperience.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return reply({error:"method_not_allowed"},405);
 if(req.headers.get("Origin")&&req.headers.get("Origin")!==origin)return reply({error:"origin_not_allowed"},403);
 const base=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!pub||!secret)return reply({error:"server_configuration_unavailable"},503);
 const auth=req.headers.get("Authorization")||"";
 if(!/^Bearer \S+$/.test(auth))return reply({error:"authentication_required"},401);
 const client=createClient(base,pub,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:auth}}});
 const {data:{user},error:authError}=await client.auth.getUser(auth.slice(7));
 if(authError||!user)return reply({error:"authentication_unavailable_or_invalid"},401);
 const check=await client.rpc("vce_is_staff");
 if(check.error)return reply({error:"staff_verification_unavailable"},503);
 if(check.data!==true)return reply({error:"staff_required"},403);
 // Elevated database access is deliberately instantiated only AFTER a
 // verified Staff identity and server-side vce_is_staff permission check.
 const admin=createClient(base,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.from("vce_agent_sessions")
  .select("session_id,pilot_slug,game,track,car,started_at,ended_at,status,laps_count,best_lap_ms")
  .order("started_at",{ascending:false})
  .limit(30);
 if(error)return reply({error:"history_unavailable",code:error.code},503);
 return reply({service:"vce-telemetry-history",items:data||[],count:data?.length||0,limit:30});
});

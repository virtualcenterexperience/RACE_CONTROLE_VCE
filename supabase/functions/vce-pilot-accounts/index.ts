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
 // Do not expose password hashes, email addresses, Auth JWTs or reset secrets.
 const admin=createClient(base,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000});
 if(error)return reply({error:"pilot_accounts_unavailable"},503);
 const accounts=(data?.users||[])
  .filter(u=>typeof u.app_metadata?.vce_pilot_slug==="string")
  .map(u=>({
    pilot_slug:u.app_metadata.vce_pilot_slug,
    created_at:u.created_at,
    active:u.app_metadata.vce_pilot_active!==false,
    password_change_required:u.app_metadata.vce_password_change_required===true
  }));
 return reply({service:"vce-pilot-accounts",items:accounts,count:accounts.length,limit:1000});
});

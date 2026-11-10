/* VCE Staff — verified website activity for pilot accounts.
   Staff-only RLS data, server-generated timestamps. Separate from game/agent presence. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const c=()=>window.VCE_SUPABASE||{};
 const ONLINE_MS=105000;
 let active=false,loading=false,cache=new Map(),roster=[],loadAt=0;
 const clock=()=>Date.now();
 const validDate=value=>{const ms=Date.parse(value||'');return Number.isFinite(ms)?ms:0};
 function label(d){
  if(!d?.lastSeen)return {state:'unknown',text:'Aucune connexion enregistrée'};
  const diff=Math.max(0,clock()-d.lastSeen),online=d.online&&diff<ONLINE_MS;
  if(online)return {state:'online',text:'En ligne'};
  if(diff<60000)return {state:'offline',text:'Vu à l’instant'};
  if(diff<3600000)return {state:'offline',text:'Vu il y a '+Math.floor(diff/60000)+' min'};
  if(diff<86400000)return {state:'offline',text:'Vu il y a '+Math.floor(diff/3600000)+' h'};
  if(diff<604800000)return {state:'offline',text:'Vu il y a '+Math.floor(diff/86400000)+' j'};
  if(diff<2592000000)return {state:'offline',text:'Vu il y a '+Math.floor(diff/604800000)+' sem.'};
  return {state:'offline',text:'Vu il y a '+Math.floor(diff/2592000000)+' mois'};
 }
 window.VCEPilotPresenceStatus=id=>label(cache.get(id));
 function icon(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e}
 function mount(){
  const host=$('staff-pilotes');if(!host)return null;
  let panel=$('vce-site-presence');
  if(!panel){
   panel=icon('section','vce-site-presence');panel.id='vce-site-presence';
   const header=icon('div','vce-site-presence-header');
   const left=icon('div','');left.append(icon('h3','','ACTIVITÉ DES PILOTES'),icon('p','','Présence vérifiée sur le site · distincte de l’application de télémétrie'));
   const refresh=icon('button','vce-site-presence-refresh','↻ Actualiser');
   refresh.type='button';refresh.onclick=()=>update(true);header.append(left,refresh);
   const meta=icon('div','vce-site-presence-meta','Chargement des connexions…');meta.id='vce-site-presence-meta';
   const grid=icon('div','vce-site-presence-grid');grid.id='vce-site-presence-grid';
   panel.append(header,meta,grid);
   host.querySelector('.vce-staff-hub-heading')?.after(panel);
  }
  return panel;
 }
 function render(){
  const grid=$('vce-site-presence-grid'),meta=$('vce-site-presence-meta');if(!grid||!meta)return;
  grid.replaceChildren();
  if(!roster.length){meta.textContent='Aucun profil pilote disponible.';return}
  let count=0;
  for(const p of roster){
   const state=label(cache.get(p.id));if(state.state==='online')count++;
   const item=icon('article','vce-site-presence-entry');
   item.dataset.online=state.state==='online'?'true':'false';
   const avatar=icon('span','vce-site-presence-avatar',String(p.name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
   const text=icon('div','vce-site-presence-name');
   text.append(icon('strong','',p.name),icon('small','',state.text));
   const dot=icon('span','vce-site-presence-dot');dot.setAttribute('aria-label',state.state==='online'?'En ligne':'Hors ligne');
   item.append(avatar,text,dot);grid.append(item);
  }
  meta.textContent=count+' pilote'+(count>1?'s':'')+' actif'+(count>1?'s':'')+' sur le site · '+roster.length+' profils';
  window.dispatchEvent(new Event('vce-site-presence-updated'));
 }
 async function update(force=false){
  if(loading||document.hidden||!window.VCESupabase?.session())return;
  if(!force&&Date.now()-loadAt<25000){render();return}
  loading=true;
  try{
   if(!await window.VCESupabase.isStaff())return;
   const session=await window.VCESupabase.validSession(),cfg=c();
   if(!session?.access_token)throw Error('Session STAFF expirée');
   // Pilot names are published by the STAFF. No untrusted name is accepted from presence clients.
   const [base,res]=await Promise.all([
    window.VCESupabase.read('pilotes'),
    fetch(cfg.url+'/rest/v1/vce_pilot_presence?select=pilot_slug,last_seen_at,disconnected_at&order=last_seen_at.desc&limit=150',{
     method:'GET',cache:'no-store',signal:AbortSignal.timeout(9500),
     headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token}
    })
   ]);
   if(!res.ok)throw Error('Lecture Supabase '+res.status);
   const records=await res.json();
   if(!Array.isArray(records))throw Error('Réponse de présence invalide');
   roster=Array.isArray(base.items)?base.items.filter(p=>p?.id&&p?.name):[];
   const next=new Map();
   for(const p of records){
    if(!p?.pilot_slug)continue;
    const ms=validDate(p.last_seen_at),disconnected=validDate(p.disconnected_at);
    const value=next.get(p.pilot_slug)||{lastSeen:0,online:false};
    if(ms>value.lastSeen)value.lastSeen=ms;
    if(ms&&(!disconnected||disconnected<ms-500))value.online=true;
    next.set(p.pilot_slug,value);
   }
   cache=next;loadAt=Date.now();render()
  }catch(e){const meta=$('vce-site-presence-meta');if(meta)meta.textContent='Présence temporairement indisponible : '+e.message}
  finally{loading=false}
 }
 function start(){
  mount();
  const onRoute=()=>{const isVisible=location.hash==='#staff-pilotes'||location.hash==='#gestion-pilotes';
   active=isVisible;
   if(isVisible)update(true)
  };
  window.addEventListener('hashchange',onRoute);
  window.addEventListener('vce-staff-authenticated',onRoute);
  window.addEventListener('vce-staff-logged-out',()=>{roster=[];cache.clear();loadAt=0;render()});
  window.addEventListener('pageshow',onRoute);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)update(true)});
  setInterval(()=>{if(active&&window.VCESupabase?.session())update()},30000);
  setInterval(()=>{if(active)render()},30000);
  onRoute()
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
/* VCE Staff — verified website activity for pilot accounts.
   Staff-only RLS data, server-generated timestamps. Separate from game/agent presence. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const c=()=>window.VCE_SUPABASE||{};
 const ONLINE_MS=105000;
 let active=false,loading=false,cache=new Map(),roster=[],history=[],loadAt=0,filter='all',search='',selected='';
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
 function localTime(input){
  const d=new Date(input);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 }
 function sessionState(row){
  const ms=validDate(row.last_seen_at),end=validDate(row.disconnected_at);
  return ms>0&&(!end||end<ms)&&clock()-ms<ONLINE_MS;
 }
 function mount(){
  const host=$('staff-pilotes');if(!host)return null;
  let panel=$('vce-site-presence');
  if(panel)return panel;
  panel=icon('section','vce-site-presence');panel.id='vce-site-presence';
  const header=icon('div','vce-site-presence-header');
  const left=icon('div','');
  left.append(icon('small','vce-site-presence-kicker','VCE RACE CONTROL / PILOT OPERATIONS'),
   icon('h3','','CONNEXIONS PILOTES'),
   icon('p','','Activité réelle du site · sessions enregistrées par Supabase · consultation réservée au STAFF'));
  const refresh=icon('button','vce-site-presence-refresh','↻ Actualiser');refresh.type='button';refresh.onclick=()=>update(true);
  header.append(left,refresh);
  const meta=icon('div','vce-site-presence-meta','Chargement des connexions…');meta.id='vce-site-presence-meta';
  const grid=icon('div','vce-site-presence-grid');grid.id='vce-site-presence-grid';
  const historySection=icon('section','vce-site-history');historySection.id='vce-site-history';
  const head=icon('div','vce-site-history-head');
  head.append(icon('div','',undefined),icon('div','',''));
  head.firstChild.append(icon('small','vce-site-presence-kicker','SESSION LOG / EUROPE-PARIS'),icon('h3','','HISTORIQUE DES CONNEXIONS'));
  head.lastChild.append(icon('small','','Première connexion enregistrée · dernière activité · déconnexion'));
  const controls=icon('div','vce-site-history-controls');
  const q=document.createElement('input');q.type='search';q.placeholder='Rechercher un pilote…';q.id='vce-presence-search';q.setAttribute('aria-label','Rechercher un pilote');
  q.addEventListener('input',()=>{search=q.value.trim().toLowerCase();renderHistory()});
  const select=document.createElement('select');select.id='vce-presence-filter';select.setAttribute('aria-label','Filtrer les connexions');
  for(const [value,name] of [['all','Toutes les connexions'],['online','En ligne'],['offline','Déconnectés']])select.append(new Option(name,value));
  select.addEventListener('change',()=>{filter=select.value;renderHistory()});
  controls.append(q,select);
  const content=icon('div','vce-site-history-list');content.id='vce-site-history-list';
  const note=icon('p','vce-site-history-note','Les heures sont enregistrées par Supabase. Les connexions antérieures à l’activation du suivi ne peuvent pas être reconstituées.');
  historySection.append(head,controls,content,note);
  panel.append(header,meta,grid,historySection);
  host.querySelector('.vce-staff-hub-heading')?.after(panel);
  return panel;
 }
 function renderHistory(){
  const target=$('vce-site-history-list');if(!target)return;
  target.replaceChildren();
  const names=new Map(roster.map(p=>[p.id,p.name]));
  const items=history.filter(h=>{
    const live=sessionState(h);
    if(filter==='online'&&!live)return false;
    if(filter==='offline'&&live)return false;
    const name=names.get(h.pilot_slug)||h.pilot_slug;
    return !search||(name+' '+h.pilot_slug).toLowerCase().includes(search)
  });
  if(!items.length){
   target.append(icon('p','vce-site-history-empty',history.length?'Aucune session ne correspond aux filtres.':'Aucune connexion pilote enregistrée depuis l’activation du suivi.'));
   return
  }
  // A session has one first-seen date, a last activity date and an optional explicit logout.
  const list=items.slice(0,100);
  for(const h of list){
    const live=sessionState(h),name=names.get(h.pilot_slug)||h.pilot_slug;
    const row=icon('article','vce-site-history-row');row.dataset.online=String(live);
    const badge=icon('span','vce-site-history-index',String(list.indexOf(h)+1).padStart(2,'0'));
    const title=icon('div','vce-site-history-name');
    title.append(icon('strong','',name),icon('small','',live?'● EN LIGNE':'● HORS LIGNE'));
    const connected=icon('div','vce-site-history-time');connected.append(icon('small','','CONNEXION'),icon('strong','',localTime(h.connected_at||h.last_seen_at)));
    const seen=icon('div','vce-site-history-time');seen.append(icon('small','','DERNIÈRE ACTIVITÉ'),icon('strong','',localTime(h.last_seen_at)));
    const ended=icon('div','vce-site-history-time');ended.append(icon('small','','DÉCONNEXION'),icon('strong','',h.disconnected_at?localTime(h.disconnected_at):(live?'En cours':'Fin non confirmée')));
    row.append(badge,title,connected,seen,ended);target.append(row)
  }
 }
 function render(){
  const grid=$('vce-site-presence-grid'),meta=$('vce-site-presence-meta');if(!grid||!meta)return;
  grid.replaceChildren();
  if(!roster.length)meta.textContent='Aucun profil disponible dans l’effectif STAFF.';
  let count=0;
  for(const [i,p] of roster.entries()){
   const state=label(cache.get(p.id));if(state.state==='online')count++;
   const item=icon('article','vce-site-presence-entry');item.dataset.online=state.state==='online'?'true':'false';
   const number=icon('span','vce-site-presence-number',String(i+1).padStart(2,'0'));
   const name=icon('div','vce-site-presence-name');name.append(icon('strong','',p.name),icon('small','',state.text));
   const dot=icon('span','vce-site-presence-dot');dot.setAttribute('aria-label',state.state==='online'?'En ligne':'Hors ligne');
   item.append(number,name,dot);grid.append(item);
  }
  if(roster.length)meta.textContent=count+' en ligne · '+roster.length+' pilotes dans l’effectif · '+history.length+' sessions enregistrées';
  renderHistory();
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
    fetch(cfg.url+'/rest/v1/vce_pilot_presence?select=pilot_slug,connected_at,last_seen_at,disconnected_at&order=last_seen_at.desc&limit=300',{
     method:'GET',cache:'no-store',signal:AbortSignal.timeout(9500),
     headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token}
    })
   ]);
   if(!res.ok)throw Error('Lecture Supabase '+res.status);
   const records=await res.json();
   if(!Array.isArray(records))throw Error('Réponse de présence invalide');
   roster=Array.isArray(base.items)?base.items.filter(p=>p?.id&&p?.name):[];
   history=records.filter(p=>p?.pilot_slug&&validDate(p.last_seen_at)>0).sort((a,b)=>validDate(b.last_seen_at)-validDate(a.last_seen_at));
   const next=new Map();
   for(const h of history){
    const value=next.get(h.pilot_slug)||{lastSeen:0,online:false};
    const seen=validDate(h.last_seen_at);
    value.lastSeen=Math.max(value.lastSeen,seen);
    value.online=value.online||sessionState(h);
    next.set(h.pilot_slug,value);
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
  window.addEventListener('vce-staff-logged-out',()=>{roster=[];history=[];cache.clear();loadAt=0;render()});
  window.addEventListener('pageshow',onRoute);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)update(true)});
  setInterval(()=>{if(active&&window.VCESupabase?.session())update()},30000);
  setInterval(()=>{if(active)render()},30000);
  onRoute()
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
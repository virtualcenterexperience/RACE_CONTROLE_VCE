/* STAFF TELEMETRY · Bounded, filterable, server-paginated session history. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const root=$('vceHistory');if(!root)return;
const state={page:0,pages:0,total:0,opened:false,busy:false,filters:null,request:0};
const size=15;
const controls=['vceHistoryPilot','vceHistoryGame','vceHistoryState','vceHistoryFrom','vceHistoryTo'];
function filters(){
 const day=x=>x?new Date(x+'T00:00:00').toISOString():null;
 const until=x=>{if(!x)return null;const d=new Date(x+'T00:00:00');d.setDate(d.getDate()+1);return d.toISOString()};
 return {pilot_slug:$('vceHistoryPilot').value,game:$('vceHistoryGame').value,
   status:$('vceHistoryState').value,after:day($('vceHistoryFrom').value),
   before:until($('vceHistoryTo').value)}
}
function textCell(row,text){const td=document.createElement('td');td.textContent=text==null||text===''?'—':String(text);row.append(td);return td}
function fmtDate(raw){if(!raw)return '—';const date=new Date(raw);return Number.isNaN(date.getTime())?'—':date.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}
function fmtLap(ms){
 if(!Number.isFinite(Number(ms))||Number(ms)<=0)return '—';
 const time=Math.round(Number(ms));return Math.floor(time/60000)+':'+String(Math.floor(time%60000/1000)).padStart(2,'0')+'.'+String(time%1000).padStart(3,'0')
}
async function api(action,extra={}){
 const session=await window.VCESupabase?.validSession();
 const cfg=window.VCE_SUPABASE;
 if(!session?.access_token||!cfg?.url||!cfg?.key)throw Error('Connexion STAFF requise.');
 const res=await fetch(cfg.url+'/functions/v1/vce-telemetry',{
   method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({action,...extra}),cache:'no-store'
 });
 const body=await res.json().catch(()=>({error:'Réponse serveur invalide'}));
 if(!res.ok||body.error)throw Error(body.error||'Erreur '+res.status);
 return body
}
function status(message){$('vceHistorySummary').textContent=message}
function uiBusy(on){
 state.busy=on;
 for(const id of ['vceHistoryPrevious','vceHistoryNext','vceHistoryRefresh','vceHistoryReset'])$(id).disabled=on;
 if(!on){
  $('vceHistoryPrevious').disabled=state.page<=0;
  $('vceHistoryNext').disabled=state.page+1>=state.pages
 }
}
async function pilots(){
 try{
  const result=await api('staff_roster_list');
  const select=$('vceHistoryPilot'),current=select.value;
  if(!Array.isArray(result.items))return;
  select.replaceChildren(new Option('Tous les pilotes',''));
  for(const p of result.items.filter(p=>p?.id&&p?.name))select.add(new Option(p.name,p.id));
  // Old pilot histories remain accessible with a manually preserved filter.
  if(current&&!Array.from(select.options).some(x=>x.value===current))select.add(new Option(current,current));
  select.value=current;
 }catch(e){console.warn('Sélection pilotes historique',e)}
}
function render(data){
 const body=$('sessions');body.replaceChildren();
 for(const s of data.sessions||[]){
  const tr=document.createElement('tr');
  textCell(tr,s.pilot_slug);textCell(tr,s.game);textCell(tr,s.track);textCell(tr,s.car);
  textCell(tr,fmtDate(s.started_at));textCell(tr,s.status);textCell(tr,s.laps_count);
  textCell(tr,fmtLap(s.best_lap_ms));
  const action=textCell(tr,'');
  if(s.pilot_slug){
   for(const [label,view] of [['Tours','tour'],['Setup','setup']]){
    const a=document.createElement('a');a.className='vce-history-link';
    a.href='telemetry.html?view='+view+'#'+encodeURIComponent(s.pilot_slug);
    a.textContent=label;
    a.title='Ouvrir '+view+' du pilote '+s.pilot_slug;
    action.append(a)
   }
  }
  body.append(tr)
 }
 if(!body.children.length){const tr=document.createElement('tr');const td=textCell(tr,'Aucune séance pour ces filtres.');td.colSpan=9;body.append(tr)}
 const first=state.total===0?0:state.page*size+1,last=Math.min((state.page+1)*size,state.total);
 status('Séances '+first+' à '+last+' sur '+state.total+' au total.');
 $('vceHistoryPage').textContent='Page '+(state.pages?state.page+1:0)+' / '+state.pages
}
async function load(page=state.page){
 if(!state.opened||state.busy)return;
 uiBusy(true);status('Chargement de l’historique…');
 try{
  const response=await api('staff_session_history',{page,...filters()});
  if(response.ok!==true||!Array.isArray(response.sessions))throw Error('Réponse inattendue du serveur.');
  state.page=response.page;
  state.total=response.total;
  state.pages=response.pages;
  render(response);
 }catch(e){
  status('Erreur : '+e.message);
  const body=$('sessions');body.replaceChildren();const tr=document.createElement('tr');
  const td=textCell(tr,'Impossible de charger les séances. Réessaie avec Actualiser.');td.colSpan=9;body.append(tr)
 }finally{uiBusy(false)}
}
$('vceHistoryToggle').addEventListener('click',()=>{
 state.opened=!state.opened;
 $('vceHistoryContent').hidden=!state.opened;
 $('vceHistoryToggle').setAttribute('aria-expanded',String(state.opened));
 $('vceHistoryToggle').textContent=state.opened?'Masquer l’historique':'Ouvrir l’historique';
 if(state.opened){pilots();load(0)}
});
for(const id of controls)$(id).addEventListener('change',()=>{state.page=0;load(0)});
$('vceHistoryPrevious').addEventListener('click',()=>{if(state.page>0)load(state.page-1)});
$('vceHistoryNext').addEventListener('click',()=>{if(state.page+1<state.pages)load(state.page+1)});
$('vceHistoryRefresh').addEventListener('click',()=>load());
$('vceHistoryReset').addEventListener('click',()=>{
 for(const id of controls)$(id).value='';state.page=0;load(0)
});
$('vceHistoryPrevious').disabled=true;$('vceHistoryNext').disabled=true;
// Poll only when visible and unfiltered on page 1, to avoid interrupting STAFF browsing.
setInterval(()=>{
 if(!state.opened||document.hidden||state.busy||state.page!==0)return;
 if(controls.some(id=>Boolean($(id).value)))return;
 load(0);
},60000);
})();
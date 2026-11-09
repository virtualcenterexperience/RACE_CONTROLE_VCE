/* VCE COACH IRL — official evaluation guide and STAFF-only Supabase dossiers.
   No XP or class changes; raw laps and invalidation flags remain reviewable. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),val=id=>$(id)?.value?.trim()||'';
const mk=(tag,cls='',content='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=content;return e};
let protocol=null,currentId=null;
const fmt=t=>Number.isFinite(t)?Math.floor(t/60)+':'+(t%60).toFixed(3).padStart(6,'0'):'—';
function parseTime(line){
 const text=String(line||'').trim();if(!text)return null;
 const flag=text[0]==='!'?'invalid':/^[OI] /i.test(text)?'out-in':'clean';
 const cleaned=text.replace(/^!/, '').replace(/^[OI]\s*/i,'').trim().replace(',','.');
 const parts=cleaned.split(':');const n=parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(cleaned);
 return {text,flag,time:Number.isFinite(n)&&n>0&&n<1800?n:null};
}
function stat(values){
 if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),avg=values.reduce((a,b)=>a+b,0)/values.length;
 const median=sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
 const stdev=Math.sqrt(values.reduce((a,b)=>a+(b-avg)**2,0)/values.length);
 return {count:values.length,best:sorted[0],mean:avg,median,stdev,range:sorted.at(-1)-sorted[0]};
}
function renderProtocol(){
 const schedule=$('vce-irl-schedule'),tests=$('vce-irl-tests'),dev=$('vce-irl-development');if(!protocol)return;
 if(schedule){const table=mk('table','vce-irl-table');const tbody=document.createElement('tbody');
  for(const [label,min] of protocol.schedule||[]){const tr=document.createElement('tr');tr.append(mk('th','',label),mk('td','',min+' min'));tbody.append(tr)}table.append(tbody);schedule.replaceChildren(table)}
 if(tests){tests.replaceChildren();for(const t of protocol.tests||[]){
  const card=mk('article','vce-irl-test');card.append(mk('h3','',t.title),mk('p','',(t.car||'')+' · '+(t.track||'')));
  for(const seg of t.segments||[]){card.append(mk('small','vce-irl-segment',seg.name+' · '+(seg.laps??t.duration_minutes+' min')+' '+(seg.laps?'tours':'')))}
  card.append(mk('p','',t.rules||''));card.append(mk('small','',t.indicators?.join(' · ')||''));tests.append(card)}}
 if(dev){dev.replaceChildren();for(const week of protocol.development||[]){
  const article=mk('article','vce-irl-week');article.append(mk('h3','','SEMAINE '+week.week+' · '+week.goal),mk('p','',week.sessions),mk('small','',week.result));dev.append(article)}}
 const decision=$('vce-irl-decision');if(decision)decision.replaceChildren(...(protocol.decision_options||[]).map(([key,phrase])=>new Option(phrase,key)));
}
function renderStaff(){
 const entry=$('vce-irl-entry'),notes=$('vce-irl-notes');if(!entry||!notes||!protocol)return;
 entry.replaceChildren();for(const test of protocol.tests||[]){
  const block=mk('fieldset','vce-irl-entry');block.append(mk('legend','',test.title));
  for(const seg of test.segments||[]){const label=mk('label','',(seg.name||seg.id)+' · '+(seg.laps??'durée libre')+' tour(s)');
   const textarea=document.createElement('textarea');textarea.dataset.test=test.id;textarea.dataset.segment=seg.id;textarea.rows=4;textarea.placeholder='1:58.432\n!1:59.004\nO 2:03.710';
   textarea.addEventListener('input',()=>{clearTimeout(textarea._timer);textarea._timer=setTimeout(metrics,220)});
   label.append(textarea);block.append(label)}entry.append(block)}
 notes.replaceChildren();for(const field of protocol.categories||[]){
  const label=mk('label','',field.name+' · '+field.instructions);
  const area=document.createElement('textarea');area.rows=3;area.dataset.category=field.id;
  area.placeholder='Observations factuelles, virage et tour concernés…';
  label.append(area);notes.append(label)}
}
function metrics(){
 const all=[],result=$('vce-irl-metrics');if(!result)return;
 const output=mk('div','vce-irl-stats');let invalid=0,inc=0;
 for(const field of document.querySelectorAll('#vce-irl-entry textarea')){
  const rows=field.value.split(/\r?\n/).map(parseTime).filter(Boolean);
  invalid+=rows.filter(x=>x.flag==='invalid'||x.time===null).length;
  inc+=rows.filter(x=>x.flag==='out-in').length;
  const clean=rows.filter(x=>x.flag==='clean'&&x.time!==null).map(x=>x.time);
  const stats=stat(clean);if(stats){all.push(...clean);
    const line=mk('p','',''+field.closest('fieldset')?.querySelector('legend')?.textContent+' / '+field.dataset.segment+' : '+stats.count+' tours propres · meilleur '+fmt(stats.best)+' · moyenne '+fmt(stats.mean)+' · écart-type '+stats.stdev.toFixed(3)+' s');
    output.append(line)}
 }
 output.prepend(mk('strong','',all.length+' tours propres · '+invalid+' invalides / illisibles · '+inc+' sortie/rentrée'));
 result.replaceChildren(output);
}
async function api(path,options={}){
 const c=window.VCE_SUPABASE||{},session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Authentification STAFF requise.');
 if(!await window.VCESupabase.isStaff())throw Error('Droits STAFF insuffisants.');
 const res=await fetch(c.url+'/rest/v1/'+path,{method:options.method||'GET',cache:'no-store',signal:AbortSignal.timeout(14000),
  headers:{apikey:c.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',...(options.headers||{})},
  ...(options.body?{body:JSON.stringify(options.body)}:{})});
 const payload=await res.json().catch(()=>[]);
 if(!res.ok)throw Error('Supabase HTTP '+res.status+' · '+(payload?.message||payload?.hint||'Requête refusée'));
 return payload;
}
function collect(){
 const blocks={};for(const el of document.querySelectorAll('#vce-irl-entry textarea')){
  if(!blocks[el.dataset.test])blocks[el.dataset.test]={};
  blocks[el.dataset.test][el.dataset.segment]=el.value.split(/\r?\n/).map(parseTime).filter(Boolean)
 }
 const notes={};for(const el of document.querySelectorAll('#vce-irl-notes textarea'))notes[el.dataset.category]=el.value.trim();
 return {date:val('vce-irl-date'),coach:val('vce-irl-coach'),settings:val('vce-irl-settings'),
  equipment:val('vce-irl-equipment'),decision:val('vce-irl-decision'),approval:val('vce-irl-approval'),
  reason:val('vce-irl-reason'),plan:val('vce-irl-plan'),blocks,notes,protocol_version:protocol.version};
}
function fill(row){
 currentId=row?.id||null;const d=row?.payload||{};
 for(const [id,key] of [['vce-irl-pilot','pilot_slug'],['vce-irl-phase','phase']]){if($(id))$(id).value=String(row?.[key]||'')}
 for(const [id,key] of [['vce-irl-date','date'],['vce-irl-coach','coach'],['vce-irl-settings','settings'],['vce-irl-equipment','equipment'],['vce-irl-decision','decision'],['vce-irl-approval','approval'],['vce-irl-reason','reason'],['vce-irl-plan','plan']])if($(id))$(id).value=String(d[key]||'');
 for(const el of document.querySelectorAll('#vce-irl-entry textarea'))el.value=(d.blocks?.[el.dataset.test]?.[el.dataset.segment]||[]).map(x=>x.text).join('\n');
 for(const el of document.querySelectorAll('#vce-irl-notes textarea'))el.value=d.notes?.[el.dataset.category]||'';
 metrics();
}
async function list(){
 const rows=await api('vce_irl_evaluations?select=id,pilot_slug,phase,status,payload,created_at&order=created_at.desc&limit=60');
 const host=$('vce-irl-list');host.replaceChildren();
 if(!rows.length){host.textContent='Aucun dossier STAFF enregistré.';return}
 for(const row of rows){const b=mk('button','secondary',row.pilot_slug+' · '+row.phase+' · '+new Date(row.created_at).toLocaleDateString('fr-FR'));
  b.onclick=()=>fill(row);host.append(b)}
}
async function save(){
 const status=$('vce-irl-status'),slug=val('vce-irl-pilot').toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){status.textContent='Identifiant pilote invalide.';return}
 const payload=collect(),phase=val('vce-irl-phase');
 if(!payload.date||!payload.coach){status.textContent='Date et coach sont obligatoires.';return}
 try{status.textContent='Enregistrement STAFF…';
  const session=await window.VCESupabase.validSession();const body={pilot_slug:slug,phase,status:payload.decision?'reviewed':'draft',protocol_version:protocol.version,payload};
  let res;
  if(currentId)res=await api('vce_irl_evaluations?id=eq.'+encodeURIComponent(currentId),{method:'PATCH',headers:{Prefer:'return=representation'},body});
  else res=await api('vce_irl_evaluations',{method:'POST',headers:{Prefer:'return=representation'},body:{...body,created_by:session.user?.id}});
  if(res?.[0]?.id)currentId=res[0].id;
  status.textContent='Dossier enregistré dans Supabase. Aucun XP attribué automatiquement.';await list()
 }catch(e){status.textContent='Enregistrement refusé : '+e.message}
}
function exportFile(){
 const blob=new Blob([JSON.stringify({pilot:val('vce-irl-pilot'),phase:val('vce-irl-phase'),payload:collect()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VCE-evaluation-'+(val('vce-irl-pilot')||'pilote')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)
}
async function init(){
 try{const res=await fetch('data/vce/coach-irl-protocol.json',{cache:'force-cache'});if(!res.ok)throw Error('Protocole HTTP '+res.status);protocol=await res.json();renderProtocol();
 }catch(e){$('vce-irl-authstatus').textContent='Protocole indisponible : '+e.message;return}
 try{
  if(!window.VCESupabase?.configured()||!await window.VCESupabase.isStaff()){$('vce-irl-authstatus').textContent='Lecture du protocole autorisée. Connecte-toi comme STAFF pour saisir des évaluations.';return}
  $('vce-irl-staff').hidden=false;$('vce-irl-authstatus').textContent='Accès STAFF vérifié.';
  renderStaff();$('vce-irl-date').value=new Date().toISOString().slice(0,10);
  $('vce-irl-save').onclick=save;$('vce-irl-new').onclick=()=>fill(null);$('vce-irl-export').onclick=exportFile;await list();metrics()
 }catch(e){$('vce-irl-authstatus').textContent='Connexion STAFF / historique indisponibles : '+e.message}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
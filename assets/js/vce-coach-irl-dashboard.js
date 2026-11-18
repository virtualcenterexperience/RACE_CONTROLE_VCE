/* VCE — Coach IRL is ONLY a dashboard of Staff-assigned exercises.
 * Staff checks are done with Supabase Auth / vce_is_staff.
 * A pilot can view only their own list, checked via pilot_whoami on server.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const mk=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
const state={pilot:'',items:[],staff:false,busy:false};
const statuses={assigned:'À EFFECTUER',in_progress:'EN COURS',submitted:'EN ATTENTE DE VALIDATION STAFF',approved:'VALIDÉ',rejected:'À REVOIR'};
function status(t,isError=false){$('irlStatus').textContent=t;$('irlStatus').dataset.error=String(isError)}
async function verify(pilotId){
 const client=window.VCESupabase;
 if(!client?.configured())throw Error('Supabase non configuré.');
 const sess=await client.validSession();
 if(!sess?.access_token)throw Error('Connecte-toi depuis ton profil Pilote ou ton compte Staff.');
 let staff=false;try{staff=await client.isStaff()===true}catch(e){throw Error('Vérification des droits impossible : '+e.message)}
 if(staff)return true;
 const cfg=window.VCE_SUPABASE||{};
 const resp=await fetch(cfg.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{apikey:cfg.key,Authorization:'Bearer '+sess.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action:'pilot_whoami'})
 });
 if(!resp.ok)throw Error('Identité pilote indisponible (HTTP '+resp.status+').');
 const profile=await resp.json();
 if(slug(profile.pilot_slug)!==pilotId)throw Error('Ce compte n’a pas accès aux entraînements de cet autre pilote.');
 return false;
}
function reportForm(x){
 const form=mk('form',null,'vce-irl-report');
 const draftKey='vce_irl_report_'+state.pilot+'_'+x.id;
 let draft={};try{draft=JSON.parse(localStorage.getItem(draftKey)||'{}')}catch{}
 const heading=mk('h4','Retour de séance au STAFF');form.append(heading);
 const controls={};
 for(const [key,title,type] of [['laps','Tours effectués','number'],['lapTime','Chrono réalisé (facultatif)','text'],['debrief','Débrief de la séance','textarea'],['proof','Lien replay ou télémétrie (facultatif)','url']]){
  const label=mk('label',title),input=document.createElement(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;
  input.name=key;
  if(key==='laps'){input.min='1';input.max='10000';input.step='1';input.value=x.laps||1;input.required=true}
  if(key==='debrief'){input.rows=4;input.required=true;input.minLength=10}
  if(draft[key]!==undefined)input.value=draft[key];
  controls[key]=input;label.append(input);form.append(label);
 }
 const button=mk('button','Envoyer la séance au STAFF');button.type='submit';
 const output=mk('p','');output.setAttribute('role','status');form.append(button,output);
 form.addEventListener('input',()=>{
  try{localStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value]))))}catch{}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled)return;
  const report=Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value.trim()]));
  const item={...x,id:x.status==='rejected'?String(x.id)+'-retry-'+Date.now():String(x.id),assignmentId:x.id,driver:x.driver||x.pilot,source:'coach-irl',status:'submitted',submittedAt:new Date().toISOString(),report:{...report,laps:Number(report.laps)}};
  if(!report.debrief||!Number.isInteger(item.report.laps)||item.report.laps<1)return;
  button.disabled=true;output.textContent='Envoi en cours…';
  try{
   await window.VCESupabase.submitTraining(item);
   try{
    const saved=JSON.parse(localStorage.getItem('vce_training_self_sessions_v1')||'[]');
    localStorage.setItem('vce_training_self_sessions_v1',JSON.stringify([...saved.filter(row=>String(row.id)!==item.id),item]));
    localStorage.removeItem(draftKey);
   }catch{}
   output.textContent='Séance envoyée. En attente de validation STAFF.';
   button.textContent='Envoyé au STAFF';
   window.dispatchEvent(new Event('vce-training-updated'));
  }catch(error){
   output.textContent=/409|duplicate/i.test(error.message)?'Cette séance a déjà été envoyée au STAFF.':error.message+' · Le brouillon est conservé.';
   button.disabled=/409|duplicate/i.test(error.message);
  }
 });
 return form;
}
function itemCard(x){
 const card=mk('article',null,'vce-irl-card');
 const top=mk('div',null,'vce-irl-card-top');
 top.append(mk('span',String(x.mode||'').toLowerCase()==='rhythm'?'RYTHME / RÉGULARITÉ':'EXERCICE SPÉCIFIQUE','vce-irl-type'));
 const st=statuses[x.status]||'ATTRIBUÉ';
 top.append(mk('span',st,'vce-irl-state'));
 card.append(top);
 card.append(mk('h3',String(x.exercise||x.title||'Séance attribuée par le Staff')));
 const c=mk('div',null,'vce-irl-info');
 for(const [k,v] of [['Circuit',x.circuit],['Voiture',x.car],['Tours demandés',x.laps],['Chrono objectif',x.target],['Date d’attribution',x.assignedAt||x.created_at]]){
  if(v==null||v==='')continue;
  let text=String(v);
  if(k==='Date d’attribution'&&Number.isFinite(Date.parse(text)))text=new Date(text).toLocaleDateString('fr-FR');
  c.append(mk('span',k+' : '+text));
 }
 card.append(c);
 if(x.message)card.append(mk('p','Message du coach : '+String(x.message),'vce-irl-message'));
 if(x.report?.debrief){
  const details=mk('details',null,'vce-irl-debrief');details.append(mk('summary','Débrief enregistré'),mk('p',x.report.debrief));card.append(details);
 }
 const stateText=mk('small','Séance transmise et validée uniquement par le Staff. Aucun point n’est ajouté depuis cette page.','vce-irl-foot');
 card.append(stateText);
 if(!state.staff&&!['submitted','approved'].includes(x.status))card.append(reportForm(x));
 return card;
}
async function load(){
 const params=new URLSearchParams(location.search),named=params.get('pilot')||'';
 const selected=named||sessionStorage.getItem('vce_current_pilot')||sessionStorage.getItem('vce_pilot')||decodeURIComponent(location.hash.slice(1));
 const pilotId=slug(selected);
 if(!pilotId){status('Ouvre Coach IRL depuis ton espace Pilote pour connaître le profil concerné.',true);return}
 $('irlPilot').textContent=selected;
 $('irlBack').href='pilote.html#'+encodeURIComponent(pilotId);
 status('Vérification de la session et des attributions Staff…');
 try{
  state.staff=await verify(pilotId);state.pilot=pilotId;
  const response=await window.VCESupabase.read('training_assignments');
  const list=Array.isArray(response?.items)?response.items:[];
  state.items=list.filter(x=>slug(x.driver||x.pilot)===pilotId);
  // Optional per-browser saved work is shown only after server verifies identity.
  try{
   const local=JSON.parse(localStorage.getItem('vce_training_assignments_v1')||'[]');
   if(Array.isArray(local))for(const x of local)if(slug(x.driver||x.pilot)===pilotId&&!state.items.some(y=>String(y.id)===String(x.id)))state.items.push({...x,offline:true});
  }catch(e){}
  const submitted=await window.VCESupabase.pilotTrainingData(selected);
for(const item of state.items){
 const report=submitted.find(row=>String(row.session_id)===String(item.id)||String(row.payload?.assignmentId)===String(item.id));
 if(report){item.status=report.decision||'submitted';item.report=report.payload?.report}
}
state.items.sort((a,b)=>Date.parse(b.assignedAt||b.created_at||0)-Date.parse(a.assignedAt||a.created_at||0));
  const chosen=params.get('assignment');
  if(chosen)state.items.sort((a,b)=>(String(b.id)===chosen)-(String(a.id)===chosen));
  $('irlCount').textContent=state.items.length+' entraînement'+(state.items.length!==1?'s':'')+' attribué'+(state.items.length!==1?'s':'');
  const root=$('irlList');root.replaceChildren();
  if(!state.items.length)root.append(mk('div','Aucun entraînement attribué par le Staff pour ce profil.','vce-irl-empty'));
  else for(const x of state.items)root.append(itemCard(x));
  status('Attributions synchronisées depuis Supabase'+(state.staff?' · accès Staff vérifié':' · identité pilote vérifiée')+'.');
 }catch(e){$('irlList').replaceChildren();status('Impossible d’afficher les entraînements : '+e.message,true)}
}
document.addEventListener('DOMContentLoaded',()=>{
 load();
 $('irlRefresh').addEventListener('click',async()=>{const button=$('irlRefresh');button.disabled=true;try{await load()}finally{button.disabled=false}});
});

})();

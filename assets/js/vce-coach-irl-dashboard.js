/* VCE — Coach IRL is ONLY a dashboard of Staff-assigned exercises.
 * Staff checks are done with Supabase Auth / vce_is_staff.
 * A pilot can view only their own list, checked via pilot_whoami on server.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const mk=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
const state={pilot:'',items:[],staff:false};
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
 return card;
}
async function load(){
 const params=new URLSearchParams(location.search),named=params.get('pilot')||'';
 const pilotId=slug(named);
 if(!pilotId){status('Ouvre Coach IRL depuis ton espace Pilote pour connaître le profil concerné.',true);return}
 $('irlPilot').textContent=named;
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
document.addEventListener('DOMContentLoaded',load,{once:true});
})();

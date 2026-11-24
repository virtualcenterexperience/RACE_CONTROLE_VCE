/* VCE TEAM race-result submission / staff moderation.
   Pilot forms remain pending; only STAFF acceptance feeds the official race rating. */
(()=>{'use strict';
const page=document.body.dataset.vceResultsMode;
if(page!=='pilot'&&page!=='staff')return;
const $=id=>document.getElementById(id),cfg=()=>window.VCE_SUPABASE||{};
const tr=(fr,en)=>document.documentElement.lang==='en'?en:fr;
const el=(tag,cl,txt)=>{const o=document.createElement(tag);if(cl)o.className=cl;if(txt!==undefined)o.textContent=txt;return o};
let staff=false,me=null,busy=false,rows=[],loadSeq=0,statusFilter=page==='staff'?'pending':'all',categoryFilter='all',query='';
let staffSessionAllowed=false;
let selectedTarget=new URLSearchParams(location.search).get('pilot')||location.hash.slice(1)||'';
const permitted=['championship','daily','hotlap','esport_qualifying','esport_race','rally'];
function info(message,error=false){const label=$('vce-race-state');if(label){label.textContent=message;label.dataset.error=error?'true':'false'}}
async function identity(){
 if(!window.VCESupabase?.configured())throw Error('Supabase indisponible');
 const session=await window.VCESupabase.validSession();
 if(!session?.access_token)throw Error(page==='staff'?tr('Connecte-toi avec ton compte STAFF depuis l’espace Staff.','Sign in with your STAFF account from the Staff workspace.'):tr('Connecte-toi d’abord à ton profil pilote.','Sign in to your driver profile first.'));
 if(page==='staff'){
  staff=false;
  if(!await window.VCESupabase.isStaff())throw Error('Accès STAFF requis');
  staff=true;
 }
 return session
}
async function req(path,method='GET',data=null,prefer=null){
 const session=await identity(),config=cfg();
 const headers={apikey:config.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
 if(prefer)headers.Prefer=prefer;
 const response=await fetch(config.url+'/rest/v1/'+path,{
  method,cache:'no-store',signal:AbortSignal.timeout(14000),headers,
  ...(data!==null?{body:JSON.stringify(data)}:{})
 });
 const body=await response.text();
 const result=body?(()=>{try{return JSON.parse(body)}catch{return {message:body.slice(0,160)}}})():null;
 if(!response.ok)throw Error(result?.message||result?.error||'HTTP '+response.status);
 return result;
}
async function staffTarget(){
 staffSessionAllowed=true;
 let select=$('vce-race-staff-pilot');
 if(!select){
  const roster=await window.VCESupabase.read('pilotes');
  if(!Array.isArray(roster?.items))throw Error('Effectif pilote indisponible.');
  const wrapper=el('div','vce-race-form-grid');
  const label=el('label','full','Profil pilote · session STAFF');
  wrapper.id='vce-race-staff-context';wrapper.style.marginBottom='16px';
  select=el('select','');select.id='vce-race-staff-pilot';
  select.append(new Option('Choisir le profil pilote',''));
  for(const pilot of roster.items){if(pilot?.id&&pilot?.name)select.append(new Option(pilot.name,pilot.id))}
  select.value=selectedTarget;
  label.append(select);wrapper.append(label);$('vce-race-form')?.prepend(wrapper);
  select.addEventListener('change',()=>{selectedTarget=select.value;me=null;load()});
 }
 selectedTarget=select.value;
 if(!selectedTarget){const error=Error('Choisis le profil pilote pour envoyer ton résultat avec ta session STAFF.');error.code='TARGET_REQUIRED';throw error}
 return selectedTarget;
}
async function whoami(){
 const session=await identity(),config=cfg();
 if(!session.user?.id)throw Error('Session pilote incomplète. Reconnecte-toi depuis ton profil.');
 if(await window.VCESupabase.isStaff()){
  const target=await staffTarget();
  const data=await req('rpc/vce_staff_pilot_race','POST',{p_pilot:target,p_result:null,p_expected_actor:null});
  if(data.actor_auth_user!==session.user.id)throw Error('Le compte connecté a changé. Actualise la page.');
  return {id:data.pilot_auth_user,slug:data.pilot_slug,actorId:data.actor_auth_user,viaStaff:true,name:data.pilot_name};
 }
 staffSessionAllowed=false;
 $('vce-race-staff-context')?.remove();
 const response=await fetch(config.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{apikey:config.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action:'pilot_whoami'})
 });
 const data=await response.json().catch(()=>({error:'Réponse non JSON du service de connexion.'}));
 if(!response.ok)throw Error(data.error||('Vérification du compte impossible (HTTP '+response.status+').'));
 if(!data.pilot_slug){const error=Error('Ce compte n’est pas associé à un pilote. Connecte-toi depuis ton profil pilote.');error.code='PILOT_IDENTITY_REQUIRED';throw error}
 if(data.password_change_required)throw Error('Termine le changement de ton mot de passe provisoire depuis ton profil pilote.');
 return {id:session.user.id,slug:data.pilot_slug,actorId:session.user.id,viaStaff:false};
}
function filteredRows(){
 return rows.filter(r=>
  (statusFilter==='all'||r.status===statusFilter)&&
  (categoryFilter==='all'||r.category===categoryFilter)&&
  (!query||[r.event_name,r.pilot_slug,r.track,r.championship,r.car].join(' ').toLowerCase().includes(query))
 );
}
function renderList(){
 const target=$('vce-race-list');if(!target)return;
 target.replaceChildren();
 const filtered=filteredRows();
 const shown=$('vce-race-showing');
 if(shown)shown.textContent=filtered.length+' résultat(s) affiché(s) sur '+rows.length+'.';
 if(!filtered.length){
  target.append(el('p','vce-race-empty',rows.length?'Aucun résultat pour ces filtres.':'Aucun résultat enregistré pour le moment.'));
  return
 }
 for(const row of filtered){
  const card=el('article','vce-race-entry');card.dataset.status=row.status;
  const top=el('div','vce-race-entry-head');
  const meta=el('div');
  meta.append(el('h3','',row.event_name||'Course'),
   el('p','',[
    row.race_date,row.track,row.championship,row.car
   ].filter(Boolean).join(' · ')));
  top.append(meta,el('span','vce-race-status',row.status==='pending'?'EN ATTENTE':row.status==='accepted'?'ACCEPTÉ':'REFUSÉ'));
  card.append(top);
  const details=el('div','vce-race-info');
  for(const value of [
   ['Pilote',row.pilot_slug.replaceAll('-',' ')],
   ['Classement','P'+row.finishing_position+(row.starters?'/'+row.starters:'')],
   ['Catégorie',window.VCERaceRating?.types[window.VCERaceRating.eventType(row.category)]?.label||row.category],
   ['Jeu',row.game||'Non précisé']
  ]){const block=el('div','');block.append(el('small','',value[0]),el('strong','',String(value[1])));details.append(block)}
  card.append(details);
  if(row.notes)card.append(el('p','vce-race-notes','Pilote : '+row.notes));
  if(row.proof_url){const link=el('a','vce-race-proof','Voir la preuve fournie');link.href=row.proof_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}
  if(row.staff_notes)card.append(el('p','vce-race-notes','STAFF : '+row.staff_notes));
  if(staff&&row.status==='pending'){
   const criteria=el('div','vce-race-form-grid');
   const typeLabel=el('label','','Type d’épreuve confirmé par le STAFF');const type=el('select','');
   for(const [value,rule] of Object.entries(window.VCERaceRating.types))type.append(new Option(rule.label,value));
   type.value=window.VCERaceRating.eventType(row.category)||'daily';typeLabel.append(type);
   const fieldLabel=el('label','','Nombre de participants confirmé');const count=el('input','');count.type='number';count.min='2';count.max='5000';count.value=row.starters||'';fieldLabel.append(count);type.disabled=count.disabled=Number(row.scoring_version||1)<2;
   const preview=el('p','');preview.setAttribute('role','status');
   const updateScore=()=>{const result=window.VCERaceRating.breakdown({race:{scoringVersion:row.scoring_version||1,competitionType:type.value,starters:Number(count.value)},result:{position:row.finishing_position}});preview.textContent=result.reason||('Estimation après validation : '+(result.points>=0?'+':'')+result.points+' R · position relative '+result.percentile.toFixed(2)+' %');};
   type.onchange=count.oninput=updateScore;updateScore();criteria.append(typeLabel,fieldLabel);card.append(criteria,preview);
   const area=el('textarea','vce-race-review-notes');
   area.placeholder='Motif de validation ou de refus (facultatif)';
   area.maxLength=2000;area.rows=2;
   const actions=el('div','vce-race-actions');
   const approve=el('button','vce-race-approve','✓ Accepter');
   const reject=el('button','vce-race-reject','✕ Refuser');
   approve.type=reject.type='button';
   approve.onclick=()=>review(row,'accepted',area.value,{category:type.value,starters:Number(count.value)});
   reject.onclick=()=>review(row,'rejected',area.value);
   actions.append(approve,reject);card.append(area,actions);
  }else if(staff&&row.status==='accepted'){
   const msg=el('p','vce-race-publish-note','Validé par le STAFF : pris en compte dans le rating du pilote. Affiche facultative.');
   const action=el('a','vce-race-publish','Préparer l’affiche & la publication');action.href='resultats-staff.html?draft='+encodeURIComponent(row.id);
   action.onclick=()=>{try{sessionStorage.setItem('vce_team_result_draft',JSON.stringify(row))}catch{}};
   card.append(msg,action)
  }
  target.append(card)
 }
}
async function load({quiet=false}={}){
 const seq=++loadSeq;if(!quiet)info('Chargement des résultats depuis Supabase…');
 try{
  const s=await identity();
  const candidate=page==='pilot'?await whoami():null;
  if(seq!==loadSeq)return;
  if(page==='pilot')me=candidate;
  const url='vce_race_result_submissions?select=id,pilot_slug,event_name,championship,race_date,track,car,game,category,finishing_position,starters,notes,proof_url,status,staff_notes,created_at,scoring_version&order=created_at.desc&limit=200';
  const data=await req(url+(page==='pilot'&&me?'&pilot_slug=eq.'+encodeURIComponent(me.slug):''));
  if(seq!==loadSeq)return;
  rows=Array.isArray(data)?data:[];
  renderList();
  if(!quiet&&me?.viaStaff)info('Session STAFF conservée · résultat pour '+me.name+' · '+rows.length+' envoi(s). Validation obligatoire.');
  else if(!quiet)info(staff?rows.filter(x=>x.status==='pending').length+' proposition(s) en attente du Staff.':rows.length+' résultat(s) envoyés. Les propositions restent privées jusqu’à publication.')
 }catch(e){if(seq===loadSeq){me=null;staff=false;rows=[];renderList();info(e.code==='TARGET_REQUIRED'?e.message:'Connexion impossible : '+e.message,e.code!=='TARGET_REQUIRED')}}
 finally{if(seq===loadSeq&&page==='pilot'){
  const submit=$('vce-race-form')?.querySelector('[type=submit]');if(submit)submit.disabled=!me;
  const login=$('vce-race-pilot-login');if(login)login.hidden=Boolean(me)||staffSessionAllowed;
 }}
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const form=event.currentTarget,button=form.querySelector('[type=submit]');
 const data=Object.fromEntries(new FormData(form));
 const position=Number(data.finishing_position),starters=data.starters?Number(data.starters):null;
 if(!Number.isInteger(position)||position<1||position>5000||!Number.isInteger(starters)||starters<2||starters<position||starters>5000){info('Vérifie la position et le nombre de participants.',true);return}
 if(!permitted.includes(data.category)){info('Catégorie invalide',true);return}
 const link=String(data.proof_url||'').trim();
 if(link&&!/^https:\/\/[^\s]+$/i.test(link)){info('La preuve doit être un lien HTTPS, ou rester vide.',true);return}
 busy=true;button.disabled=true;info('Envoi sécurisé au TEAM Staff…');
 try{
  const identity=await whoami();
  if(!me||identity.id!==me.id||identity.slug!==me.slug||identity.actorId!==me.actorId||Boolean(identity.viaStaff)!==Boolean(me.viaStaff)){me=null;throw Error('Le compte connecté a changé. Actualise la page et vérifie le pilote avant de renvoyer.')}
  const record={
   pilot_auth_user:identity.id,pilot_slug:identity.slug,
   event_name:String(data.event_name||'').trim(),championship:String(data.championship||'').trim(),
   race_date:data.race_date,track:String(data.track||'').trim(),car:String(data.car||'').trim(),
   game:String(data.game||'').trim(),category:data.category,scoring_version:2,
   finishing_position:position,starters,notes:String(data.notes||'').trim(),proof_url:link,
   status:'pending',staff_notes:''
  };
  if(!record.event_name||!record.race_date||!record.track)throw Error('Épreuve, date et circuit obligatoires.');
  if(identity.viaStaff)await req('rpc/vce_staff_pilot_race','POST',{p_pilot:identity.slug,p_result:record,p_expected_actor:identity.actorId});
  else await req('vce_race_result_submissions','POST',record,'return=minimal');
  try{localStorage.setItem('vce_team_results_updated_at',String(Date.now()))}catch{}
  form.reset();form.dispatchEvent?.(new Event('input',{bubbles:true}));
  if(identity.viaStaff){const target=$('vce-race-staff-pilot');if(target)target.value=identity.slug}
  await load({quiet:true});info('✓ Résultat reçu par Supabase. Le Staff le retrouvera dans TEAM → Résultats reçus. Le rating reste inchangé.');
 }catch(e){info('Envoi impossible : '+e.message,true)}
 finally{busy=false;button.disabled=!me}
}
async function review(row,decision,note,criteria={}){
 if(busy||!staff)return;
 if(decision==='accepted'&&Number(row.scoring_version)>=2&&(!permitted.includes(criteria.category)||!Number.isInteger(criteria.starters)||criteria.starters<2||criteria.starters<row.finishing_position||criteria.starters>5000)){info('Confirme le type d’épreuve et le nombre de participants avant validation.',true);return}
 const text=String(note||'').trim();
 if(decision==='rejected'&&text.length<5){info('Indique la raison du refus (5 caractères minimum) pour informer le pilote.',true);return}
 if(!window.confirm((decision==='accepted'?'Accepter':'Refuser')+' le résultat « '+row.event_name+' » du pilote '+row.pilot_slug+' ?'))return;
 busy=true;
 info('Enregistrement de la décision STAFF…');
 try{
  const session=await identity();
  const changed=await req('vce_race_result_submissions?id=eq.'+encodeURIComponent(row.id)+'&status=eq.pending',
   'PATCH',{...(decision==='accepted'&&Number(row.scoring_version)>=2?criteria:{}),status:decision,staff_notes:String(note||'').slice(0,2000),
   reviewed_by:session.user.id,reviewed_at:new Date().toISOString()},'return=representation');
  if(!Array.isArray(changed)||changed.length!==1)throw Error('Ce résultat a déjà été traité ou la modification a été refusée. Actualise la liste.');
  window.dispatchEvent(new Event('vce-team-updated'));
  try{localStorage.setItem('vce_team_results_updated_at',String(Date.now()))}catch{}
  await load({quiet:true});info(decision==='accepted'?'✓ Résultat validé et intégré au rating. Le profil se met à jour à son prochain chargement ou avec Actualiser.':'✓ Résultat refusé : aucun point attribué.')
 }catch(e){info('Décision refusée : '+e.message,true)}
 finally{busy=false}
}
function addFilters(){
 const target=$('vce-race-list');if(!target)return;
 const area=el('div','vce-race-filterbar');
 const heading=el('div','vce-race-filter-head');
 heading.append(el('strong','','AFFINER LES RÉSULTATS'),el('small','',page==='staff'?'Validation STAFF · rating synchronisé':'Suivi de tes propositions'));
 area.append(heading);
 const toolbar=el('div','vce-race-filter-controls');
 const status=el('select','');status.id='vce-race-filter-status';status.setAttribute('aria-label','Filtrer selon le statut');
 for(const [value,name] of [['all','Tous les statuts'],['pending','En attente'],['accepted','Acceptés'],['rejected','Refusés']])status.append(new Option(name,value));
 status.value=statusFilter;
 status.addEventListener('change',()=>{statusFilter=status.value;renderList()});
 const cat=el('select','');cat.id='vce-race-filter-category';cat.setAttribute('aria-label','Filtrer selon la catégorie');
 for(const [value,name] of [['all','Toutes les catégories'],...Object.entries(window.VCERaceRating.types).map(([id,r])=>[id,r.label]),['sprint','Ancien · sprint'],['esport','Ancien · Esport'],['qualification','Ancien · qualifications'],['endurance','Ancien · endurance'],['special','Ancien · événement spécial']])cat.append(new Option(name,value));
 cat.addEventListener('change',()=>{categoryFilter=cat.value;renderList()});
 const search=el('input','');search.type='search';search.id='vce-race-filter-search';
 search.placeholder='Pilote, épreuve, circuit…';search.setAttribute('aria-label','Rechercher dans les résultats');
 search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();renderList()});
 toolbar.append(status,cat,search);area.append(toolbar);
 const count=el('p','vce-race-showing','');count.id='vce-race-showing';count.setAttribute('aria-live','polite');area.append(count);
 target.before(area);
}
function init(){
 window.addEventListener('vce-auth-session-ended',()=>{
  loadSeq++;me=null;staff=false;staffSessionAllowed=false;rows=[];
  $('vce-race-staff-pilot')?.parentElement?.remove();renderList();
  const submit=$('vce-race-form')?.querySelector('[type=submit]');if(submit)submit.disabled=true;
  const login=$('vce-race-pilot-login');if(login)login.hidden=false;
  info('Compte déconnecté. Reconnecte-toi pour consulter ou envoyer des résultats.',true);
 });
 addFilters();

 const form=$('vce-race-form');
 if(form){
  form.querySelector('[type=submit]').disabled=true;
  const login=el('a','vce-race-proof','SE CONNECTER AVEC UN COMPTE PILOTE');login.id='vce-race-pilot-login';
  const pilot=new URLSearchParams(location.search).get('pilot')||location.hash.slice(1);
  login.href='pilote.html?auth=pilot'+(pilot?'#'+encodeURIComponent(pilot):'');login.hidden=true;
  $('vce-race-state')?.after(login);
  const category=form.querySelector('[name=category]'),starters=form.querySelector('[name=starters]');
  category.addEventListener('change',()=>{if(category.value==='rally'&&!starters.value){starters.value='450';starters.dispatchEvent(new Event('input',{bubbles:true}))}});
  const estimate=el('p','','Renseigne le type d’épreuve, la position et le nombre de participants pour estimer les points.');estimate.id='vce-race-score-estimate';estimate.setAttribute('role','status');form.append(estimate);
  form.addEventListener('input',()=>{const pos=Number(form.querySelector('[name=finishing_position]').value);const result=window.VCERaceRating.breakdown({race:{scoringVersion:2,competitionType:category.value,starters:Number(starters.value)},result:{position:pos}});estimate.textContent=result.reason||('Estimation : '+(result.points>=0?'+':'')+result.points+' R · position relative '+result.percentile.toFixed(2)+' % · à confirmer par le STAFF.');});
  form.addEventListener('submit',submit);
  const date=form.querySelector('[name=race_date]');if(date)date.max=new Date().toISOString().slice(0,10);
 }
 const refresh=$('vce-race-refresh');if(refresh)refresh.onclick=load;
 load();
 setInterval(()=>{if(!document.hidden&&window.VCESupabase?.session())load({quiet:true})},120_000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* STAFF navigation only: selecting a record never changes a decision or points. */
(()=>{'use strict';
const mount=document.querySelector('#dashboard .rc-overview');if(!mount)return;
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const node=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el};
const panel=node('section','','vce-staff-records');panel.id='staff-records';panel.hidden=true;
panel.innerHTML='<h2>SÉANCES ET RÉSULTATS D’UN PILOTE</h2><p>Choisis un pilote, puis l’entraînement ou le résultat à consulter.</p><div class="vce-record-filters"><label>Pilote<select id="staffRecordPilot"><option value="">Choisir un pilote</option></select></label><label>Type de dossier<select id="staffRecordKind"><option value="training">Entraînements</option><option value="race">Résultats de course</option></select></label><label>Dossier à ouvrir<select id="staffRecordItem" disabled><option value="">Choisis d’abord un pilote</option></select></label></div><button id="staffRecordRefresh" type="button">Actualiser les dossiers</button><p id="staffRecordStatus" role="status" aria-live="polite"></p><div id="staffRecordDetail"></div>';
mount.append(panel);
const $=id=>panel.querySelector('#'+id),pilot=$('staffRecordPilot'),kind=$('staffRecordKind'),item=$('staffRecordItem'),message=$('staffRecordStatus'),detail=$('staffRecordDetail'),refresh=$('staffRecordRefresh');
let roster=[],training=[],races=[],sequence=0,rosterSequence=0;
const stateLabels={assigned:'À effectuer',submitted:'En attente STAFF',pending:'En attente STAFF',approved:'Validé',accepted:'Accepté',rejected:'À revoir'};
const date=value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR');const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'Date non précisée'};
function clearRecords(){sequence++;training=[];races=[];detail.replaceChildren();item.replaceChildren(new Option('Choisis un pilote ou actualise',''));item.disabled=true;refresh.disabled=false}
function reset(){rosterSequence++;clearRecords();roster=[];pilot.replaceChildren(new Option('Choisir un pilote',''));panel.hidden=true;refresh.disabled=false;message.textContent=''}
async function access(){const client=window.VCESupabase;if(!client?.session()||!await client.isStaff())throw Error('Connexion STAFF requise.');const session=await client.validSession();if(!session?.access_token||!session.user?.id)throw Error('Session STAFF expirée ou incomplète.');return session}
async function loadRoster(){const version=++rosterSequence;try{
 await access();const data=await window.VCESupabase.read('pilotes');if(version!==rosterSequence)return;
 if(!Array.isArray(data.items))throw Error('Effectif non synchronisé.');
 roster=data.items.filter(p=>p?.id&&p?.name);const previous=pilot.value;pilot.replaceChildren(new Option('Choisir un pilote',''));
 for(const p of roster)pilot.append(new Option(p.name,p.id));pilot.value=previous;panel.hidden=false;route();
 message.textContent='Sélectionne un pilote pour charger ses dossiers.';
 if(pilot.value)await loadRecords();
}catch(error){if(version===rosterSequence){clearRecords();message.textContent=error.message;panel.hidden=true}}}
function trainingRecords(p,assignments,submissions){
 const reports=submissions.map(row=>{const data=row.payload||{},report=data.report||{};return {key:'session:'+row.session_id,title:data.exercise||'Séance envoyée',stamp:row.submitted_at,status:row.decision||'submitted',fields:[['Circuit',data.circuit],['Voiture',data.car],['Tours',report.laps??data.laps],['Chrono',report.lapTime],['Débrief',report.debrief],['Décision du STAFF',stateLabels[row.decision]],['Décision enregistrée',row.reviewed_at?date(row.reviewed_at):'']],proof:report.proof,href:'validation-seances.html?pilot='+encodeURIComponent(p.id)+'&session='+encodeURIComponent(row.session_id)}});
 const sent=new Set(submissions.flatMap(row=>[String(row.session_id),String(row.payload?.assignmentId||'')]));
 const assigned=assignments.filter(a=>(a.pilotSlug?a.pilotSlug===p.id:[p.id,slug(p.name)].includes(slug(a.driver||a.pilot)))&&!sent.has(String(a.id))).map(a=>({key:'assignment:'+a.id,title:a.exercise||'Entraînement attribué',stamp:a.publishedAt||a.createdAt,status:'assigned',fields:[['Circuit',a.circuit],['Voiture',a.car],['Tours demandés',a.laps],['Chrono objectif',a.target],['Consigne du coach',a.message]],href:'coach-irl.html?pilot='+encodeURIComponent(p.id)+'&assignment='+encodeURIComponent(a.id)}));
 return [...reports,...assigned].sort((a,b)=>String(b.stamp||'').localeCompare(String(a.stamp||'')));
}
async function readRaces(session,pilotId){
 const cfg=window.VCE_SUPABASE,all=new Map();
 for(let offset=0;;offset+=500){
  const response=await fetch(cfg.url+'/rest/v1/vce_race_result_submissions?pilot_slug=eq.'+encodeURIComponent(pilotId)+'&select=id,event_name,race_date,championship,track,car,category,finishing_position,starters,status,notes,staff_notes,proof_url,created_at&order=created_at.desc,id.desc&limit=500&offset='+offset,{headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error('Résultats indisponibles (HTTP '+response.status+').');
  const rows=await response.json();if(!Array.isArray(rows))throw Error('Réponse résultats invalide.');
  if(window.VCESupabase.session()?.user?.id!==session.user.id)throw Error('Le compte connecté a changé.');
  for(const row of rows)all.set(row.id,row);if(rows.length<500)return [...all.values()];
 }
}
async function loadRecords(){
 const previous=item.value;clearRecords();const version=sequence,p=roster.find(p=>p.id===pilot.value);if(!p){message.textContent='Sélectionne un pilote.';return}
 refresh.disabled=true;message.textContent='Chargement des dossiers de '+p.name+'…';
 try{
  const session=await access();
  const request=readRaces(session,p.id);
  const outcomes=await Promise.allSettled([window.VCESupabase.pilotTrainingData(p.id),window.VCESupabase.read('training_assignments'),request]);
  if(version!==sequence||pilot.value!==p.id||window.VCESupabase.session()?.user?.id!==session.user?.id)return;
  const warnings=[];
  if(outcomes[0].status==='fulfilled'&&Array.isArray(outcomes[0].value)&&outcomes[1].status==='fulfilled'&&Array.isArray(outcomes[1].value.items))training=trainingRecords(p,outcomes[1].value.items,outcomes[0].value);else warnings.push('Entraînements non synchronisés : actualise pour réessayer.');
  if(outcomes[2].status==='fulfilled')races=outcomes[2].value.map(r=>({key:'race:'+r.id,title:r.event_name,stamp:r.race_date||r.created_at,status:r.status,fields:[['Championnat',r.championship],['Circuit',r.track],['Voiture',r.car],['Classement','P'+r.finishing_position+(r.starters?' / '+r.starters:'')],['Type d’épreuve',r.category],['Commentaire du pilote',r.notes],['Commentaire STAFF',r.staff_notes]],proof:r.proof_url,href:'team-resultats-recus.html?pilot='+encodeURIComponent(p.id)+'&result='+encodeURIComponent(r.id)}));else warnings.push('Résultats non synchronisés : actualise pour réessayer.');
  renderChoices(previous);message.textContent=warnings.length?warnings.join(' '):training.length+' entraînement(s) · '+races.length+' résultat(s) pour '+p.name+'.';
 }catch(error){if(version===sequence)message.textContent=error.message}
 finally{if(version===sequence)refresh.disabled=false}
}
function renderChoices(saved){const previous=typeof saved==='string'?saved:item.value,rows=kind.value==='race'?races:training;detail.replaceChildren();item.replaceChildren(new Option(rows.length?'Choisir un dossier':'Aucun dossier disponible',''));for(const row of rows)item.append(new Option(date(row.stamp)+' · '+row.title.slice(0,110)+' · '+(stateLabels[row.status]||row.status),row.key));item.disabled=!rows.length;if(rows.some(r=>r.key===previous)){item.value=previous;showDetail()}}
function showDetail(){detail.replaceChildren();const p=roster.find(p=>p.id===pilot.value),row=(kind.value==='race'?races:training).find(row=>row.key===item.value);if(!row||!p)return;
 detail.append(node('h3',row.title),node('p',p.name+' · '+date(row.stamp)+' · '+(stateLabels[row.status]||row.status)));
 for(const [label,value] of row.fields)if(value!==undefined&&value!==null&&value!=='')detail.append(node('p',label+' : '+value));
 if(/^https:\/\/[^\s]+$/.test(row.proof||'')){const proof=node('a','Ouvrir la preuve / le replay');proof.href=row.proof;proof.target='_blank';proof.rel='noopener noreferrer';detail.append(proof)}
 const link=node('a',row.status==='assigned'?'Ouvrir la séance attribuée':'Ouvrir le détail et la validation','vce-record-open');link.href=row.href;detail.append(link);
}
function route(){if(!['#staff-records','#staff-records-results'].includes(location.hash))return;if(location.hash==='#staff-records-results'){kind.value='race';renderChoices()}requestAnimationFrame(()=>panel.scrollIntoView({block:'start',behavior:'smooth'}))}
pilot.addEventListener('change',loadRecords);kind.addEventListener('change',renderChoices);item.addEventListener('change',showDetail);refresh.addEventListener('click',()=>pilot.value?loadRecords():loadRoster());
window.addEventListener('vce-staff-authenticated',loadRoster);window.addEventListener('vce-auth-session-ended',reset);window.addEventListener('vce-staff-logged-out',reset);window.addEventListener('hashchange',route);
setInterval(()=>{if(!document.hidden&&!panel.hidden&&pilot.value)loadRecords()},120_000);
if(window.VCESupabase?.session())loadRoster();route();
})();

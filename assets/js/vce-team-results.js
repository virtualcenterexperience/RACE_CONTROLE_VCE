/* VCE TEAM race-result submission / staff moderation.
   Official ratings and published results are never modified by a pilot form. */
(()=>{'use strict';
const page=document.body.dataset.vceResultsMode;
if(page!=='pilot'&&page!=='staff')return;
const $=id=>document.getElementById(id),cfg=()=>window.VCE_SUPABASE||{};
const tr=(fr,en)=>document.documentElement.lang==='en'?en:fr;
const el=(tag,cl,txt)=>{const o=document.createElement(tag);if(cl)o.className=cl;if(txt!==undefined)o.textContent=txt;return o};
let staff=false,me=null,busy=false,rows=[],loadSeq=0;
const permitted=['sprint','esport','qualification','endurance','special'];
function info(message,error=false){const label=$('vce-race-state');if(label){label.textContent=message;label.dataset.error=error?'true':'false'}}
async function identity(){
 if(!window.VCESupabase?.configured())throw Error('Supabase indisponible');
 const session=await window.VCESupabase.validSession();
 if(!session?.access_token)throw Error(tr('Connecte-toi d’abord à ton profil pilote.','Sign in to your driver profile first.'));
 if(page==='staff'){
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
async function whoami(){
 const session=await identity(),config=cfg();
 const response=await fetch(config.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{apikey:config.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action:'pilot_whoami'})
 });
 const data=await response.json();
 if(!response.ok||!data.pilot_slug)throw Error('Le compte connecté n’est pas associé à un pilote actif.');
 return {id:session.user?.id,slug:data.pilot_slug};
}
function renderList(){
 const target=$('vce-race-list');if(!target)return;
 target.replaceChildren();
 if(!rows.length){target.append(el('p','vce-race-empty',staff?'Aucune proposition de course.':'Aucun résultat envoyé pour le moment.'));return}
 for(const row of rows){
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
   ['Catégorie',row.category],
   ['Jeu',row.game||'Non précisé']
  ]){const block=el('div','');block.append(el('small','',value[0]),el('strong','',String(value[1])));details.append(block)}
  card.append(details);
  if(row.notes)card.append(el('p','vce-race-notes','Pilote : '+row.notes));
  if(row.proof_url){const link=el('a','vce-race-proof','Voir la preuve fournie');link.href=row.proof_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}
  if(row.staff_notes)card.append(el('p','vce-race-notes','STAFF : '+row.staff_notes));
  if(staff&&row.status==='pending'){
   const area=el('textarea','vce-race-review-notes');
   area.placeholder='Motif de validation ou de refus (facultatif)';
   area.maxLength=2000;area.rows=2;
   const actions=el('div','vce-race-actions');
   const approve=el('button','vce-race-approve','✓ Accepter');
   const reject=el('button','vce-race-reject','✕ Refuser');
   approve.type=reject.type='button';
   approve.onclick=()=>review(row,'accepted',area.value);
   reject.onclick=()=>review(row,'rejected',area.value);
   actions.append(approve,reject);card.append(area,actions);
  }else if(staff&&row.status==='accepted'){
   const msg=el('p','vce-race-publish-note','Vérifié par le Staff. Publication officielle encore à effectuer.');
   const action=el('a','vce-race-publish','Préparer l’affiche & la publication');action.href='resultats-staff.html?draft='+encodeURIComponent(row.id);
   action.onclick=()=>{try{sessionStorage.setItem('vce_team_result_draft',JSON.stringify(row))}catch{}};
   card.append(msg,action)
  }
  target.append(card)
 }
}
async function load(){
 const seq=++loadSeq;info('Chargement des résultats depuis Supabase…');
 try{
  const s=await identity();
  if(page==='pilot')me=await whoami();
  const url='vce_race_result_submissions?select=id,pilot_slug,event_name,championship,race_date,track,car,game,category,finishing_position,starters,notes,proof_url,status,staff_notes,created_at&order=created_at.desc&limit=100';
  const data=await req(url);
  if(seq!==loadSeq)return;
  rows=Array.isArray(data)?data:[];
  renderList();
  info(staff?rows.filter(x=>x.status==='pending').length+' proposition(s) en attente du Staff.':rows.length+' résultat(s) envoyés. Les propositions restent privées jusqu’à publication.')
 }catch(e){if(seq===loadSeq)info('Connexion impossible : '+e.message,true)}
}
async function submit(event){
 event.preventDefault();if(busy)return;
 const form=event.currentTarget,button=form.querySelector('[type=submit]');
 const data=Object.fromEntries(new FormData(form));
 const position=Number(data.finishing_position),starters=data.starters?Number(data.starters):null;
 if(!Number.isInteger(position)||position<1||position>5000||starters!==null&&(!Number.isInteger(starters)||starters<position||starters>5000)){info('Vérifie la position et le nombre de participants.',true);return}
 if(!permitted.includes(data.category)){info('Catégorie invalide',true);return}
 const link=String(data.proof_url||'').trim();
 if(link&&!/^https:\/\/[^\s]+$/i.test(link)){info('La preuve doit être un lien HTTPS, ou rester vide.',true);return}
 busy=true;button.disabled=true;info('Envoi sécurisé au TEAM Staff…');
 try{
  const identity=await whoami();
  const record={
   pilot_auth_user:identity.id,pilot_slug:identity.slug,
   event_name:String(data.event_name||'').trim(),championship:String(data.championship||'').trim(),
   race_date:data.race_date,track:String(data.track||'').trim(),car:String(data.car||'').trim(),
   game:String(data.game||'').trim(),category:data.category,
   finishing_position:position,starters,notes:String(data.notes||'').trim(),proof_url:link,
   status:'pending',staff_notes:''
  };
  if(!record.event_name||!record.race_date||!record.track)throw Error('Épreuve, date et circuit obligatoires.');
  await req('vce_race_result_submissions','POST',record,'return=minimal');
  form.reset();info('✓ Résultat envoyé. Le Staff le retrouve dans TEAM → Résultats reçus. Aucune modification de rating avant publication.');
  await load();
 }catch(e){info('Envoi impossible : '+e.message,true)}
 finally{busy=false;button.disabled=false}
}
async function review(row,decision,note){
 if(busy||!staff)return;busy=true;
 info('Enregistrement de la décision STAFF…');
 try{
  const session=await identity();
  await req('vce_race_result_submissions?id=eq.'+encodeURIComponent(row.id)+'&status=eq.pending',
   'PATCH',{status:decision,staff_notes:String(note||'').slice(0,2000),
   reviewed_by:session.user.id,reviewed_at:new Date().toISOString()},'return=representation');
  info('Décision enregistrée. Pour actualiser le rating et les publications, utilise le générateur Résultats.');
  await load()
 }catch(e){info('Décision refusée : '+e.message,true)}
 finally{busy=false}
}
function init(){
 const form=$('vce-race-form');
 if(form){form.addEventListener('submit',submit);
  const date=form.querySelector('[name=race_date]');if(date)date.max=new Date().toISOString().slice(0,10);
 }
 const refresh=$('vce-race-refresh');if(refresh)refresh.onclick=load;
 load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
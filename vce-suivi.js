(()=>{'use strict';const K='vce_training_self_sessions_v1',P='vce_esport_pilotes_v1';const $=id=>document.getElementById(id);let secs=0,start=0,interval=null;const read=(k)=>{try{let x=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(x)?x:[]}catch{return []}};const fmt=s=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':');const pid=new URLSearchParams(location.search).get('pilot')||sessionStorage.getItem('vce_pilot')||sessionStorage.getItem('vce_current_pilot')||'';const select=$('vcePilot');let draftPilot='',pilotAccess=null,authSeq=0;select.disabled=true;$('vceSubmit').disabled=true;const saved=()=>{try{return JSON.parse(localStorage.getItem('vce_self_draft_'+location.pathname+'_'+draftPilot)||'null')}catch{return null}};let lapsMode='specific';function update(){const current=start?Math.floor((Date.now()-start)/1000):0;$('vceTimer').textContent=fmt(current);$('vceTotal').textContent=fmt(secs+current)}function pause(){if(start){secs+=Math.floor((Date.now()-start)/1000);start=0;clearInterval(interval);interval=null}update();store()}function store(){if(!draftPilot)return;const draft={secs,game:$('vceGame').value,circuit:$('vceCircuit').value,car:$('vceCar').value,exercise:$('vceExercise').value,laps:$('vceLaps').value,chrono:$('vceChrono').value,debrief:$('vceDebrief').value,proof:$('vceProof').value,mode:lapsMode};try{localStorage.setItem('vce_self_draft_'+location.pathname+'_'+draftPilot,JSON.stringify(draft))}catch{}}function restore(){const d=saved();secs=d?.secs||0;for(const [id,key] of [['vceGame','game'],['vceCircuit','circuit'],['vceCar','car'],['vceExercise','exercise'],['vceLaps','laps'],['vceChrono','chrono'],['vceDebrief','debrief'],['vceProof','proof']])$(id).value=d?.[key]||'';lapsMode=d?.mode||'specific';$('vceMode').value=lapsMode;modeChange();update()}function modeChange(){let max=lapsMode==='rhythm'?100:15;$('vceLaps').max=max;$('vceLaps').value=Math.min(max,Math.max(1,Number($('vceLaps').value)||1));$('vceLapsCount').textContent=$('vceLaps').value+' / '+max}select.onchange=()=>{pause();draftPilot=select.value;sessionStorage.setItem('vce_current_pilot',select.value);restore()};$('vceMode').onchange=()=>{lapsMode=$('vceMode').value;modeChange();store()};$('vceLaps').oninput=()=>{$('vceLapsCount').textContent=$('vceLaps').value+' / '+$('vceLaps').max;store()};$('vceStart').onclick=()=>{if(!start){start=Date.now();interval=setInterval(update,1000)}};$('vcePause').onclick=pause;$('vceSave').onclick=()=>{pause();$('vceMsg').textContent='Progression enregistrée dans ce navigateur.'};$('vceForm').oninput=()=>{if(!start)store()};$('vceSubmit').onclick=async()=>{pause();if(!$('vceGame').value.trim()||!$('vceCircuit').value.trim()||!$('vceCar').value.trim()||!$('vceExercise').value.trim()||!$('vceDebrief').value.trim()){$('vceMsg').textContent='Jeu, circuit, voiture, exercice et débrief sont obligatoires.';return}if(!confirm('Envoyer cette séance au STAFF pour validation ?'))return;const item={id:'self-'+Date.now()+'-'+Math.random().toString(36).slice(2),driver:select.value,source:document.body.dataset.trainingType||'sans-coach',game:$('vceGame').value,simulationGame:$('vceGame').value,circuit:$('vceCircuit').value.trim(),car:$('vceCar').value.trim(),exercise:$('vceExercise').value.trim(),mode:lapsMode,laps:Number($('vceLaps').value),status:'submitted',submittedAt:new Date().toISOString(),report:{simulationGame:$('vceGame').value,totalSeconds:secs,laps:Number($('vceLaps').value),lapTime:$('vceChrono').value.trim(),debrief:$('vceDebrief').value.trim(),proof:$('vceProof').value.trim(),screenshotName:$('vceScreen').files[0]?.name||''}};const btn=$('vceSubmit');btn.disabled=true;$('vceMsg').textContent='Envoi de la séance au STAFF…';try{if(!window.VCESupabase?.configured())throw Error('Connexion Supabase indisponible.');await VCESupabase.submitTraining(item);try{const a=read(K);a.push(item);localStorage.setItem(K,JSON.stringify(a));localStorage.removeItem('vce_self_draft_'+location.pathname+'_'+draftPilot)}catch(localError){console.warn('Historique local non enregistré',localError)}secs=0;for(const el of $('vceForm').querySelectorAll('input,textarea')){if(el.type==='file')el.value='';else if(el.type==='range')el.value=1;else el.value=''}$('vceGame').value='';lapsMode='specific';$('vceMode').value='specific';modeChange();update();$('vceMsg').textContent='Séance transmise au STAFF. En attente de validation.';renderHistory()}catch(e){$('vceMsg').textContent='Envoi non effectué : '+e.message+' — ta séance est conservée en brouillon.'}finally{btn.disabled=false}};function renderHistory(){const list=$('vceHistory');list.replaceChildren();const items=read(K).filter(x=>x.driver===select.value&&x.source===document.body.dataset.trainingType).reverse();for(const x of items){const p=document.createElement('p');p.textContent=x.exercise+' · '+x.circuit+' · '+({submitted:'EN ATTENTE',approved:'VALIDÉ',rejected:'REFUSÉ'}[x.status]||x.status);list.append(p)}if(!items.length)list.textContent='Aucune séance envoyée.'}select.addEventListener('change',renderHistory);
async function trainingAccess(){
 const client=window.VCESupabase;
 if(!client?.configured())throw Error('Connexion Supabase indisponible.');
 const session=await client.validSession();
 if(!session?.access_token)throw Error('Connecte-toi depuis ton profil pilote pour envoyer une séance.');
 const staff=await client.isStaff();let identity=null;
 if(!staff){
  const cfg=window.VCE_SUPABASE;
  const response=await fetch(cfg.url+'/functions/v1/vce-telemetry',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(14000),headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'pilot_whoami'})});
  if(!response.ok)throw Error('Identité pilote non confirmée (HTTP '+response.status+').');
  identity=await response.json();
  if(identity.password_change_required)throw Error('Termine ton changement de mot de passe depuis ton profil pilote.');
 }
 const data=await client.read('pilotes');if(!Array.isArray(data.items))throw Error('Effectif non synchronisé.');
 if(client.session()?.user?.id!==session.user?.id)throw Error('Le compte connecté a changé.');
 const pilot=data.items.find(p=>p.id===identity?.pilot_slug);
 if(!staff&&!pilot)throw Error('Compte non associé à un pilote actif.');
 return {staff,pilot,roster:data.items,userId:session.user?.id};
}
async function syncAuthenticatedPilot(){
 const seq=++authSeq;select.disabled=true;$('vceSubmit').disabled=true;
 try{
  const access=await trainingAccess();if(seq!==authSeq)return;
  pause();pilotAccess=access;const previous=select.value;select.replaceChildren();
  for(const pilot of access.staff?access.roster:[access.pilot]){const option=document.createElement('option');option.value=option.textContent=pilot.name;select.append(option)}
  const target=access.staff?access.roster.find(p=>p.id===pid||p.name===pid||p.name===previous):access.pilot;
  if(target)select.value=target.name;
  draftPilot=select.value;$('vceScreen').value='';restore();renderHistory();select.disabled=!access.staff;$('vceSubmit').disabled=false;
  $('vceMsg').textContent=access.staff?'Accès STAFF : choisis le pilote destinataire.':'Compte pilote synchronisé : '+access.pilot.name;
 }catch(error){if(seq!==authSeq)return;pilotAccess=null;select.replaceChildren(new Option('Connexion pilote requise',''));$('vceMsg').textContent=error.message}
}
const sendTraining=$('vceSubmit').onclick;
$('vceSubmit').onclick=async()=>{
 const button=$('vceSubmit');if(button.disabled)return;
 const seq=authSeq,expected=select.value;button.disabled=true;select.disabled=true;
 try{
  const access=await trainingAccess();
  if(seq!==authSeq||access.userId!==pilotAccess?.userId||select.value!==expected||(!access.staff&&access.pilot.name!==expected))throw Error('Le compte a changé. Recharge la fiche depuis ton profil avant de l’envoyer.');
  await sendTraining();
 }catch(error){$('vceMsg').textContent='Envoi non effectué : '+error.message}
 finally{if(seq===authSeq){button.disabled=!pilotAccess;select.disabled=!pilotAccess?.staff}else{button.disabled=true;select.disabled=true}}
};
window.addEventListener('vce-auth-session-ended',()=>{
 pause();authSeq++;pilotAccess=null;draftPilot='';secs=0;
 for(const id of ['vceGame','vceCircuit','vceCar','vceExercise','vceChrono','vceDebrief','vceProof','vceScreen'])$(id).value='';
 select.replaceChildren(new Option('Compte déconnecté',''));select.disabled=true;$('vceSubmit').disabled=true;update();renderHistory();$('vceMsg').textContent='Compte déconnecté. Reconnecte-toi depuis ton profil.';
});
setTimeout(syncAuthenticatedPilot,0);update();
})();

/* Pilot page data/controller — extracted verbatim from pilote.html. */

const VCE=(()=>{
const names=['LUCAS GALY','ALEX LEHOUX','NICOLAS LEFRANCOIS','DYLAN DUBOIS','ANTHONY MANGIERACINA','ANTONIN COLIN','THEO FRANCOIS','MATHYS GOYAT','MATHIS OCQUIDENT','NOE FERNANDEZ','WILLIAM ORLINZOO','MALDONADO MARIUS','VICTOR AUGER','SAMUEL MENDEZ'];
const $=id=>document.getElementById(id),arr=x=>Array.isArray(x)?x:[],norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])),get=(key,def)=>{try{return JSON.parse(localStorage.getItem(key))??def}catch{return def}},set=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
let spectatorPilot='';
const pilot=()=>spectatorPilot||sessionStorage.getItem('vce_pilot')||localStorage.getItem('vce_pilot')||'',selectPilot=name=>{
 if(document.documentElement.classList.contains('vce-pilot-spectator')){spectatorPilot=name;return}
 spectatorPilot='';
 sessionStorage.setItem('vce_pilot',name);localStorage.setItem('vce_pilot',name)};
function repo(){const parts=location.hostname.split('.');if(parts.length>=3&&parts[1]==='github'&&parts[2]==='io')return {owner:parts[0],repo:location.pathname.split('/').filter(Boolean)[0]||parts[0]};return null}
const paths=['data/vce/seances.json'];let currentPath='';
async function read(){
 const sources=[],merged={entrainements:[],seances:[],sessions:[],historique:[],historiques:[],validations:{}};
 for(const path of paths){
  try{
   const r=await fetch(path,{cache:'no-cache',signal:AbortSignal.timeout(6500)});
   if(!r.ok)continue;
   const raw=await r.json(),d=Array.isArray(raw)?{seances:raw}:raw;
   if(!d||typeof d!=='object')continue;
   sources.push(path);
   for(const key of ['entrainements','seances','sessions','historique','historiques'])
    if(Array.isArray(d[key]))merged[key].push(...d[key]);
   if(d.validations&&typeof d.validations==='object')Object.assign(merged.validations,d.validations);
  }catch(e){console.warn('VCE source indisponible',path,e)}
 }
 if(!sources.length)throw Error('Aucun JSON accessible : '+paths.join(', '));
 const ids=new Set();
 for(const key of ['entrainements','seances','sessions','historique','historiques']){
  merged[key]=merged[key].filter(x=>{
   const v=x.session||x;
   const id=String(x.id||v.id||[x.pilot||x.pilote||v.pilot||v.pilote||'',v.date||'',v.circuit||'',v.tours??v.laps??'',v.chrono||''].join('|'));
   if(ids.has(id))return false;ids.add(id);return true;
  });
 }
 currentPath=sources[0];
 return {data:merged,source:sources.join(' + ')};
}
function local(){return get('vce_local_sessions_v2',[])}
function records(d,name){const all=[...arr(d?.entrainements),...arr(d?.seances),...arr(d?.sessions),...arr(d?.historique),...arr(d?.historiques)];const seen=new Set();return all.filter(x=>{const p=x.pilot||x.pilote||x.nom||x.session?.pilot||x.session?.pilote||x.session?.nom;if(norm(p)!==norm(name))return false;const s=x.session||x;const id=String(x.id||s.id||[s.date,s.circuit,s.tours,s.chrono,s.mode].join('|'));if(seen.has(id))return false;seen.add(id);return true}).map(x=>({id:x.id||x.session?.id||'',session:x.session||x})).sort((a,b)=>String(b.session.date||'').localeCompare(String(a.session.date||'')))}
function statusOf(x,d){return norm(d?.validations?.[x.id]||x.session.statut||x.session.status||x.session.etat||'')}
function completed(x,d){const status=statusOf(x,d);return ['TERMINE','TERMINEE','COMPLETED','FINISHED','DONE','VALID','VALIDE','VALIDATED','APPROVED'].includes(status)||x.session.termine===true||x.session.completed===true}
function valid(x,d){const status=statusOf(x,d);return ['VALID','VALIDE','VALIDATED','APPROVED'].includes(status)||x.session.valide===true||x.session.validated===true}
let circuits={};
async function loadCircuits(){try{let r=await fetch('data/longueurs-circuits.json',{cache:'default',signal:AbortSignal.timeout(6000)});if(r.ok){let d=await r.json();circuits=d.circuits||{}}}catch{}}
function lengthOf(s){const key=norm(s.circuit||s.track||s.piste).replace(/[^A-Z0-9]/g,'');for(const [name,info] of Object.entries(circuits)){const aliases=[name,...(info.aliases||[])];if(aliases.some(a=>norm(a).replace(/[^A-Z0-9]/g,'')===key))return Number(info.km)||0}return 0}
function stats(d,name){const rows=records(d,name),finished=rows.filter(x=>completed(x,d)),approved=rows.filter(x=>valid(x,d)).length,tours=finished.reduce((a,x)=>a+(Number(x.session.tours??x.session.laps??x.session.nombreTours??x.session.nbTours)||0),0),distance=finished.reduce((a,x)=>{const s=x.session,laps=Number(s.tours??s.laps??s.nombreTours??s.nbTours)||0,km=Number(s.distanceKm??s.distance)||0;return a+(km>0?km:laps*lengthOf(s))},0),unknown=finished.filter(x=>{const s=x.session;return Number(s.tours??s.laps??s.nombreTours??s.nbTours)>0&&!Number(s.distanceKm??s.distance)&&!lengthOf(s)}).length;return {rows,finished,approved,tours,distance,unknown}}
async function saveSession(entry,token){const records=local();records.push(entry);set('vce_local_sessions_v2',records);if(!token)return {synced:false,reason:'Enregistré sur cet appareil uniquement. Pour publier sur GitHub, renseigne un token autorisé.'};const r=repo();if(!r)return {synced:false,reason:'Enregistré localement. Ouvre le site sur GitHub Pages pour la sauvegarde partagée.'};let target=currentPath;let data={},sha;try{let found=await read();data=found.data;target=currentPath}catch{return {synced:false,reason:'Sauvegarde locale effectuée, mais le JSON distant est introuvable.'}};const endpoint='https://api.github.com/repos/'+encodeURIComponent(r.owner)+'/'+encodeURIComponent(r.repo)+'/contents/'+target;const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};for(let attempt=0;attempt<3;attempt++){try{let getR=await fetch(endpoint,{headers,cache:'no-store'});if(!getR.ok)throw Error('Lecture GitHub HTTP '+getR.status);let j=await getR.json();sha=j.sha;let raw=Uint8Array.from(atob(j.content.replace(/\s/g,'')),x=>x.charCodeAt(0));data=JSON.parse(new TextDecoder().decode(raw));data.entrainements=arr(data.entrainements);if(!data.entrainements.some(x=>x.id===entry.id))data.entrainements.push(entry);let bytes=new TextEncoder().encode(JSON.stringify(data,null,2));let binary='';for(let k=0;k<bytes.length;k+=8192)binary+=String.fromCharCode(...bytes.slice(k,k+8192));let put=await fetch(endpoint,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'VCE : nouvelle séance '+entry.pilot,content:btoa(binary),sha,branch:'main'})});if(put.ok)return {synced:true,reason:'Séance enregistrée sur GitHub.'};if(![409,422].includes(put.status))throw Error('Écriture GitHub HTTP '+put.status)}catch(e){if(attempt===2)return {synced:false,reason:'Sauvegarde locale effectuée, mais GitHub a échoué : '+e.message}}}return {synced:false,reason:'Sauvegarde locale uniquement : conflit GitHub.'}}
return {names,$,arr,norm,safe,get,set,pilot,selectPilot,read,local,records,stats,completed,valid,loadCircuits,saveSession}
})();


const Rating=(()=>{
const fallback={startDate:'2026-11-02',dailyTrainingPoints:3,maxRewardedSessionsPerDay:3,weeklyTrainingPoints:3,weeklyMissPenalty:0,xpPointsStep:15,classes:[{code:'R',name:'ROOKIE',xpPer15Points:150,xpToNext:1000},{code:'F',name:'BRONZE',xpPer15Points:125,xpToNext:1000},{code:'E',name:'SILVER',xpPer15Points:100,xpToNext:1000},{code:'D',name:'DIAMANT',xpPer15Points:75,xpToNext:1000},{code:'C',name:'BLINDÉ',xpPer15Points:50,xpToNext:1000},{code:'B',name:'OR',xpPer15Points:25,xpToNext:1000},{code:'A',name:'ALIEN',xpPer15Points:10,xpToNext:50000}]};
async function config(){try{let r=await fetch('data/rating-config.json',{cache:'default',signal:AbortSignal.timeout(6000)});if(r.ok){let j=await r.json();if(Array.isArray(j.classes)&&j.classes.length===7)return j}}catch{}return fallback}
const normalize=VCE.norm;
function weekStart(value){let d=new Date(value);if(!Number.isFinite(d.getTime()))return null;let x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10)}
function dateKey(s){let d=new Date(s);return Number.isFinite(d.getTime())?d.toISOString():null}
function allRecords(d){let list=[...VCE.arr(d.entrainements),...VCE.arr(d.seances),...VCE.arr(d.sessions),...VCE.arr(d.historique),...VCE.arr(d.historiques)];let used=new Set();return list.filter(x=>{let s=x.session||x;let name=x.pilot||x.pilote||x.nom||s.pilot||s.pilote;let date=dateKey(s.date||x.date||s.createdAt||x.createdAt);if(!name||!date)return false;let key=x.id||s.id||[normalize(name),date,s.circuit,s.titre].join('|');if(used.has(key))return false;used.add(key);return true}).map(x=>{let s=x.session||x;return {name:normalize(x.pilot||x.pilote||x.nom||s.pilot||s.pilote||s.nom),date:dateKey(s.date||x.date||s.createdAt||x.createdAt),id:x.id||s.id||'',completed:VCE.completed({id:x.id||s.id||'',session:s},d)}})}
function pilotProgress(records,name,cfg,now){
 const start=String(cfg.startDate||'2026-11-02').slice(0,10),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const mine=records.filter(r=>r.name===normalize(name)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.date))>=start&&new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.date))<=today&&r.completed);
 const days=new Map();for(const r of mine){const k=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.date));days.set(k,(days.get(k)||0)+1)}
 let rating=0,xp=0,ci=0,xpInClass=0,history=[],firstReached={},earned=0;
 const dailyPoints=Number(cfg.dailyTrainingPoints??3),dailyLimit=Math.max(1,Number(cfg.maxRewardedSessionsPerDay??3));
 const ordered=[...mine].sort((a,b)=>a.date.localeCompare(b.date));
 for(const r of ordered){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.date));if(!firstReached[day])firstReached[day]=r.date;
  // Chaque validation donne des points de progression (pas de rating de course).
 }
 let cursor=new Date(start+'T00:00:00Z'),last=new Date(today+'T00:00:00Z');
 for(let i=0;cursor<=last&&i<3650;i++,cursor.setUTCDate(cursor.getUTCDate()+1)){
  const day=cursor.toISOString().slice(0,10),count=days.get(day)||0,done=count>0,change=Math.min(count,dailyLimit)*dailyPoints;
  rating+=change;if(done)earned+=change;
  history.push({week:day,rating,change,trained:done,closed:day!==today})
 }
 const rankTime=ordered.length?ordered[0].date:'9999';
 return {name,rating,earned,xp,ci,klass:cfg.classes[ci],xpInClass,goal:cfg.classes[ci].xpToNext,history,firstReached,rankTime,trainedWeeks:days.size,completedWeeks:mine.length}
}
function ranking(data,cfg,now){const records=allRecords(data),names=[...new Set([...VCE.names,...records.map(r=>r.name)])];let pilots=names.map(name=>pilotProgress(records,name,cfg,now));pilots.sort((a,b)=>b.rating-a.rating||String(a.rankTime).localeCompare(String(b.rankTime))||a.name.localeCompare(b.name));return pilots.map((p,i)=>({...p,rank:i+1}))}
return {config,allRecords,pilotProgress,ranking};
})();

async function publishedRaceEntries(){if(!window.VCESupabase?.configured())return [];try{const db=await VCESupabase.read('resultats');const rows=[];for(const preset of (db?.presets||[])){if(!preset.published||!preset.data)continue;const race=preset.data;for(const result of race.results||[]){const lead=[result.firstName,result.lastName].filter(Boolean).join(' ').trim();const drivers=[lead,...(Array.isArray(result.drivers)?result.drivers:[])].filter(Boolean);rows.push({preset:preset.id,race,result,drivers})}}return rows}catch(e){console.warn('Résultats publiés indisponibles',e);return []}}
function raceRatingDelta(row){if(row.race.ratingEnabled===false||row.race.ratingMode==='none'||row.race.ratingMode==='manual'||row.race.competitionType==='event'||row.race.competitionType==='rally')return 0;const pos=Number(row.result.position);return !Number.isInteger(pos)||pos<1?0:pos===1?100:pos<=3?80:pos<=8?25:pos<=12?10:pos<=18?-10:-25}
function showMyRaceResults(rows,name){let host=document.getElementById('vce-my-race-results');if(!host){host=document.createElement('section');host.id='vce-my-race-results';host.className='panel section';const dashboard=document.getElementById('pilotDashboard');const target=document.getElementById('myStanding');if(target)target.after(host);else dashboard.append(host)}host.replaceChildren();const h=document.createElement('h2');h.textContent='🏁 MES RÉSULTATS OFFICIELS';host.append(h);const mine=rows.filter(x=>x.drivers.some(n=>VCE.norm(n)===VCE.norm(name)));if(!mine.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun résultat publié pour ce pilote.';host.append(p);return}for(const x of mine.slice().reverse().slice(0,20)){const card=document.createElement('article');card.className='item';const title=document.createElement('strong');title.textContent='P'+x.result.position+' · '+(x.race.event||'Compétition');const info=document.createElement('small');info.style.display='block';info.textContent=[x.race.date,x.race.circuit,x.result.team,x.race.mode==='endurance'?'ENDURANCE':x.race.mode==='championnat'?'ÉQUIPE':'SOLO'].filter(Boolean).join(' · ');const crew=document.createElement('small');crew.style.display='block';crew.textContent=x.drivers.length>1?'Équipage : '+x.drivers.join(' · '):'Pilote individuel';const delta=document.createElement('small');delta.style.display='block';const rating=raceRatingDelta(x);delta.textContent=rating===0?'Rating : sans modification':'Race Rating : '+(rating>0?'+':'')+rating+' pts';card.append(title,info,crew,delta);host.append(card)}}
async function raceRatings(rows){const scores=new Map(),events=new Map(),seen=new Set();for(const row of rows){const delta=raceRatingDelta(row),day=/^\d{4}-\d{2}-\d{2}/.test(row.race.date||'')?row.race.date.slice(0,10):null;for(const name of row.drivers){const n=VCE.norm(name);if(!n)continue;const id=[row.preset,row.race.event||'',row.race.date||'',n].join('|');if(seen.has(id))continue;seen.add(id);scores.set(n,(scores.get(n)||0)+delta);if(day&&delta){if(!events.has(n))events.set(n,[]);events.get(n).push({day,delta})}}}return {scores,events}}
async function approvedTrainingData(){
 if(!window.VCESupabase?.configured())return null;
 try{
  const reviews=await VCESupabase.reviews();
  return {seances:(reviews||[]).filter(x=>x.decision==='approved').map(x=>({
   id:x.session_id,pilot:x.pilot,date:x.reviewed_at,status:'approved',
   session:{id:x.session_id,pilot:x.pilot,date:x.reviewed_at,status:'approved'}
  }))};
 }catch(e){console.warn('Validations STAFF non disponibles',e);return {seances:[],error:e.message}}
}
/* Page-scoped data cache: heavy static resources are shared by the current
 * verified dashboard only; nothing is copied into a public per-pilot JSON.
 * Invalid/outage results are retried, not cached forever.
 */
const __vcePageCache=new Map();
async function __vceCached(name,ttl,load){
 const now=Date.now(),hit=__vcePageCache.get(name);
 if(hit&&hit.until>now)return hit.promise;
 const promise=Promise.resolve().then(load);
 __vcePageCache.set(name,{promise,until:now+ttl});
 try{return await promise}
 catch(e){if(__vcePageCache.get(name)?.promise===promise)__vcePageCache.delete(name);throw e}
}
window.addEventListener('vce-training-updated',()=>__vcePageCache.clear());
window.addEventListener('vce-team-updated',()=>__vcePageCache.clear());
async function render(){
 let d={},remote=false;
 // Independent datasets run together instead of forming a 4–5 request waterfall.
 const [shared, , cfg, approvedData, publishedResults]=await Promise.all([
  __vceCached('sessions',90_000,()=>VCE.read()).then(value=>({value}),error=>({error})),
  __vceCached('circuits',1_800_000,()=>VCE.loadCircuits()),
  __vceCached('rating-config',1_800_000,()=>Rating.config()),
  __vceCached('approved-training',30_000,()=>approvedTrainingData()),
  __vceCached('race-results',30_000,()=>publishedRaceEntries())
 ]);
 if(shared.value){d=shared.value.data;remote=true;VCE.$('source').textContent='Données synchronisées depuis : '+shared.value.source}
 else VCE.$('source').textContent='Attention : JSON partagé indisponible. Classement et rating non synchronisés. '+(shared.error?.message||'Erreur réseau');
 const now=new Date(),ranks=Rating.ranking(approvedData||{seances:[]},cfg,now),raceData=await raceRatings(publishedResults),raceScores=raceData.scores;
 showMyRaceResults(publishedResults,VCE.pilot());
 ranks.forEach(x=>{
  x.racePoints=raceScores.get(VCE.norm(x.name))||0;
  x.rating=x.racePoints;
  // Seuls les points d’entraînement validés sont convertis en XP ; le rating reste indépendant.
  // Les points sont consommés à chaque passage de classe, sans double attribution.
  let points=Math.max(0,x.earned),level=0,totalXp=0,earnedInClass=0;
  const step=Math.max(1,Number(cfg.xpPointsStep)||15);
  while(level<cfg.classes.length){
   const current=cfg.classes[level];
   const perPoint=Number(current.xpPer15Points)/step;
   const goal=Number(current.xpToNext)||1000;
   if(!(perPoint>0))break;
   const needed=Math.max(0,(goal-earnedInClass)/perPoint);
   if(level===cfg.classes.length-1||points<needed){
    earnedInClass+=points*perPoint;
    totalXp+=points*perPoint;
    break;
   }
   totalXp+=needed*perPoint;
   points-=needed;
   level++;
   earnedInClass=0;
  }
  x.xp=Math.round(totalXp);
  x.ci=level;
  x.klass=cfg.classes[level];
  x.xpInClass=Math.round(earnedInClass);
  x.goal=Number(x.klass.xpToNext)||1000;
 });
 ranks.sort((a,b)=>b.rating-a.rating||b.xp-a.xp||a.name.localeCompare(b.name));
 ranks.forEach((x,i)=>x.rank=i+1);
 let xpStatus=document.getElementById('vceXpStatus');if(!xpStatus){xpStatus=document.createElement('p');xpStatus.id='vceXpStatus';xpStatus.style.cssText='font-size:12px;color:#b6c9de;margin:8px 0';document.getElementById('xp')?.parentElement?.append(xpStatus)}if(xpStatus){const currentName=VCE.norm(VCE.pilot());const approvedCount=(approvedData?.seances||[]).filter(x=>VCE.norm(x.pilot)===currentName).length;xpStatus.textContent=approvedData?.error?'⚠ XP indisponibles : '+approvedData.error:approvedCount?'✓ '+approvedCount+' séance(s) validée(s) par le STAFF prises en compte':'XP en attente : aucune séance validée par le STAFF pour ce pilote.';}
 let p=ranks.find(x=>VCE.norm(x.name)===VCE.norm(VCE.pilot()));if(!p)p=Rating.pilotProgress([],VCE.pilot(),cfg,now);let s=VCE.stats(d,VCE.pilot());updateCommandCenter(p,s,approvedData,raceData);for(let [id,value] of Object.entries({total:s.finished.length,approved:s.approved,points:(approvedData||raceScores.size)?p.rating:'—',laps:s.tours,distance:s.distance.toFixed(1)+(s.unknown?'*':''),classLetter:(approvedData||raceScores.size)?p.klass.code:'—',className:(approvedData||raceScores.size)?p.klass.name:'NON SYNCHRONISÉ',xp:(approvedData||raceScores.size)?p.xp:'—',rank:(approvedData||raceScores.size)?'#'+p.rank:'—',rankTotal:'sur '+ranks.length+' pilotes',weeks:approvedData?p.trainedWeeks:'—'}))VCE.$(id).textContent=value;VCE.$('standingText').textContent=(approvedData||raceScores.size)?('Tu es '+p.rank+'e sur '+ranks.length+' pilotes · Rating course : '+p.rating+' pts · Progression entraînement : '+(p.earned||0)+' pts · Classe '+p.klass.code+' ('+p.klass.name+')'):'Classement indisponible : vérifie la publication des données GitHub.';VCE.$('xpLabel').textContent=(approvedData||raceScores.size)?p.xpInClass+' / '+p.goal+' XP':'Données indisponibles';VCE.$('xpBar').style.width=(approvedData||raceScores.size)?Math.min(100,p.xpInClass/p.goal*100)+'%':'0%';VCE.$('xpRemaining').textContent=(approvedData||raceScores.size)?(p.klass.code==='A'?'Objectif Alien : '+Math.max(0,p.goal-p.xpInClass)+' XP restants':'Prochaine classe : '+Math.max(0,p.goal-p.xpInClass)+' XP restants'):'';VCE.$('progressText').textContent=s.approved+' / '+s.finished.length+' séances validées';VCE.$('progress').style.width=(s.finished.length?Math.round(s.approved/s.finished.length*100):0)+'%';VCE.$('sessions').innerHTML=s.rows.length?s.rows.slice(0,12).map(x=>'<div class="item"><strong>'+VCE.safe(x.session.titre||x.session.exercice||x.session.circuit||'Entraînement')+'</strong> <span class="pill">'+(VCE.norm(d.validations?.[x.id]||x.session.status||x.session.statut).startsWith('VALID')?'VALIDÉ':'EN ATTENTE')+'</span><small>'+VCE.safe(x.session.date||'')+' · '+VCE.safe(x.session.circuit||'')+' · '+VCE.safe(x.session.tours||0)+' tours · '+VCE.safe(x.session.chrono||'')+'</small></div>').join('') :'<p class="muted">Aucune séance enregistrée.</p>';let lb=VCE.$('leaderboard');lb.replaceChildren();if(approvedData||raceScores.size){for(const x of ranks){let line=document.createElement('div');line.className='item row';if(VCE.norm(x.name)===VCE.norm(VCE.pilot()))line.style.borderColor='#ef3657';let left=document.createElement('strong');left.textContent='#'+x.rank+' · '+x.name;let right=document.createElement('span');right.textContent=x.rating+' pts · '+x.klass.code+' · '+x.xp+' XP';line.append(left,right);lb.append(line)}}else lb.textContent='Impossible de charger le classement partagé.';drawChart(approvedData?p.history:[],raceData.events.get(VCE.norm(VCE.pilot()))||[],p.rating);if(s.unknown)VCE.$('source').textContent+=' · *Distance partielle : longueur inconnue pour '+s.unknown+' séance(s).' }
function updateCommandCenter(p,s,approvedData,raceData){const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};const ok=!!approvedData&&!approvedData.error;const percentage=p.goal>0?Math.max(0,Math.min(100,Math.round(p.xpInClass/p.goal*100))):0;set('vceCommandClass',ok?'Classe '+p.klass.code+' · '+p.xp+' XP':'Progression indisponible');set('vceCommandGoal',ok?(p.klass.code==='A'?'Classe Alien · '+p.xpInClass+' XP dans la classe':Math.max(0,p.goal-p.xpInClass)+' XP avant la classe suivante'):'Validation STAFF non synchronisée');set('vceCommandPoints',ok?p.earned+' pts':'—');set('vceCommandApproved',ok?(approvedData.seances||[]).filter(x=>VCE.norm(x.pilot)===VCE.norm(VCE.pilot())).length:'—');set('vceCommandTotal',s.finished.length);set('vceCommandPending',ok?Math.max(0,s.finished.length-s.approved):'—');set('vceCommandRating',raceData.scores.size?p.rating+' pts':'—');set('vceCommandRank',raceData.scores.size?'#'+p.rank+' / '+(document.getElementById('pilotCount')?.textContent||'équipe'):'—');set('vceCommandRaces',(raceData.events.get(VCE.norm(VCE.pilot()))||[]).length);const track=document.getElementById('vceCommandTrack');if(track)track.setAttribute('aria-valuenow',ok?percentage:0);const fill=document.getElementById('vceCommandFill');if(fill)fill.style.width=(ok?percentage:0)+'%'}
function drawChart(trainingRows,raceEvents,currentRating){
 const svg=VCE.$('ratingChart');svg.replaceChildren();
 const NS='http://www.w3.org/2000/svg',W=760,H=230,l=54,r=58,t=22,b=38;
 function add(tag,attrs,label){const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(label!==undefined)el.textContent=label;svg.append(el);return el}
 const days=[...new Set([...trainingRows.map(x=>x.week),...raceEvents.map(x=>x.day)])].sort();
 if(!days.length){VCE.$('chartCaption').textContent='Aucun résultat ou entraînement validé pour le moment';return}
 const selected=days.slice(-20),training=new Map(trainingRows.map(x=>[x.week,x.rating]));
 const events=new Map();for(const e of raceEvents)events.set(e.day,(events.get(e.day)||0)+e.delta);
 let runningRating=0,runningTraining=0;
 const before=days.filter(d=>d<selected[0]);for(const d of before){runningRating+=events.get(d)||0;if(training.has(d))runningTraining=training.get(d)}
 const cfgRates=[150,125,100,75,50,25,10],cfgGoals=[1000,1000,1000,1000,1000,1000,50000];
 function xpFor(points){let remaining=Math.max(0,points),xp=0;for(let i=0;i<cfgRates.length;i++){const perPoint=cfgRates[i]/15,needed=cfgGoals[i]/perPoint,take=i===6?remaining:Math.min(remaining,needed);xp+=take*perPoint;remaining-=take;if(remaining<=0)break}return Math.round(xp)}
 const series=selected.map(day=>{runningRating+=events.get(day)||0;if(training.has(day))runningTraining=training.get(day);return {day,rating:runningRating,xp:xpFor(runningTraining)}});
 // Keep the current published rating visible even if an event lacks a valid date.
 if(series.length&&currentRating!==runningRating)series[series.length-1].rating=currentRating;
 const ratingVals=series.map(x=>x.rating),xpVals=series.map(x=>x.xp);
 const rMin=Math.min(0,...ratingVals),rMax=Math.max(4,...ratingVals),xMax=Math.max(1,...xpVals);
 const yR=v=>t+(rMax-v)/(rMax-rMin)*(H-t-b),yX=v=>t+(xMax-v)/xMax*(H-t-b),x=i=>l+(W-l-r)*i/Math.max(1,series.length-1);
 for(let i=0;i<=4;i++){const y=t+(H-t-b)*i/4;add('line',{x1:l,y1:y,x2:W-r,y2:y,stroke:'#304761','stroke-dasharray':'4 5'});add('text',{x:5,y:y+4,fill:'#ff8a9d','font-size':11},Math.round(rMax-(rMax-rMin)*i/4));add('text',{x:W-5,y:y+4,fill:'#75eab5','font-size':11,'text-anchor':'end'},Math.round(xMax*(1-i/4)))}
 for(const [key,color,fn] of [['rating','#ff4767',yR],['xp','#36cf8c',yX]]){const pts=series.map((v,i)=>[x(i),fn(v[key])]);add('polyline',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':3.5,'stroke-linejoin':'round','stroke-linecap':'round'});pts.forEach((p,i)=>add('circle',{cx:p[0],cy:p[1],r:3.5,fill:color}))}
 series.forEach((v,i)=>{if(i===0||i===series.length-1||i%Math.max(1,Math.ceil(series.length/5))===0)add('text',{x:x(i),y:H-11,fill:'#a6bdd6','font-size':11,'text-anchor':'middle'},v.day.slice(5))});
 VCE.$('chartCaption').textContent=series.length+' dates · Rating : '+series[series.length-1].rating+' · XP : '+series[series.length-1].xp;
}
VCE.$('refresh').onclick=render;
const PILOTS=[];
// All pilots start at class R; actual promotions are computed from shared sessions.
VCE.names.splice(0,VCE.names.length,...PILOTS);
const slug=n=>VCE.norm(n).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const allPilots=PILOTS.map(name=>({name,id:slug(name)}));
function showPilotList(){const q=VCE.norm(document.getElementById('pilotSearch').value);const root=document.getElementById('pilotGrid');root.replaceChildren();let found=allPilots.filter(p=>VCE.norm(p.name).includes(q));document.getElementById('pilotCount').textContent=found.length+' PILOTES';for(const p of found){let b=document.createElement('button');b.className='pilot-select';b.dataset.pilotId=p.id;let av=document.createElement('span');av.className='avatar';av.textContent=p.name.split(' ').slice(0,2).map(x=>x[0]).join('');let label=document.createElement('span');let name=document.createElement('b');name.textContent=p.name;let sub=document.createElement('small');sub.textContent='VOIR LE PROFIL · POINTS & CLASSEMENT';label.append(name,sub);b.append(av,label);b.onclick=()=>{location.hash=encodeURIComponent(p.id)};root.append(b)}}
function showAssignments(name){const root=document.getElementById('assignedList');root.replaceChildren();let items=[];try{items=JSON.parse(localStorage.getItem('vce_training_assignments_v1')||'[]')}catch{}const selected=(Array.isArray(items)?items:[]).filter(x=>VCE.norm(x.driver||'')===VCE.norm(name));if(!selected.length){root.textContent='Aucun entraînement attribué pour le moment.';return}for(const x of selected.slice().reverse()){const article=document.createElement('article');article.className='item';const title=document.createElement('h3');title.textContent=x.mode==='rhythm'?'ENTRAÎNEMENT DE RYTHME':'EXERCICE SPÉCIFIQUE';const info=document.createElement('p');info.textContent=[x.circuit,x.car,x.laps+' tour(s)',x.target?'Chrono objectif : '+x.target:''].filter(Boolean).join(' · ');const task=document.createElement('p');task.textContent='EXERCICE : '+(x.exercise||'');const status=document.createElement('small');status.textContent='STATUT : '+({assigned:'À EFFECTUER',in_progress:'EN COURS',submitted:'EN ATTENTE STAFF',approved:'VALIDÉ',rejected:'REFUSÉ'}[x.status]||'À EFFECTUER');const link=document.createElement('a');link.href='coach-irl.html?assignment='+encodeURIComponent(x.id)+'&pilot='+encodeURIComponent(name);link.textContent='CONSULTER LA SÉANCE →';article.append(title,info,task,status,document.createElement('br'),link);root.append(article)}}
function routePilot(){let id='';try{id=decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||'')}catch{}let p=allPilots.find(x=>x.id===id);const selection=document.getElementById('pilotSelection'),dashboard=document.getElementById('pilotDashboard');const verified=!!p&&window.VCEPilotAuthCanAccess?.(id)===true;selection.classList.toggle('hidden',!!p);dashboard.classList.toggle('hidden',!verified);selection.style.setProperty('display',p?'none':'block','important');dashboard.style.setProperty('display',verified?'block':'none','important');dashboard.setAttribute('aria-hidden',String(!verified));if(verified){VCE.selectPilot(p.name);showAssignments(p.name);VCE.$('name').textContent=p.name;render();document.title=p.name+' | VCE ESPORT'}else if(!p){document.title='Profils pilotes | VCE ESPORT'}window.scrollTo(0,0)}
document.getElementById('pilotSearch').oninput=showPilotList;document.getElementById('backToPilots')?.addEventListener('click',()=>location.hash='');window.addEventListener('hashchange',routePilot);window.addEventListener('vce-pilot-verified',routePilot);showPilotList();routePilot();
let __vceRefreshBusy=false;
async function refreshVceEvery10Seconds(){
 if(__vceRefreshBusy||document.hidden||!VCE.pilot()||document.getElementById('pilotDashboard').classList.contains('hidden'))return;
 __vceRefreshBusy=true;
 try{await render();}catch(e){console.warn('Actualisation VCE',e)}finally{__vceRefreshBusy=false}
}
window.setInterval(refreshVceEvery10Seconds,30000);
let __vceRosterSignature='',__vceRosterBusy=false;
const __vceRosterCacheKey='vce_verified_public_roster_v2';
function applyPilotRoster(rows,{save=false}={}){
 if(!Array.isArray(rows))return false;
 const valid=rows.filter(p=>p&&typeof p.id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)
   &&typeof p.name==='string'&&p.name.trim());
 const signature=JSON.stringify(valid.map(p=>[p.id,p.name]));
 if(signature!==__vceRosterSignature){
  __vceRosterSignature=signature;
  window.VCE_PILOT_ROSTER=valid;
  allPilots.splice(0,allPilots.length,...valid.map(p=>({id:p.id,name:p.name})));
  VCE.names.splice(0,VCE.names.length,...valid.map(p=>p.name));
  showPilotList();routePilot();
  window.dispatchEvent(new Event('vce-roster-updated'));
 }
 if(save)try{sessionStorage.setItem(__vceRosterCacheKey,JSON.stringify({at:Date.now(),rows:valid}))}catch{}
 return true;
}
function restoreRecentRoster(){
 try{
  const cached=JSON.parse(sessionStorage.getItem(__vceRosterCacheKey)||'null');
  // Only the last successfully fetched Supabase roster, never the old static list.
  if(cached&&Date.now()-cached.at<120000&&Array.isArray(cached.rows))return applyPilotRoster(cached.rows);
 }catch{}
 return false;
}
const __vceHasCachedRoster=restoreRecentRoster();
if(!__vceHasCachedRoster){
 const root=document.getElementById('pilotGrid');
 root.replaceChildren();
 for(let i=0;i<4;i++){
  const card=document.createElement('div');card.className='pilot-select vce-roster-skeleton';
  const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent='··';
  const body=document.createElement('span');body.textContent='Synchronisation VCE';
  card.append(avatar,body);root.append(card);
 }
 document.getElementById('pilotCount').textContent='CHARGEMENT DES PROFILS…';
}
async function syncPilotRoster(){
 if(__vceRosterBusy)return;
 __vceRosterBusy=true;
 try{
  if(!window.VCESupabase?.configured())throw Error('Connexion Supabase non configurée');
  const remote=await VCESupabase.read('pilotes');
  // Staff-maintained roster is authoritative; static JSON only for first setup.
  let rows;
  if(Array.isArray(remote.items))rows=remote.items;
  else{
   const res=await fetch('data/vce/pilotes.json',{cache:'default',signal:AbortSignal.timeout(6000)});
   if(!res.ok)throw Error('Liste initiale des pilotes indisponible');
   rows=(await res.json()).filter(p=>p&&p.id&&p.name);
  }
  applyPilotRoster(rows,{save:true});
 }catch(e){
  console.warn('Roster VCE indisponible :',e);
  // Keep only short-lived verified data while the server is temporarily offline.
  if(!__vceRosterSignature){
   allPilots.splice(0,allPilots.length);
   VCE.names.splice(0,VCE.names.length);
   document.getElementById('pilotGrid').replaceChildren();
   document.getElementById('pilotCount').textContent='PROFILS INDISPONIBLES · RÉESSAYER';
  }else{
   document.getElementById('pilotCount').textContent=allPilots.length+' PILOTES · SYNCHRONISATION EN ATTENTE';
  }
 }finally{__vceRosterBusy=false}
}
setTimeout(syncPilotRoster,0);
window.addEventListener('pageshow',()=>syncPilotRoster());
setInterval(()=>{if(!document.hidden)syncPilotRoster()},30000);

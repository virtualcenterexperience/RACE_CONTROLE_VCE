/* VCE Driver Academy — source-grounded coaching dialogue.
   Built from data/ressources/coach-index-v1.json. No invented telemetry or AI API calls. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const en=()=>document.documentElement.lang==='en';
const label=(fr,eng)=>en()?eng:fr;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words=s=>normalize(s).split(/\s+/).filter(w=>w.length>3);
let source=null,loading=null,turns=0,lastProblem='';
const pairs=[['Sous-virage','Understeer'],['Survirage','Oversteer'],['Freinage','Braking'],['Accélération','Acceleration'],['Régularité','Consistency'],['Blocage','Wheel locking'],['Trajectoire','Racing line']];
const synonyms={understeer:'sous virage',oversteer:'survirage',braking:'freinage',brake:'freinage',throttle:'accelerateur',wheel:'roue',lockup:'blocage',traction:'motricite',consistency:'regularite',corner:'virage',apex:'corde',exit:'sortie',entry:'entree'};
const translated=s=>normalize(s).split(' ').map(w=>synonyms[w]||w).join(' ');
const mk=(tag,text='',cls='')=>{const x=document.createElement(tag);if(cls)x.className=cls;x.textContent=text;return x};
function ui(){
 if($('vce-coach-conversation'))return;
 const anchor=document.querySelector('main')||document.querySelector('.vce-follow')||document.body;
 const panel=mk('section','','vce-coach-conversation');panel.id='vce-coach-conversation';
 const kicker=mk('small','VCE DRIVER ACADEMY / COACH TECHNIQUE');panel.append(kicker);
 const heading=mk('h2',label('Échange avec ton coach technique','Talk to your driving coach'));panel.append(heading);
 panel.append(mk('p',label('Explique ce que tu ressens dans un virage : le coach retrouve les fiches VCE correspondantes, propose un exercice, puis te pose une question de suivi.','Describe what happens in a corner: the assistant searches verified VCE training sheets, suggests an exercise and asks a follow-up question.')));
 const form=document.createElement('form');form.className='vce-coach-form';form.id='vce-coach-form';
 const make=(title,id,kind='input')=>{const lab=mk('label',title);let field;if(kind==='select'){field=document.createElement('select');for(const [value,name] of [['',label('Toutes catégories','All classes')],['GT3','GT3'],['GT4','GT4'],['MONOPLACE','Single-seater'],['TCR','TCR'],['LMP2','LMP2'],['HYPERCAR','Hypercar']])field.add(new Option(name,value))}else if(kind==='textarea'){field=document.createElement('textarea');field.rows=3;field.placeholder=label('Ex. Je perds du temps à la sortie du virage 3, l’arrière décroche quand je remets les gaz…','E.g. I lose time on corner 3 exit, the rear steps out when I accelerate…')}else{field=document.createElement('input');field.placeholder=label('Ex. Monza, virage 1','E.g. Monza, turn 1')}field.id=id;lab.append(field);form.append(lab);return field};
 make(label('Catégorie de voiture','Car class'),'vce-coach-car','select');
 make(label('Circuit et virage (si connus)','Track and corner (if known)'),'vce-coach-track');
 const question=make(label('Ton problème ou ta réponse au coach','Your issue or response to the coach'),'vce-coach-question','textarea');
 const button=mk('button',label('ANALYSER MA QUESTION','ANALYZE MY QUESTION'));button.type='submit';form.append(button);panel.append(form);
 const quick=mk('div','','vce-coach-quick');quick.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:12px';
 for(const [fr,eng] of pairs){const chip=mk('button',en()?eng:fr);chip.type='button';chip.style.cssText='font-size:11px;background:#142c49;border:1px solid #31577a;padding:8px 10px;border-radius:7px;color:#d7eaff;cursor:pointer';chip.onclick=()=>{question.value=(question.value?question.value+' · ':'')+fr;question.focus()};quick.append(chip)}
 panel.append(quick);
 const status=mk('p',label('Réponses fondées sur les ressources VCE · aucune mesure de télémétrie inventée.','Answers sourced from VCE resources · no fabricated telemetry.'));status.id='vce-coach-state';panel.append(status);
 const replies=mk('div','','vce-coach-replies');replies.id='vce-coach-replies';replies.setAttribute('aria-live','polite');panel.append(replies);
 anchor.append(panel);form.addEventListener('submit',e=>{e.preventDefault();respond(question,button,status,replies)});
}
async function library(){
 if(source)return source;
 if(!loading)loading=fetch('data/ressources/coach-index-v1.json',{cache:'force-cache'}).then(async r=>{
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(!Array.isArray(data))throw Error('Base de connaissances invalide');
  source=data;return data;
 }).catch(e=>{loading=null;throw e});
 return loading;
}
function find(rows,query,car){
 const terms=words(translated(query)),normalizedQuery=normalize(translated(query));
 const results=[];
 for(const row of rows){
  const title=normalize(row.probleme),context=normalize(row.contexte),search=normalize([row.probleme,row.contexte,row.solution,row.exercice].join(' '));
  const match=terms.filter(w=>title.includes(w)).length;
  let score=match*9+terms.filter(w=>context.includes(w)).length*4+terms.filter(w=>search.includes(w)).length;
  if(normalizedQuery&&title.includes(normalizedQuery))score+=20;
  if(car&&context.includes(normalize(car)))score+=8;
  if(terms.length&&score>=6)results.push({row,score,match});
 }
 results.sort((a,b)=>b.score-a.score||String(a.row.id).localeCompare(String(b.row.id)));
 // Only return genuinely matching subject areas, not random related terms.
 const seen=new Set();
 return results.filter(x=>{const key=x.row.probleme+'|'+x.row.contexte;if(seen.has(key))return false;seen.add(key);return true}).slice(0,3);
}
function report(replies,list,question,car,track){
 const user=mk('article','','vce-coach-reply');user.append(mk('h3',label('Pilote · Question '+turns,'Driver · Question '+turns)));user.append(mk('p',question));if(car||track)user.append(mk('small',[car,track].filter(Boolean).join(' · ')));replies.append(user);
 if(!list.length){const reply=mk('article','','vce-coach-reply');reply.append(mk('h3',label('Précisons le problème','Let’s narrow down the problem')));reply.append(mk('p',label('Je ne trouve pas de fiche suffisamment précise. Indique si le problème arrive au freinage, à l’entrée, au milieu ou à la sortie du virage, et ce que fait la voiture.','No sufficiently precise resource matches yet. Please specify whether the issue is during braking, entry, apex or exit, and describe how the car reacts.')));replies.append(reply);return}
 const first=list[0].row;lastProblem=first.probleme;
 for(const {row,score} of list){
  const card=mk('article','','vce-coach-reply');
  card.append(mk('h3',row.probleme+' · '+row.contexte));
  card.append(mk('p',row.solution||label('Aucune solution détaillée','No detailed solution')));
  if(row.exercice)card.append(mk('p',label('Exercice : ','Exercise: ')+row.exercice));
  if(row.variable_a_analyser)card.append(mk('p',label('À mesurer : ','Measure: ')+row.variable_a_analyser));
  if(row.question_suivi)card.append(mk('p',label('Question du coach : ','Coach follow-up: ')+row.question_suivi));
  card.append(mk('small','Fiche '+row.id+' · '+label('Conseil à vérifier en piste','Track validation required')));
  replies.append(card);
 }
 replies.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function respond(input,button,status,replies){
 const question=input.value.trim();if(question.length<5){status.textContent=label('Décris ton problème en quelques mots.','Describe your issue in a few words.');return}
 const car=$('vce-coach-car')?.value||'',track=$('vce-coach-track')?.value||'';
 button.disabled=true;status.textContent=label('Recherche des fiches techniques…','Searching technical resource sheets…');
 try{const rows=await library();turns++;
  const query=question+(turns>1&&lastProblem?' '+lastProblem:'');
  const result=find(rows,query,car);report(replies,result,question,car,track);
  status.textContent=label('Fiches vérifiées : ','Verified source sheets: ')+result.length+' / '+rows.length+' · '+label('échange ','turn ')+turns;
  input.value='';
 }catch(e){status.textContent=label('Ressources indisponibles : ','Resources unavailable: ')+e.message}
 finally{button.disabled=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui,{once:true});else ui();
})();

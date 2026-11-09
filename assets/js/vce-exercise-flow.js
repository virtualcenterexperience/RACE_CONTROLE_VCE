/* VCE DRIVER ACADEMY — interactive cinematic exercise walkthrough.
   Presentation layer only. Does not forge training validation or XP. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const tr=(fr,en)=>document.documentElement.lang==='en'?en:fr;
const node=(tag,text='',cls='')=>{const x=document.createElement(tag);x.className=cls;x.textContent=text;return x};
let active=null,step=0,game='',lastId='';
function dataFor(id){
 try{if(typeof exercises!=='undefined'&&Array.isArray(exercises))return exercises.find(x=>x.id===id)||null}catch(e){}
 return null;
}
function stage(){
 if(!$('vce-exercise-flow'))return;
 const root=$('vce-exercise-flow'),exercise=active;
 if(!exercise)return;
 root.replaceChildren();
 const top=node('div','','vce-flow-head');
 top.append(node('small','VCE / DRIVER ACADEMY · '+tr('ÉTAPE ','STEP ')+(step+1)+' / 5'));
 const bar=node('div','','vce-flow-progress');
 for(let i=0;i<5;i++){const seg=node('i');if(i<=step)seg.classList.add('done');bar.append(seg)}
 top.append(bar);root.append(top);
 const steps=[
 {title:tr('Objectif de pilotage','Driving objective'),body:exercise.probleme+' · '+exercise.contexte},
 {title:tr('Comprendre la correction','Understand the correction'),body:exercise.solution},
 {title:tr('Appliquer pendant la session','Apply during the session'),body:exercise.exercice},
 {title:tr('Mesurer les progrès','Measure improvement'),body:exercise.variable_a_analyser||tr('Observer la trajectoire, la vitesse et la régularité.','Observe the racing line, speed and consistency.')},
 {title:tr('Faire le débrief','Debrief'),body:exercise.question_suivi||tr('Qu’as-tu ressenti et qu’est-ce qui s’est amélioré ?','What did you feel and what improved?')}
 ];
 const item=steps[step];
 const card=node('article','','vce-flow-scene');
 const h=node('h3',item.title);card.append(h);
 const schematic=document.createElementNS('http://www.w3.org/2000/svg','svg');
 schematic.setAttribute('viewBox','0 0 600 170');schematic.setAttribute('aria-label',tr('Schéma pédagogique générique de trajectoire','Illustrative generic racing-line schematic'));
 schematic.classList.add('vce-flow-graphic');
 const track=document.createElementNS('http://www.w3.org/2000/svg','path');
 track.setAttribute('d','M18 150 C180 150 218 127 240 86 S314 18 373 48 S486 135 590 35');
 track.setAttribute('stroke','#506781');track.setAttribute('stroke-width','22');track.setAttribute('fill','none');
 const line=track.cloneNode();line.setAttribute('stroke','#4ec7e9');line.setAttribute('stroke-width','4');line.setAttribute('stroke-dasharray','17 11');line.classList.add('vce-flow-line');
 schematic.append(track,line);card.append(schematic);
 card.append(node('p',item.body));
 if(step===0){
  const lab=node('label',tr('Jeu utilisé : ','Selected game: '));
  const select=document.createElement('select');select.id='vce-flow-game';for(const name of ['Assetto Corsa','Assetto Corsa Competizione','Le Mans Ultimate','rFactor 2'])select.append(new Option(name,name));
  select.value=game||'Assetto Corsa';select.onchange=()=>{game=select.value};lab.append(select);card.append(lab);
 }
 card.append(node('small',tr('Schéma d’illustration, pas la trajectoire mesurée d’un circuit réel.','Illustrative diagram, not the measured racing line of a real circuit.')));
 root.append(card);
 const controls=node('div','','vce-flow-actions');
 const back=node('button',tr('← Précédent','← Previous'));back.disabled=step===0;back.onclick=()=>{step--;stage()};
 const next=node('button',step===4?tr('✓ Terminer','✓ Finish'):tr('Continuer →','Continue →'));next.onclick=()=>{if(step===0)game=$('vce-flow-game')?.value||game;if(step===4){root.append(node('p',tr('Séquence terminée. Une validation STAFF reste nécessaire pour attribuer des points.','Walkthrough completed. STAFF approval is still required to award points.')));next.disabled=true}else{step++;stage()}};
 controls.append(back,next);root.append(controls);
}
function start(id){
 const chosen=dataFor(id);if(!chosen)return;
 active=chosen;step=0;
 const root=$('modalBody');if(!root)return;
 let panel=$('vce-exercise-flow');if(!panel){panel=node('section','','vce-exercise-flow');panel.id='vce-exercise-flow';root.append(panel)}
 stage();
 panel.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function init(){
 const cards=$('cards'),modal=$('modalBody');if(!cards||!modal)return;
 cards.addEventListener('click',e=>{
  const btn=e.target.closest('[data-id]');if(!btn)return;
  const id=btn.dataset.id;if(id)requestAnimationFrame(()=>start(id));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* VCE Driver Academy — natural-language, track/car/turn aware coaching UI.
 * Uses a single local rule engine; no fake telemetry and no external AI service.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const engine=()=>window.VCECoachEngine;
const mk=(tag,txt,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined&&txt!==null)e.textContent=txt;return e;};
const controls={},state={previous:{},last:null,turn:0};
function field(form,title,id,kind='input',options){
 const label=mk('label',title,'vce-coach-field');const el=document.createElement(kind);
 el.id=id;if(kind==='select'){(options||[]).forEach(([value,text])=>el.add(new Option(text,value)));}
 if(kind==='textarea'){el.rows=3;el.placeholder="Ex. Je perds la voiture virage 5 à Monza en GT3…";}
 if(kind==='input')el.placeholder=title.includes('Circuit')?'Ex. Monza':title.includes('Voiture')?'Ex. BMW M4 GT3':'Ex. 5';
 label.append(el);form.append(label);controls[id]=el;return el;
}
function optionButton(text,query,form,input){
 const btn=mk('button',text,'vce-coach-chip');btn.type='button';btn.addEventListener('click',()=>{input.value=query;input.focus();form.requestSubmit();});return btn;
}
function describe(label,text){
 const block=mk('div',null,'vce-coach-detail');block.append(mk('span',label,'vce-coach-detail-label'),mk('p',text));return block;
}
function render(result,question,replies){
 replies.replaceChildren();
 const overview=mk('article',null,'vce-coach-overview');
 overview.append(mk('small','LECTURE DU MESSAGE · ÉCHANGE '+state.turn));
 overview.append(mk('h3',result.title));
 overview.append(mk('p',result.description));
 const tags=mk('div',null,'vce-coach-tags');
 for(const tag of [result.context.category||'Catégorie à préciser',result.context.model||'Modèle à préciser',result.context.trackLabel,result.context.cornerLabel,'Setup : '+result.context.setup,(result.context.phase?({entree:'Entrée',milieu:'Milieu',sortie:'Sortie'})[result.context.phase]:'Phase à préciser')])tags.append(mk('span',tag));
 overview.append(tags);
 if(result.context.actions.length)overview.append(describe('ACTIONS REPÉRÉES DANS LA PHRASE',result.context.actions.join(' · ')));
 else overview.append(describe('ACTION À IDENTIFIER','Précise si tu freines, tournes le volant, passes sur un vibreur ou remets les gaz au moment de la perte.'));
 const car=mk('div',null,'vce-coach-profile');car.append(mk('h4','01 · CARACTÉRISTIQUES DE LA VOITURE'));for(const t of result.hint)car.append(mk('p',t));overview.append(car);
 replies.append(overview);
 const heading=mk('div',null,'vce-coach-section-head');heading.append(mk('h3','02 · COMMENT PILOTER CE VIRAGE'),mk('p','Pour chaque phase : placement, cause possible, réaction si le problème survient et exercice correctif.'));replies.append(heading);
 const stages=mk('div',null,'vce-coach-phase-grid');
 for(const phase of result.stages){
  const article=mk('article',null,'vce-coach-phase-card'+(phase.selected?' is-selected':''));
  article.append(mk('div',phase.title+(phase.selected?' · PHASE SIGNALÉE':''),'vce-coach-phase-title'));
  article.append(describe('PLACEMENT ET ANTICIPATION',phase.placement));
  article.append(describe('CE QUI PEUT PROVOQUER LE PROBLÈME',phase.cause));
  article.append(describe('ACTION SI LE PROBLÈME SURVIENT',phase.correction));
  article.append(describe('PILOTAGE À AMÉLIORER',phase.improvement));
  article.append(describe('EXERCICE À TESTER',phase.exercise));
  stages.append(article);
 }
 replies.append(stages);
 const bottom=mk('div',null,'vce-coach-bottom-grid');
 const evid=mk('section',null,'vce-coach-evidence');
 evid.append(mk('h3','03 · CONTEXTE DU CIRCUIT ET SOURCES'));
 for(const note of result.sourceNotes)evid.append(mk('p',note));
 if(!result.sourceNotes.length)evid.append(mk('p','Aucune fiche de virage précisément reconnue : les conseils restent génériques jusqu’à identification du circuit et de son tracé.'));
 if(result.missing?.length)evid.append(mk('p','Certaines bases sont momentanément absentes : '+result.missing.join(', ')+'.'));
 evid.append(mk('small','Sources internes : fiches VCE de circuits, catalogue voitures, catégories de véhicules et bibliothèque d’exercices. Les vitesses et réglages chiffrés ne sont pas supposés.'));
 if(result.resources.length){
  const refs=mk('div',null,'vce-coach-reference');
  refs.append(mk('h4','Fiches techniques transversales'));
  for(const row of result.resources){const card=mk('div',null,'vce-coach-source');card.append(mk('b',row.id+' · '+row.title));if(row.solution)card.append(mk('p',row.solution));if(row.exercise)card.append(mk('small','Exercice VCE : '+row.exercise));refs.append(card);}
  evid.append(refs);
 }
 bottom.append(evid);
 const follow=mk('section',null,'vce-coach-follow');
 follow.append(mk('h3','04 · QUESTION DU COACH'));
 for(const q of result.followups.slice(0,4))follow.append(mk('p','• '+q));
 const tip=mk('p','Tu peux répondre directement : « C’est l’arrière en sortie », « Setup standard, pneus froids » ou « Je freine encore à la corde ». Le circuit et la voiture restent en mémoire pendant cet échange.','vce-coach-tip');follow.append(tip);
 const add=mk('button','AJOUTER AU DÉBRIEF','vce-coach-debrief');add.type='button';
 add.onclick=()=>{
  const target=$('vceDebrief');if(!target){$('vce-coach-state').textContent='Fiche de débrief introuvable.';return;}
  const ctx=result.context;
  const stageText=result.stages.map(x=>x.title+'\nPlacement : '+x.placement+'\nCause possible : '+x.cause+'\nCorrection : '+x.correction+'\nAmélioration : '+x.improvement+'\nExercice : '+x.exercise).join('\n\n');
  const full='ANALYSE VCE · À CONFIRMER EN PISTE\nRessenti : '+question+'\nCatégorie : '+(ctx.category||'à préciser')+' | Voiture : '+(ctx.model||'à préciser')+'\nCircuit : '+ctx.trackLabel+' | '+ctx.cornerLabel+' | Setup : '+ctx.setup+'\n'+stageText;
  target.value=(target.value.trim()?target.value.trim()+'\n\n':'')+full;
  target.dispatchEvent(new Event('input',{bubbles:true}));
  $('vce-coach-state').textContent='Analyse ajoutée au débrief de séance (elle n’a pas été envoyée au Staff).';
 };
 follow.append(add);bottom.append(follow);replies.append(bottom);
}
async function submit(question,btn,replies,stateText){
 if(question.trim().length<5){stateText.textContent='Décris le comportement observé en quelques mots.';return;}
 if(!engine()){stateText.textContent='Le moteur de coaching n’est pas disponible. Recharge la page.';return;}
 btn.disabled=true;stateText.textContent='Analyse de la phrase et chargement des fiches circuits / voitures…';
 try{
  const data=await engine().load();
  const opts={category:controls['vce-coach-category']?.value||'',model:controls['vce-coach-model']?.value||$('vceCar')?.value||'',track:controls['vce-coach-track']?.value||$('vceCircuit')?.value||'',corner:controls['vce-coach-turn']?.value||'',phase:controls['vce-coach-phase']?.value||'',setup:controls['vce-coach-setup']?.value||''};
  const result=engine().analyze(question,opts,data,state.previous);state.turn++;state.last=result;
  state.previous={...result.context,cornerNumber:result.context.cornerNumber};
  if(result.context.track&&!controls['vce-coach-track'].value)controls['vce-coach-track'].value=result.context.track.name;
  if(result.context.category&&!controls['vce-coach-category'].value){const el=controls['vce-coach-category'];if([...el.options].some(x=>x.value===result.context.category))el.value=result.context.category;}
  if(result.context.cornerNumber&&!controls['vce-coach-turn'].value)controls['vce-coach-turn'].value=String(result.context.cornerNumber);
  if(result.context.model&&!controls['vce-coach-model'].value)controls['vce-coach-model'].value=result.context.model;
  render(result,question,replies);
  stateText.textContent='Analyse locale terminée · '+data.tracks.length+' circuits et '+result.coverage.corners+' virages disponibles · '+state.turn+' échange(s).';
 }catch(err){stateText.textContent='Analyse indisponible : '+(err?.message||'erreur de chargement')+'. Les données pilotes restent inchangées.';}
 finally{btn.disabled=false;}
}
function init(){
 if($('vce-coach-conversation'))return;
 const anchor=document.querySelector('main.wrap');if(!anchor)return;
 const panel=mk('section',null,'vce-coach-conversation');panel.id='vce-coach-conversation';
 panel.append(mk('div','VCE DRIVER ACADEMY · DIAGNOSTIC CONTEXTUEL','vce-coach-eyebrow'));
 panel.append(mk('h2','TON RESSENTI, VIRAGE PAR VIRAGE'));
 panel.append(mk('p','Explique le problème avec tes mots. Le coach identifie le circuit, le virage, la catégorie et les commandes possibles, puis détaille le pilotage à travailler en entrée, au milieu et en sortie.'));
 const form=mk('form',null,'vce-coach-form');form.id='vce-coach-form';
 const category=field(form,'Catégorie','vce-coach-category','select',[['','À identifier dans la phrase'],['GT3','GT3 / LMGT3'],['GT4','GT4'],['GTE','GTE'],['TCR','TCR / WTCR'],['F1','F1'],['F2','F2'],['F3','F3'],['F4','F4'],['LMP2','LMP2'],['LMP3','LMP3'],['HYPERCAR','Hypercar'],['PORSCHE CUP','Porsche Cup'],['INDYCAR','IndyCar']]);
 field(form,'Voiture exacte (facultatif)','vce-coach-model');
 field(form,'Circuit','vce-coach-track');
 const turn=field(form,'Virage n°','vce-coach-turn');turn.type='number';turn.min='1';turn.max='99';
 field(form,'Phase ressentie','vce-coach-phase','select',[['','À déterminer'],['entree','Freinage / entrée'],['milieu','Milieu / corde'],['sortie','Sortie / réaccélération']]);
 field(form,'Configuration','vce-coach-setup','select',[['','Setup non précisé'],['standard','Setup standard'],['personnalisé','Setup personnalisé']]);
 const question=field(form,'Décris ton problème comme tu le dirais au coach','vce-coach-question','textarea');question.required=true;
 const btn=mk('button','ANALYSER MON PILOTAGE','vce-coach-submit');btn.type='submit';form.append(btn);panel.append(form);
 const quick=mk('div',null,'vce-coach-quick');quick.append(mk('span','ESSAYER :'));
 quick.append(optionButton('Monza T5 · Perte de contrôle','Je perds la voiture virage 5 à Monza en GT3',form,question));
 quick.append(optionButton('Sous-virage à l’entrée','J’ai du sous-virage à l’entrée du virage 1 à Spa en GT3',form,question));
 quick.append(optionButton('Survirage en sortie','L’arrière décroche à la sortie du virage 6 à Monza en GT3',form,question));
 panel.append(quick);
 const status=mk('p','Moteur local · aucune télémétrie simulée · vérification en piste nécessaire.','vce-coach-status');status.id='vce-coach-state';status.setAttribute('role','status');panel.append(status);
 const replies=mk('div',null,'vce-coach-replies');replies.id='vce-coach-replies';replies.setAttribute('aria-live','polite');panel.append(replies);
 const old=anchor.querySelector('.panel');if(old)old.insertAdjacentElement('afterend',panel);else anchor.append(panel);
 form.addEventListener('submit',event=>{event.preventDefault();const text=question.value.trim();if(text)submit(text,btn,replies,status);});
 category.addEventListener('change',()=>{if(category.value==='GT3'&&!controls['vce-coach-model'].value&&$('vceCar')?.value&&$('vceCar').value!=='GT3')controls['vce-coach-model'].value=$('vceCar').value;});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

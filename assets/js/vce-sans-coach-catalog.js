/* VCE ESPORT — SANS COACH: exercises only. Two catalogues, no technical adviser. */
'use strict';
let exercises=[];
const $=id=>document.getElementById(id);
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dataPaths=['entrainements/exercices_vce.json','entrainements/exercices_rythme_gt3.json','entrainements/exercices_trajectoires_gt3.json'];
const continents=['afrique','amerique-du-nord','amerique-du-sud','asie','europe','oceanie'];
const imageFiles={
 freinage:['01_point_de_freinage.webp','02_dosage_du_frein.webp','03_stabilite_entree.webp','04_freinage_degressif.webp','05_trail_braking.webp'],
 acceleration:['01_sortie_de_virage.webp','02_dosage_accelerateur.webp','03_traction_motricite.webp','04_gestion_patinage.webp','05_pleine_acceleration.webp'],
 technique:['01_trajectoire_ideale.webp','02_transferts_de_masse.webp','03_utilisation_vibreurs.webp','04_placement_volant.webp','05_enchainements_virages.webp'],
 objectif:['01_temps_a_atteindre.webp','02_position_cible.webp','03_stint_constant.webp','04_gestion_strategique.webp','05_preservation_pneus.webp'],
 attack:['01_preparer_attaque.webp','02_analyser_adversaire.webp','03_choix_trajectoire.webp','04_execution_depassement.webp','05_consolider_position.webp'],
 defense:['01_anticiper_attaque.webp','02_fermer_trajectoire.webp','03_gerer_pression.webp','04_defendre_sortie.webp','05_garder_avantage.webp'],
 rythme:['01_tour_rapide_qualifications.webp','02_regularite_course.webp','03_gestion_trafic.webp','04_gestion_pneus.webp','05_gestion_rythme_global.webp']
};
const imageLabel={freinage:'Freinage',acceleration:'Accélération',technique:'Trajectoire et technique',objectif:'Objectif et stratégie',attack:'Attaque et dépassement',defense:'Défense',rythme:'Rythme de course'};
let structured=[],complementary=null,circuits=[],level='TOUS',page=0,pack='structure';
async function read(url){const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error(url+' HTTP '+response.status);return response.json()}
function levelOf(raw){
 const n=normalize(raw||'').replace(/[\s-]+/g,'_');
 if(n==='esport_pro'||n==='esport')return 'ESPORT_PRO';
 if(n==='performance'||n==='academie')return 'PERFORMANCE';
 return 'ROOKIE';
}
function categorize(x){
 const title=normalize(x.title),module=normalize(x.module),combo=title+' '+module;
 if(/frein|brak|blocage|abs|trail/.test(title))return 'freinage';
 if(/gaz|acceler|traction|motric|patinage|traction control/.test(title))return 'acceleration';
 if(/attaque|depassement|adversaire/.test(module)||/depassement|attaquer|attaque|suivre un adversaire/.test(title))return 'attack';
 if(/defen|protection/.test(module)||/defen|protege|position interieure/.test(title))return 'defense';
 if(/chrono|position cible|stint|strategie|undercut|overcut|stands|pit stop|objectif/.test(title))return 'objectif';
 if(/qualification|regularit|rythme|concentration|pneu|usure|trafic|depart|premier tour/.test(combo))return 'rythme';
 if(/frein/.test(module))return 'freinage';
 if(/accel|motric/.test(module))return 'acceleration';
 if(/defen/.test(combo))return 'defense';
 if(/attaqu|depasse/.test(combo))return 'attack';
 if(/trajectoire|corde|rotation|volant|chicane|vibreur|transfert|equilibre|enchainement/.test(combo))return 'technique';
 return 'technique';
}
function imageFor(x){
 const group=x.group||categorize(x);
 const t=normalize((x.title||'')+' '+(x.module||''));
 const files=imageFiles[group]||imageFiles.technique;
 let index=0;
 if(group==='freinage'){if(/trail|degressif|relach/.test(t))index=4;else if(/stabilit|equilibre/.test(t))index=2;else if(/dosage|pression|abs|blocage/.test(t))index=1;else if(/repere|point de frein/.test(t))index=0;else index=3;}
 else if(group==='acceleration'){if(/patin|tc|traction control/.test(t))index=3;else if(/motric|traction/.test(t))index=2;else if(/dosage|progressiv/.test(t))index=1;else if(/pleine/.test(t))index=4;else index=0;}
 else if(group==='technique'){if(/vibreur/.test(t))index=2;else if(/volant|contre braqu/.test(t))index=3;else if(/enchain|chicane|transfert lateral/.test(t))index=4;else if(/transfert|equilibre/.test(t))index=1;else index=0;}
 else if(group==='objectif'){if(/pneu|usure/.test(t))index=4;else if(/strateg|undercut|overcut|stand|pit/.test(t))index=3;else if(/stint|constan/.test(t))index=2;else if(/position|classement/.test(t))index=1;else index=0;}
 else if(group==='attack'){if(/prepar|rapproch|aspirat/.test(t))index=0;else if(/observation|analy|adversaire/.test(t))index=1;else if(/trajectoire|interieur|exterieur/.test(t))index=2;else if(/consolid|gagn/.test(t))index=4;else index=3;}
 else if(group==='defense'){if(/anticip|retroviseur/.test(t))index=0;else if(/trajectoire|interieur/.test(t))index=1;else if(/pression|duel/.test(t))index=2;else if(/sortie/.test(t))index=3;else index=4;}
 else if(group==='rythme'){if(/qualification|tour rapide/.test(t))index=0;else if(/pneu|usure|degrad/.test(t))index=3;else if(/trafic|course|bataille/.test(t))index=2;else if(/concentration|regularit|constan/.test(t))index=1;else index=4;}
 return {url:'data/images/entrainement/'+files[index],alt:imageLabel[group]||'Exercice de pilotage'};
}
function normalizeStructured(r,source){
 const lvl=levelOf(r.niveau),text=r.consigne||r.consignes||r.objectif||'';
 const specific=Array.isArray(r.procedure)?r.procedure.join(' '):text;
 const criteria=r.criteres_validation||r.critere_validation||(r.validation?.criteres||[]).join(' • ')||'À évaluer après la session';
 const x={id:r.id,level:lvl,source:'structure',sourceLabel:source,title:r.titre||r.module||r.competence||'Exercice VCE',module:r.module||r.competence||'Technique',carClass:(r.voitures||r.vehicules||[]).join(' · ')||r.categorie||'Toutes catégories',duration:r.tours_recommandes||r.tentatives_recommandees||null,probleme:r.titre||r.competence,contexte:r.module||r.competence||r.categorie||'Pilotage',exercice:specific,solution:r.objectif||'',variable_a_analyser:Array.isArray(r.mesures)?r.mesures.join(' · '):r.analyse||'',question_suivi:r.erreurs_frequentes?'À surveiller : '+r.erreurs_frequentes:'Quels progrès observes-tu ?',validation:criteria,preparation:r.situation_depart||'',notes:r.precautions||r.note_staff||r.securite_reglement||'',procedure:r.procedure||[],status:r.statut||'',};
 x.group=categorize(x);return x;
}
function normalizeComplementary(r){
 const x={...r,id:r.id,level:'ROOKIE',source:'complementary',sourceLabel:'Bibliothèque VCE',title:r.probleme||'Technique',module:r.contexte||'Général',carClass:r.contexte||'Général',duration:null,validation:'À valider selon le programme défini par le Staff',preparation:'Choisis un circuit, une voiture et des conditions reproductibles.',notes:r.verification||'',procedure:[]};
 const t=normalize([r.probleme,r.exercice,r.solution].join(' '));
 x.level=/depassement|defense|attaque|qualification|trail.brak|survirage|sous.virage|telemetrie|contre.braquage|freinage degressif/.test(t)?'ESPORT_PRO':/regularit|rythme|freinage|trajectoire|motricite|vibreur|acceler/.test(t)?'PERFORMANCE':'ROOKIE';
 x.group=categorize(x);return x;
}
function activeExercises(){return pack==='structure'?structured:complementary||[]}
function updateCategory(){
 const prev=$('category').value;
 const groups=[...new Set(activeExercises().map(x=>x.group))].sort((a,b)=>imageLabel[a].localeCompare(imageLabel[b],'fr'));
 $('category').replaceChildren(new Option('Toutes les compétences',''));
 for(const grp of groups)$('category').add(new Option(imageLabel[grp],grp));
 if(groups.includes(prev))$('category').value=prev;
}
function filter(){
 const q=normalize($('search').value.trim()),grp=$('category').value,cat=normalize($('vehicleType').value),sort=$('sortOrder').value;
 let a=activeExercises().filter(x=>(level==='TOUS'||x.level===level)&&(!grp||x.group===grp)&&(!cat||normalize(x.carClass+' '+x.module+' '+x.contexte).includes(cat))&&(!q||normalize([x.title,x.module,x.exercice,x.solution,x.carClass].join(' ')).includes(q)));
 const rank={ROOKIE:0,PERFORMANCE:1,ESPORT_PRO:2};
 a.sort((a,b)=>sort==='alphabet'?a.title.localeCompare(b.title,'fr'):sort==='difficulty'?(rank[a.level]-rank[b.level]||a.title.localeCompare(b.title,'fr')):(imageLabel[a.group].localeCompare(imageLabel[b.group],'fr')||rank[a.level]-rank[b.level]||a.title.localeCompare(b.title,'fr')));
 return a;
}
function photo(x,large=false){const img=imageFor(x);return '<img class="exercise-photo'+(large?' large':'')+'" src="'+esc(img.url)+'" alt="'+esc(img.alt)+'" loading="lazy" onerror="this.onerror=null;this.src=\'data/images/entrainement/precision-volant.webp\'">'}
function show(){
 const a=filter(),size=18,max=Math.max(1,Math.ceil(a.length/size));
 page=Math.max(0,Math.min(page,max-1));
 $('total').textContent=pack==='structure'?String(structured.length):String((complementary||[]).length);
 $('count').textContent=a.length+' exercice(s) · '+(pack==='structure'?'packs VCE structurés':'ressources complémentaires');
 $('pageInfo').textContent='Page '+(page+1)+' / '+max;
 $('previous').disabled=page===0;$('next').disabled=page>=max-1;
 $('cards').innerHTML=a.slice(page*size,(page+1)*size).map(x=>'<article class="card" data-level="'+esc(x.level)+'">'+photo(x)+'<div class="card-meta"><span class="tag">'+(x.level==='ESPORT_PRO'?'ESPORT PRO':esc(x.level))+'</span><small>'+esc(imageLabel[x.group])+' · '+esc(x.sourceLabel)+'</small></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.solution||x.exercice).slice(0,190)+'</p><div class="card-footer"><small>'+esc(x.carClass)+'</small><button type="button" data-id="'+esc(x.id)+'">VOIR L’EXERCICE</button></div></article>').join('')||'<p class="muted">Aucun exercice trouvé : change les filtres.</p>';
}
function setupContext(){
 const cs=$('trainingCircuit');const track=cs?.value!==''?circuits[Number(cs.value)]:null;
 const i=$('trainingCorner')?.value,corner=track&&i!==''?track.virages?.[Number(i)]:null;
 return {game:$('trainingGame').value,car:$('trainingCar').value||$('vehicleType').value,track:track?.name||'',corner:corner?.nom||corner?.etiquette||'',assists:$('trainingAssists').value,setup:$('trainingSetup').value};
}
function modal(x){
 const cx=setupContext();
 $('modalBody').dataset.level=x.level;
 $('modalBody').innerHTML='<span class="tag">'+(x.level==='ESPORT_PRO'?'ESPORT PRO':esc(x.level))+'</span><h2>'+esc(x.title)+'</h2>'+photo(x,true)+'<p><b>Compétence :</b> '+esc(imageLabel[x.group])+' · '+esc(x.carClass)+'</p><p><b>Objectif :</b> '+esc(x.solution||'Réaliser la technique proprement et de façon reproductible.')+'</p><p><b>Consignes :</b> '+esc(x.exercice)+'</p>'+(x.duration?'<p><b>Volume conseillé :</b> '+esc(x.duration)+' passages / tours (à adapter)</p>':'')+'<p><b>Validation :</b> '+esc(x.validation)+'</p>'+(x.variable_a_analyser?'<p><b>Mesures :</b> '+esc(x.variable_a_analyser)+'</p>':'')+(x.notes?'<p><b>Précautions :</b> '+esc(x.notes)+'</p>':'')+'<div class="notice"><b>Contexte sélectionné :</b> '+esc(Object.values(cx).filter(Boolean).join(' · '))+'<p>Exercice autonome : aucune attribution de points automatique. Toute validation officielle dépend du Staff.</p></div>';
 if(Array.isArray(x.procedure)&&x.procedure.length){let list=document.createElement('ol');for(const step of x.procedure){const li=document.createElement('li');li.textContent=step;list.append(li)}$('modalBody').append(list)}
 $('modal').classList.remove('hidden');$('modal').setAttribute('aria-hidden','false');
}
function selectedCorner(){
 const ix=$('trainingCircuit').value,t=ix!==''?circuits[Number(ix)]:null;
 $('trainingCorner').replaceChildren(new Option('Tout le circuit',''));
 for(const [i,c] of (t?.virages||[]).entries())$('trainingCorner').add(new Option('T'+c.numero+' — '+(c.nom||c.etiquette||'Virage'),String(i)));
}
async function switchPack(){
 pack=$('sourcePack').value;page=0;
 if(pack==='complementary'&&!complementary){
  $('status').textContent='Chargement de la bibliothèque complémentaire…';
  try{const rows=await read('data/ressources/coach-index-v1.json');complementary=rows.slice(0,800).map(normalizeComplementary)}
  catch(e){$('status').textContent='Bibliothèque indisponible : '+e.message;return;}
 }
 exercises=activeExercises();window.VCETrainingExercises=exercises;
 $('status').textContent=pack==='structure'?'Exercices structurés VCE, avec consignes et critères de validation.':'Fiches complémentaires VCE : difficulté indicative, à adapter au véhicule et au circuit.';
 updateCategory();show();
}
async function init(){
 try{
  const [packs,tracks]=await Promise.all([
   Promise.all(dataPaths.map(read)),
   Promise.all(continents.map(n=>read('data/'+n+'.json').catch(()=>({circuits:[]}))))
  ]);
  structured=packs.flatMap((j,i)=>(j.exercices||[]).map(x=>normalizeStructured(x,i===0?'VCE multi-catégories':i===1?'GT3 · Rythme':'GT3 · Trajectoires')));
  structured=[...new Map(structured.map(x=>[x.id,x])).values()];
  circuits=tracks.flatMap(v=>v.circuits||[]);
  $('trainingCircuit').replaceChildren(new Option('Choisir le circuit',''));
  circuits.forEach((c,i)=>$('trainingCircuit').add(new Option(c.name,String(i))));
  $('status').textContent='Packs VCE chargés : '+structured.length+' exercices classés. Les fiches complémentaires sont chargées à la demande.';
  await switchPack();
 }catch(e){$('status').textContent='Chargement des exercices impossible : '+e.message;}
}
$('sourcePack').addEventListener('change',switchPack);
$('levels').addEventListener('click',e=>{const btn=e.target.closest('[data-level]');if(!btn)return;level=btn.dataset.level;page=0;document.querySelectorAll('#levels button').forEach(el=>el.classList.toggle('active',el===btn));show();});
$('search').addEventListener('input',()=>{page=0;show()});
$('category').addEventListener('change',()=>{page=0;show()});
$('vehicleType').addEventListener('change',()=>{page=0;show()});
$('sortOrder').addEventListener('change',()=>{page=0;show()});
$('trainingCircuit').addEventListener('change',selectedCorner);
$('previous').addEventListener('click',()=>{page--;show();$('cards').scrollIntoView({block:'start',behavior:'smooth'})});
$('next').addEventListener('click',()=>{page++;show();$('cards').scrollIntoView({block:'start',behavior:'smooth'})});
$('cards').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;const x=exercises.find(y=>y.id===b.dataset.id);if(x)modal(x)});
$('close').addEventListener('click',()=>{$('modal').classList.add('hidden');$('modal').setAttribute('aria-hidden','true')});
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))$('close').click()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))$('close').click()});
init();

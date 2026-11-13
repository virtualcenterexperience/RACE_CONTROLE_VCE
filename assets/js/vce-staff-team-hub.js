/* VCE Staff Control — focused TEAM / PILOTES areas, other workstreams unchanged. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const modules={
 team:[
  ['🏆','Résultats','Valider les propositions et publier les classements officiels.','resultats-staff.html'],
  ['📥','Résultats reçus','Examiner les courses envoyées par les pilotes.','team-resultats-recus.html'],
  ['📅','Calendrier','Créer les manches, circuits, dates et championnats.','calendrier-staff.html'],
  ['📣','Annonces & overlays','Créer les annonces, affiches et communications.','announcement-staff.html'],
  ['🏎','Lineups','Composer les équipages et leurs affiches.','lineup-staff.html']
 ],
 pilotes:[
  ['⚙','Gestion des pilotes','Ajouter, retirer, réactiver et gérer les accès.','#gestion-pilotes'],
  ['♙','Profils pilotes','Consulter les profils et les performances.','pilote.html'],
  ['📡','Télémétrie pilote','Associations des appareils, flux live et historique.','telemetry-staff.html'],
  ['▤','Données pilotes','Sauvegarder et gérer les données individuelles.','gestion-donnees-pilotes.html']
 ]
};
const create=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt)el.textContent=txt;return el};
function buildGroup(key,label,summary,asset){
 const section=create('section','vce-staff-hub-group');section.id='staff-'+key;
 const header=create('div','vce-staff-hub-heading');
 const title=create('h2','',label);
 const back=create('a','vce-staff-hub-back','← Retour à l’accueil Staff');back.href='#overview';
 header.append(title,create('p','',summary),back);
 section.append(header);
 const cards=create('div','vce-staff-hub-links');
 for(const [icon,name,description,href] of modules[key]){
  const card=create('a','vce-staff-hub-action');card.href=href;
  card.append(create('span','vce-staff-hub-action-icon',icon));
  const body=create('div','');body.append(create('strong','',name),create('small','',description));
  card.append(body,create('span','vce-staff-hub-chevron','↗'));cards.append(card)
 }
 section.append(cards);
 return section
}
function init(){
 const content=document.querySelector('#dashboard .rc-content');
 const hero=content?.querySelector('.rc-hero');
 if(!hero||$('vce-staff-hub'))return;
 const shell=create('section','vce-staff-hub');shell.id='vce-staff-hub';
 const intro=create('div','vce-staff-hub-intro');intro.append(create('small','','VCE ESPORT / CENTRE DE CONTRÔLE'),
  create('h2','','CHOISIS TON ESPACE DE TRAVAIL'),
  create('p','','Deux espaces dédiés pour retrouver rapidement les publications et la gestion des pilotes. Les autres outils restent disponibles.'));
 shell.append(intro);
 const selector=create('div','vce-staff-hub-choice');
 for(const [key,headline,caption,image] of [
  ['team','TEAM','Résultats · calendrier · annonces · lineups','data/images/simulateurs-vce.webp'],
  ['pilotes','PILOTES','Télémétrie · gestion · profils','data/images/coaching-sur-piste.webp']
 ]){
  const a=create('a','vce-staff-hub-tile');a.href='#staff-'+key;
  const photo=create('div','vce-staff-hub-photo');photo.style.backgroundImage='linear-gradient(0deg,#071321f0,#07132129),url("'+image+'")';
  const label=create('div','vce-staff-hub-tile-label');
  label.append(create('small','',key==='team'?'01 / COMPÉTITION':'02 / EFFECTIF'),
    create('strong','',headline),create('span','',caption));
  photo.append(label);a.append(photo);
  a.setAttribute('aria-label','Ouvrir '+headline);selector.append(a);
 }
 shell.append(selector,buildGroup('team','TEAM / COMPÉTITION','Tous les outils et les résultats envoyés par les pilotes.'),buildGroup('pilotes','PILOTES / PERFORMANCE','Profils, télémétrie, effectif et données.'));hero.after(shell);
 // The original quick-access cards still exist but duplicate group links are hidden.
 const duplicates=new Set(['#gestion-pilotes','pilote.html','telemetry-staff.html','gestion-donnees-pilotes.html',
 'resultats-staff.html','calendrier-staff.html','announcement-staff.html','lineup-staff.html']);
 for(const card of document.querySelectorAll('#dashboard .rc-cards > a')){
  const url=card.getAttribute('href')||'';
  if(duplicates.has(url.split('?')[0]))card.remove()
 }
 const tools=content.querySelector('.rc-workmain>.rc-sectionhead>span');
 if(tools)tools.textContent='03 / AUTRES OUTILS STAFF';
 const team=$('staff-team'),pilotes=$('staff-pilotes'),dashboard=$('dashboard');
 const syncRoute=()=>{
  const key=location.hash==='#staff-team'?'team':location.hash==='#staff-pilotes'?'pilotes':'';
  dashboard.classList.toggle('vce-staff-team-selected',key==='team');
  dashboard.classList.toggle('vce-staff-pilotes-selected',key==='pilotes');
  team.hidden=key!=='team';pilotes.hidden=key!=='pilotes';
  for(const tile of selector.querySelectorAll('a')){
   const active=tile.getAttribute('href')==='#staff-'+key;
   tile.classList.toggle('selected',!!key&&active);
   if(active&&key)tile.setAttribute('aria-current','page');else tile.removeAttribute('aria-current');
  }
  // Avoid stale scrolled position when navigating between workspace categories.
  if(key)requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
 };
 window.addEventListener('hashchange',syncRoute);
 window.addEventListener('pageshow',syncRoute);
 syncRoute();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
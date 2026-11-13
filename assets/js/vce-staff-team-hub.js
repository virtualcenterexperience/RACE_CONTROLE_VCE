/* VCE Staff Control — workspace categories and dashboard routes. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const categories=[
 [
  "administratif",
  "ADMINISTRATIF",
  "Gestion des pilotes · données · sauvegardes · candidatures",
  "coaching-sur-piste.webp",
  [
   [
    "⚙",
    "Gestion des pilotes",
    "Ajouter, retirer, réactiver et gérer les accès.",
    "#gestion-pilotes"
   ],
   [
    "♙",
    "Voir les profils",
    "Choisir un pilote et ouvrir son tableau de bord en vue spectateur.",
    "pilote.html?view=spectateur"
   ],
   [
    "▤",
    "Données pilotes",
    "Gérer les données individuelles et les validations.",
    "gestion-donnees-pilotes.html"
   ],
   [
    "▣",
    "Cache, sauvegardes et réinitialisation",
    "Sauvegarder et réinitialiser les données d’entraînement.",
    "cache-staff.html"
   ],
   [
    "!",
    "Candidatures",
    "Consulter les notifications de recrutement.",
    "#candidatures"
   ],
   [
    "⌁",
    "Télémétrie et appareils",
    "Consulter les flux et gérer les associations.",
    "telemetry-staff.html"
   ]
  ]
 ],
 [
  "entrainement",
  "ENTRAÎNEMENT",
  "Attributions · validations · suivi · évaluations",
  "pilotage-coache.webp",
  [
   [
    "◈",
    "Attributions et entraînements",
    "Créer un exercice et l’attribuer à un pilote.",
    "entrainement-staff.html"
   ],
   [
    "✓",
    "Validation des entraînements",
    "Examiner les séances envoyées.",
    "validation-seances.html"
   ],
   [
    "⌁",
    "Suivi des entraînements",
    "Consulter l’évolution des séances.",
    "evolution-entrainements-staff.html"
   ],
   [
    "◎",
    "Évaluer les pilotes",
    "Consulter les grilles et les chronos.",
    "evaluations-staff.html"
   ]
  ]
 ],
 [
  "team",
  "TEAM",
  "Résultats · lineups · calendrier · annonces",
  "simulateurs-vce.webp",
  [
   [
    "🏆",
    "Résultats",
    "Publier les classements officiels.",
    "resultats-staff.html"
   ],
   [
    "📥",
    "Résultats reçus",
    "Examiner les courses envoyées par les pilotes.",
    "team-resultats-recus.html"
   ],
   [
    "🏎",
    "Lineups",
    "Composer les équipages et leurs affiches.",
    "lineup-staff.html"
   ],
   [
    "📅",
    "Calendrier",
    "Créer les manches, circuits et dates.",
    "calendrier-staff.html"
   ],
   [
    "📣",
    "Annonces et overlays",
    "Créer les annonces, affiches et communications.",
    "announcement-staff.html"
   ]
  ]
 ]
];
const create=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt)el.textContent=txt;return el};
function buildGroup(key,label,links){
 const section=create('section','vce-staff-hub-group');section.id='staff-'+key;
 const header=create('div','vce-staff-hub-heading');
 const title=create('h2','',label);
 const back=create('a','vce-staff-hub-back','← Retour à l’accueil Staff');back.href='#overview';
 header.append(title,back);
 section.append(header);
 const cards=create('div','vce-staff-hub-links');
 for(const [icon,name,description,href] of links){
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
 const intro=create('div','vce-staff-hub-intro');
 intro.append(create('h2','','ESPACES DE TRAVAIL'));
 shell.append(intro);
 const selector=create('div','vce-staff-hub-choice');
 for(const [key,headline,caption,image] of categories){
  const a=create('a','vce-staff-hub-tile');a.href='#staff-'+key;
  const photo=create('div','vce-staff-hub-photo');photo.style.backgroundImage='linear-gradient(0deg,#071321f0,#07132129),url("data/images/'+image+'")';
  const label=create('div','vce-staff-hub-tile-label');
  label.append(create('strong','',headline),create('span','',caption));
  photo.append(label);a.append(photo);
  a.setAttribute('aria-label','Ouvrir '+headline);selector.append(a);
 }
 const groups=categories.map(([key,title,,,links])=>buildGroup(key,title,links));
 shell.append(selector,...groups);
 hero.after(shell);
 const dashboard=$('dashboard');
 const syncRoute=()=>{
  const hash=location.hash;
  const key=hash==='#staff-pilotes'?'administratif':categories.find(([name])=>hash==='#staff-'+name)?.[0];
  if(key)dashboard.dataset.staffSection=key;
  else delete dashboard.dataset.staffSection;
  for(const group of groups)group.hidden=group.id!=='staff-'+key;
  const section=key||((hash==='#gestion-pilotes'||hash==='#candidatures')?'administratif':'');
  if(section)dashboard.querySelector('.rc-navsection[data-section="'+section+'"]')?.setAttribute('open','');
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
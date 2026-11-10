/* VCE STAFF / RACE CONTROL — compact guidance for complex digital tools.
   Instructions match existing workflows. Never modifies forms or permissions. */
(()=>{'use strict';
 const name=location.pathname.split('/').pop().toLowerCase();
 const contents={
  'entrainement-staff.html':{
   title:'ATTRIBUTION DES ENTRAÎNEMENTS',steps:[
    ['01','Sélectionner le pilote','La liste provient de l’effectif actif Supabase. Actualise-la si un pilote vient d’être ajouté.'],
    ['02','Préparer','Choisis la voiture, le circuit, les tours et l’exercice, puis enregistre un brouillon local.'],
    ['03','Attribuer','Clique sur « Attribuer au pilote » pour publier dans Supabase. Le pilote le reçoit dans son espace.']
   ],note:'Un brouillon local ne constitue pas une attribution. Les points et XP nécessitent une validation Staff.'},
  'calendrier-staff.html':{
   title:'CALENDRIER DE COMPÉTITION',steps:[
    ['01','Créer les manches','Renseigne la date, le circuit, le championnat et les informations de course.'],
    ['02','Vérifier le visuel','Prévisualise le calendrier. Le studio d’overlay permet d’ajuster les blocs et les textes.'],
    ['03','Publier','Publie seulement la version vérifiée pour la retrouver dans TEAM côté pilote.']
   ],note:'La prévisualisation seule ne publie rien.'},
  'resultats-staff.html':{
   title:'RÉSULTATS ET AFFICHES',steps:[
    ['01','Choisir le type de course','Individuel et endurance utilisent des compositions différentes.'],
    ['02','Renseigner les pilotes','Sélectionne les profils, positions et chronos, puis vérifie le classement.'],
    ['03','Contrôler avant publication','Exporte l’affiche et publie uniquement les résultats officiels vérifiés.']
   ],note:'Les propositions reçues depuis TEAM doivent être examinées. Leur acceptation ne modifie pas seule le rating.'},
  'lineup-staff.html':{
   title:'COMPOSITION DES LINEUPS',steps:[
    ['01','Sélectionner le championnat','Renseigne l’épreuve, l’équipe et la date de la composition.'],
    ['02','Choisir les pilotes','Vérifie les portraits, l’ordre et la lisibilité des noms sur l’overlay.'],
    ['03','Exporter ou publier','Utilise l’éditeur graphique pour déplacer les textes et les visuels.']
   ],note:'Les images et les placements doivent être vérifiés dans l’aperçu avant publication.'},
  'telemetry-staff.html':{
   title:'ASSOCIATION PC ET TÉLÉMÉTRIE',steps:[
    ['01','Identifier la demande','Contrôle l’identifiant du PC et le pilote demandé. Une IP locale seule ne prouve pas l’identité.'],
    ['02','Valider le rattachement','Sélectionne le bon profil et confirme ou refuse la demande.'],
    ['03','Contrôler le flux','Vérifie le dernier signal et ouvre l’historique des sessions reçues.']
   ],note:'Un PC approuvé ne garantit pas une télémétrie active : le simulateur et l’application doivent fournir des données réelles.'},
  'strategie.html':{
   title:'CALCULATEUR DE STRATÉGIE',steps:[
    ['01','Saisir les paramètres','Durée de course, chronos, consommation, capacité du réservoir et pilotes.'],
    ['02','Comparer les scénarios','Contrôle l’autonomie, les relais, les arrêts et les marges de sécurité.'],
    ['03','Sauvegarder','Les 3 courses restent sur cet appareil : exporte un JSON pour les conserver ailleurs.']
   ],note:'Résultats indicatifs issus des données saisies. Le trafic, la météo et les règlements peuvent changer la stratégie.'},
  'validation-seances.html':{
   title:'VALIDATION DES SÉANCES',steps:[
    ['01','Contrôler les preuves','Vérifie le pilote, la date, le jeu et les objectifs de l’entraînement.'],
    ['02','Décider','Approuve ou refuse en fonction des critères retenus par le Staff.'],
    ['03','Vérifier la progression','L’approbation alimente les points d’entraînement et XP, pas le rating des courses.']
   ],note:'Les validations sont des actions Staff ; ne valide pas une séance uniquement parce qu’elle apparaît dans la liste.'},
  'gestion-donnees-pilotes.html':{
   title:'GESTION DES DONNÉES PILOTES',steps:[
    ['01','Choisir le bon pilote','Vérifie son profil avant toute modification.'],
    ['02','Sauvegarder','Prépare une sauvegarde de sécurité avant les opérations importantes.'],
    ['03','Confirmer les changements','Relis les conséquences d’une remise à zéro avant de valider.']
   ],note:'Attention : certaines opérations affectent l’historique ou la progression. Aucun reset automatique n’est effectué depuis cette aide.'}
 };
 const translations={
 'entrainement-staff.html':{
  title:'TRAINING ASSIGNMENTS',steps:[
   ['Select the driver','The list comes from the active Supabase roster. Refresh it when a driver has just been added.'],
   ['Prepare the session','Choose the car, track, laps and exercise, then save a local draft.'],
   ['Assign','Choose “Assign to driver” to publish through Supabase. The driver will receive it in their workspace.']],
  note:'Local drafts are not assignments. Training points and XP require STAFF approval.'},
 'calendrier-staff.html':{
  title:'RACING CALENDAR',steps:[
   ['Create rounds','Enter each date, track, championship and race details.'],
   ['Review the graphic','Preview the calendar. The overlay studio lets you adjust blocks and text.'],
   ['Publish','Publish only the verified version for display in the driver TEAM workspace.']],
  note:'Previewing alone does not publish anything.'},
 'resultats-staff.html':{
  title:'RESULTS & GRAPHICS',steps:[
   ['Choose race format','Individual races and endurance use different graphic layouts.'],
   ['Enter drivers','Select driver profiles, positions and lap times, then verify the ranking.'],
   ['Check before publishing','Export the graphic and publish only verified official results.']],
  note:'TEAM submissions must be reviewed. Acceptance alone does not change rating.'},
 'lineup-staff.html':{
  title:'DRIVER LINEUPS',steps:[
   ['Choose the event','Enter the competition, team and lineup date.'],
   ['Select drivers','Check portraits, driver order and name readability in the overlay.'],
   ['Export or publish','Use the graphic editor to reposition labels and images.']],
  note:'Check image placement and legibility before publication.'},
 'telemetry-staff.html':{
  title:'PC LINKING & TELEMETRY',steps:[
   ['Identify the request','Check the PC identifier and requested driver. A local IP alone is not proof of identity.'],
   ['Approve the link','Select the correct profile and approve or reject the request.'],
   ['Check the stream','Review last contact and real telemetry session history.']],
  note:'An approved PC does not guarantee a live feed. The game and agent must supply real telemetry.'},
 'strategie.html':{
  title:'RACE STRATEGY CALCULATOR',steps:[
   ['Enter assumptions','Race duration, lap times, fuel consumption, tank capacity and drivers.'],
   ['Compare scenarios','Review range, stints, pit stops and safety margins.'],
   ['Save your plan','The three races stay on this device: export JSON to keep a separate backup.']],
  note:'Forecasts depend on inputs. Traffic, weather and regulations can change the optimal strategy.'},
 'validation-seances.html':{
  title:'TRAINING SESSION APPROVAL',steps:[
   ['Check the evidence','Review the driver, date, game and training objectives.'],
   ['Decide','Approve or reject according to the STAFF criteria.'],
   ['Review progress','Approval updates training points and XP, not race rating.']],
  note:'Only STAFF can validate sessions; appearing in the list is not sufficient evidence.'},
 'gestion-donnees-pilotes.html':{
  title:'DRIVER DATA MANAGEMENT',steps:[
   ['Check the profile','Verify the driver before changing their data.'],
   ['Back up','Create a security backup before important changes.'],
   ['Confirm changes','Review the consequences of any reset before proceeding.']],
  note:'Some actions affect history or progress. This guide never runs an automatic reset.'}
 };
 const data=contents[name];if(!data)return;
 const translation=translations[name],english=(el,phrase)=>{if(!phrase)return el;el.dataset.en=phrase;if(document.documentElement.lang==='en')el.textContent=phrase;return el};
 const root=document.querySelector('main .wrap')||document.querySelector('main')||document.querySelector('.app')||document.body;
 const title=root.querySelector('h1')||(name==='strategie.html'?document.querySelector('.app .top'):null);if(!title||document.getElementById('vce-tool-guide'))return;
 const help=document.createElement('details');help.id='vce-tool-guide';help.className='vce-tool-guide';
 const summary=document.createElement('summary');summary.textContent='ⓘ REPÈRES POUR UTILISER CET OUTIL';english(summary,'ⓘ HOW TO USE THIS TOOL');help.append(summary);
 const intro=document.createElement('p');intro.className='vce-tool-guide-title';intro.textContent=data.title;english(intro,translation?.title);help.append(intro);
 const list=document.createElement('ol');
 for(const [num,head,desc] of data.steps){
  const item=document.createElement('li');const number=document.createElement('span');number.className='vce-tool-guide-num';number.textContent=num;
  const div=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');
  strong.textContent=head;p.textContent=desc;english(strong,translation?.steps?.[Number(num)-1]?.[0]);english(p,translation?.steps?.[Number(num)-1]?.[1]);div.append(strong,p);item.append(number,div);list.append(item);
 }
 help.append(list);
 const note=document.createElement('p');note.className='vce-tool-guide-note';note.textContent=data.note;english(note,translation?.note);help.append(note);
 title.insertAdjacentElement('afterend',help);
})();

/* VCE Staff — notifications for new Google Forms applications.
 * All list/read/configure calls require a verified Supabase Staff session.
 * The public form link opens the form, not the private responses.
 */
(()=>{'use strict';
const FORM_URL='https://docs.google.com/forms/d/e/1FAIpQLSfdDPpEsIyQHoyAVT43dIzWgvbwdX1Z4Kw_7Gr8_u5rEGr7pg/viewform?usp=sharing';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
let panel,nav,badge,list,status,setupStatus,first=true,lastIds=new Set(),loading=false,configured=false,notifiedByBrowser=false;
function setText(value){if(status)status.textContent=value}
function currentStaff(){const d=$('dashboard');return d&&getComputedStyle(d).display!=='none'&&!d.hidden&&Boolean(window.VCESupabase?.session())}
async function api(method,action){
 const session=await window.VCESupabase?.validSession();
 const cfg=window.VCE_SUPABASE;
 if(!session?.access_token||!cfg?.url||!cfg?.key)throw Error('Connexion Staff nécessaire.');
 const response=await fetch(cfg.url+'/functions/v1/vce-applications',{
  method,cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:{'Content-Type':'application/json',apikey:cfg.key,Authorization:'Bearer '+session.access_token},
  ...(method==='POST'?{body:JSON.stringify({action})}:{})
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'Erreur HTTP '+response.status);
 return body;
}
function badgeCount(n){
 badge.textContent=n>99?'99+':n>0?String(n):'';
 badge.hidden=!n;nav.dataset.unread=String(n>0);
}
function notify(message){
 const toast=make('div','vce-app-toast',message);
 document.body.append(toast);
 setTimeout(()=>toast.remove(),6500);
 if(notifiedByBrowser&&'Notification' in window&&Notification.permission==='granted'){
  try{new Notification('VCE ESPORT · Nouvelle candidature',{body:message,tag:'vce-recrutement'})}catch(e){}
 }
}
function draw(rows,unread){
 list.replaceChildren();badgeCount(unread);
 if(!rows.length){list.append(make('p','vce-app-empty','Aucune candidature reçue depuis la mise en service des notifications.'));return;}
 for(const row of rows){
  const article=make('article','vce-app-item'+(!row.read_at?' is-new':''));
  article.append(make('div','vce-app-alert','!'));
  const content=make('div','vce-app-text');
  content.append(make('b','',row.message||'Tiens, tiens, tiens… On dirait que quelqu’un vient de postuler !'));
  const date=row.submitted_at||row.received_at;
  const when=Number.isFinite(Date.parse(date))?new Date(date).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'Date inconnue';
  content.append(make('small','',when+(row.read_at?' · Lu':' · Nouveau')));
  article.append(content);list.append(article);
 }
}
async function refresh(){
 if(loading||!currentStaff())return;
 loading=true;try{
  const result=await api('GET');
  const rows=Array.isArray(result.items)?result.items:[];
  const incoming=rows.filter(r=>!r.read_at&&!lastIds.has(r.id));
  if(!first&&incoming.length)notify('❗ Tiens, tiens, tiens… On dirait que quelqu’un vient de postuler !');
  first=false;lastIds=new Set(rows.map(r=>r.id));
  configured=Boolean(result.configured);
  const state=$('vceAppConnection');if(state)state.textContent=configured?'Réception sécurisée configurée · en attente du déclencheur Google':'Webhook non configuré · active la connexion Google Forms';
  draw(rows,Number(result.unread)||0);
  setText('Dernière vérification : '+new Date().toLocaleTimeString('fr-FR'));
 }catch(e){setText('Notifications indisponibles : '+String(e.message||e));}
 finally{loading=false}
}
function showByRoute(){
 if(!panel)return;
 const visible=location.hash==='#candidatures';
 panel.hidden=!visible;
 nav.classList.toggle('selected',visible);
 if(visible){refresh();if(currentStaff())requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));}
}
function section(){
 if(panel)return;
 const dashboard=$('dashboard'),sidebar=dashboard?.querySelector('.rc-nav'),content=dashboard?.querySelector('.rc-content');
 if(!dashboard||!sidebar||!content)return;
 nav=make('a','rc-navlink','');
 nav.href='#candidatures';
 nav.append(make('span','rc-navico','!'),document.createTextNode(' Candidatures '));
 badge=make('span','vce-app-navbadge','0');badge.id='vceApplicationsBadge';badge.hidden=true;nav.append(badge);
 sidebar.append(nav);
 panel=make('section','vce-app-panel');panel.id='vceApplicationsPanel';panel.hidden=true;
 const head=make('div','vce-app-header');
 const left=make('div');left.append(make('small','vce-app-eyebrow','STAFF CONTROL / RECRUTEMENT'),make('h2','', 'CANDIDATURES · NOTIFICATIONS'),make('p','', 'Un ! apparaît à chaque nouvelle réponse au formulaire VCE. Les réponses et les coordonnées ne sont pas copiées sur ce site.'));
 const tools=make('div','vce-app-actions');
 const open=make('a','vce-app-button','OUVRIR LE FORMULAIRE');open.href=FORM_URL;open.target='_blank';open.rel='noopener noreferrer';open.title='Ouvre le formulaire public, pas les réponses réservées au propriétaire.';
 const reload=make('button','vce-app-button','ACTUALISER');reload.type='button';reload.onclick=refresh;
 const mark=make('button','vce-app-button vce-app-primary','TOUT MARQUER COMME LU');mark.type='button';mark.onclick=async()=>{mark.disabled=true;try{await api('POST','read');await refresh()}catch(e){setText(e.message)}finally{mark.disabled=false}};
 tools.append(open,reload,mark);head.append(left,tools);panel.append(head);
 const intro=make('p','vce-app-callout','❗ Tiens, tiens, tiens… On dirait que quelqu’un vient de postuler !');panel.append(intro);
 status=make('p','vce-app-status','Vérification des candidatures…');status.setAttribute('role','status');panel.append(status);
 list=make('div','vce-app-list');list.setAttribute('aria-live','polite');panel.append(list);
 const setup=make('details','vce-app-setup');const summary=make('summary','','CONNEXION GOOGLE FORMS · CONFIGURER LES NOTIFICATIONS');setup.append(summary);
 setup.append(make('p','', 'La réponse d’un candidat doit déclencher l’envoi sécurisé de son événement vers Supabase. Le lien public du formulaire ne donne pas accès à ses réponses.'));
 setupStatus=make('p','vce-app-status','');setupStatus.id='vceAppConnection';setup.append(setupStatus);
 const steps=make('ol');
 for(const step of ['Dans ton formulaire Google, ouvre l’onglet Réponses et associe une feuille Google Sheets.','Dans la feuille de réponses : Extensions → Apps Script. Colle le fichier integrations/google-forms/onFormSubmit.gs du dépôt.','Clique sur « Créer le secret du webhook » ci-dessous et copie-le dans les propriétés de script sous la clé VCE_WEBHOOK_SECRET.','Dans Apps Script : Déclencheurs → Ajouter un déclencheur → fonction vceOnFormSubmit → événement « Lors de l’envoi du formulaire » (source Feuille de calcul).'])steps.append(make('li','',step));
 setup.append(steps);
 const rotate=make('button','vce-app-button vce-app-primary','CRÉER LE SECRET DU WEBHOOK');rotate.type='button';
 const box=make('div','vce-app-secret');box.hidden=true;
 const code=make('input');code.type='text';code.readOnly=true;code.setAttribute('aria-label','Secret à copier dans les propriétés de script');code.autocomplete='off';
 const copy=make('button','vce-app-button','COPIER LE SECRET');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.value);setupStatus.textContent='Secret copié. Colle-le dans les propriétés de script Google Apps Script.'}catch(e){code.select();setupStatus.textContent='Sélectionne le secret puis copie-le manuellement.'}};
 box.append(code,copy);setup.append(box);
 rotate.onclick=async()=>{
  if(configured&&!confirm('Créer un nouveau secret désactivera immédiatement le précédent. Si un déclencheur Google existe, il faudra le mettre à jour. Continuer ?'))return;
  rotate.disabled=true;
  try{const data=await api('POST','rotate_token');code.value=data.webhook_secret;box.hidden=false;configured=true;setupStatus.textContent='Secret créé. Il ne sera affiché qu’ici : configure maintenant le déclencheur Google Apps Script.';}
  catch(e){setupStatus.textContent='Configuration impossible : '+e.message}
  finally{rotate.disabled=false}
 };
 setup.append(rotate);
 const browser=make('button','vce-app-button','ACTIVER LES ALERTES BUREAU');browser.type='button';
 browser.onclick=async()=>{if(!('Notification' in window)){setupStatus.textContent='Ce navigateur ne prend pas en charge les notifications bureau.';return}const perm=await Notification.requestPermission();notifiedByBrowser=perm==='granted';setupStatus.textContent=perm==='granted'?'Alertes bureau autorisées pendant que Staff est ouvert.':'Alertes bureau non autorisées.'};
 setup.append(browser);
 panel.append(setup);
 content.prepend(panel);
 window.addEventListener('hashchange',showByRoute);
 window.addEventListener('vce-staff-authenticated',()=>{first=true;lastIds.clear();refresh();showByRoute()});
 window.addEventListener('vce-staff-logged-out',()=>{first=true;lastIds.clear();badgeCount(0);panel.hidden=true;list.replaceChildren()});
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},30000);
 showByRoute();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',section,{once:true});else section();
})();

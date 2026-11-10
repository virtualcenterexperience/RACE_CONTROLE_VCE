/* VCE Graphic Layout Editor — local draft, explicit export, no server changes.
   Query ?edit=1 enables dragging/repositioning, theme selection and image uploads.
   ?layout=local displays saved layout without editor controls. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const edit=params.get('edit')==='1';
// Saved local layout is also shown in the ordinary overlay view.
const overlays={
 'overlay-lineup.html':[['logo','.vce-official-logo'],['header','.top'],['title','.heading'],['drivers','.drivers'],['footer','.footer']],
 'overlay-resultats.html':[['logo','.vce-official-logo'],['header','.header'],['board','#board'],['footer','.foot']],
 'overlay-calendrier.html':[['logo','#vce-official-logo'],['header','.top'],['title','.title'],['cards','#cards'],['footer','.footer']]
};
const basename=location.pathname.split('/').pop(),groups=overlays[basename];if(!groups)return;
const store='vce-overlay-editor-v1:'+basename;
let settings={theme:'blue',items:{},images:{},texts:{},background:{mode:'default',preset:'blue',image:'',position:50,positionY:50,darkness:32}},target=null,selected=null,drag=null;
const $=id=>document.getElementById(id);
const finite=(n,min,max,fallback)=>{const x=Number(n);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback};
const stage=()=>document.querySelector('#stage,.stage');
const attr=(el,s)=>el?.setAttribute?.('data-vce-overlay-theme',s);
function load(){
 try{const stored=JSON.parse(localStorage.getItem(store));if(stored&&typeof stored==='object'){
  settings.theme=stored.theme==='red'?'red':'blue';
  if(stored.items&&typeof stored.items==='object')settings.items=stored.items;
  if(stored.images&&typeof stored.images==='object')settings.images=stored.images;
  if(stored.texts&&typeof stored.texts==='object')settings.texts=stored.texts;
  if(stored.background&&typeof stored.background==='object')settings.background={...settings.background,...stored.background};
 }}catch{}
}
function ids(){
 const arr=groups.slice();
 const textItems={
 'overlay-lineup.html':[['name-title','.heading h1'],['caption','.heading p'],['strapline','.eyebrow'],['main-brand','.top .brand']],
 'overlay-resultats.html':[['results-title','.headline span'],['results-caption','.subhead'],['results-event','#event'],['results-season','#season'],['footer-title','.foot span:first-child']],
 'overlay-calendrier.html':[['calendar-title','.title'],['calendar-eyebrow','.eyebrow'],['calendar-championship','.champname'],['calendar-right','.righttitle span']]
 };
 arr.push(...(textItems[basename]||[]));
 for(const id of Object.keys(settings.texts||{}))if(id.startsWith('custom-'))arr.push([id,'[data-vce-custom-text="'+id+'"]']);
 if(basename==='overlay-lineup.html')document.querySelectorAll('.drivers .driver').forEach((e,i)=>arr.push(['driver-'+(i+1),'.drivers .driver:nth-child('+(i+1)+')']));
 if(basename==='overlay-resultats.html')document.querySelectorAll('#board .result,#board .group-row,#board .group-driver').forEach((e,i)=>arr.push(['result-'+(i+1),'#board .result:nth-child('+(i+1)+'),#board .group-row:nth-child('+(i+1)+'),#board .group-driver:nth-child('+(i+1)+')']));
 return arr;
}
const locate=id=>document.querySelector(ids().find(x=>x[0]===id)?.[1]||'nosuchtag');
function ensureCustomText(){
 const surface=stage();if(!surface)return;
 for(const [id,value] of Object.entries(settings.texts||{})){
  if(!id.startsWith('custom-')||!/^custom-[1-9]\d*$/.test(id))continue;
  let el=surface.querySelector('[data-vce-custom-text="'+id+'"]');
  if(!el){el=document.createElement('div');el.dataset.vceCustomText=id;
   el.style.cssText='position:absolute;left:180px;top:400px;z-index:45;color:#f5fbff;font:900 54px/1.1 Arial,sans-serif;text-transform:uppercase;max-width:1000px;white-space:pre-wrap;pointer-events:auto';
   surface.append(el)}
  if(el.textContent!==String(value))el.textContent=String(value);
 }
}
function renderItem(id){
 const el=locate(id);if(!el)return;
 const x=settings.items[id]||{};
 if(Object.prototype.hasOwnProperty.call(settings.texts,id)){
  const content=String(settings.texts[id]).slice(0,240);
  if(el.textContent!==content)el.textContent=content;
 }
 el.style.translate=finite(x.x,-1000,1000,0)+'px '+finite(x.y,-1000,1000,0)+'px';
 el.style.scale=String(finite(x.scale,.3,2.2,1));
 el.style.rotate=finite(x.rotation,-40,40,0)+'deg';
 if(x.z!==undefined)el.style.zIndex=String(finite(x.z,0,100,10));
 const photo=settings.images[id];
 if(photo&&/^data:image\/(png|webp|jpeg);base64,/.test(photo)){
  if(el.tagName==='IMG')el.src=photo;
  else {const img=el.querySelector('.portrait img,.group-portrait img,.portrait-lineup img');if(img)img.src=photo;else el.style.backgroundImage='url('+photo+')'}
 }
}
function apply(){
 const body=document.body;body.dataset.vceOverlayTheme=settings.theme;
 applyBackground();
 ensureCustomText();
 for(const [id] of ids())renderItem(id);
}

// Independent background editor: same settings for lineup, results and calendar.
function applyBackground(){
 const surface=stage();if(!surface)return;
 const bg=settings.background||{};
 const mode=['default','preset','image'].includes(bg.mode)?bg.mode:'default';
 document.body.dataset.vceBgMode=mode;
 surface.style.removeProperty('background');
 if(mode==='default')return;
 const palettes={
  blue:'linear-gradient(125deg,#07111f 0%,#113456 55%,#030915 100%)',
  red:'linear-gradient(125deg,#150912 0%,#56142b 60%,#070b15 100%)',
  graphite:'linear-gradient(135deg,#05090f 0%,#17202c 55%,#05070b 100%)',
  violet:'linear-gradient(125deg,#100c20 0%,#292047 52%,#080b15 100%)',
  black:'linear-gradient(125deg,#020304,#0a1018 60%,#020304)'
 };
 if(mode==='preset'){
  surface.style.setProperty('background',palettes[bg.preset]||palettes.blue,'important');
 }else if(mode==='image'&&typeof bg.image==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/.test(bg.image)){
  const darkness=finite(bg.darkness,0,85,32)/100;
  surface.style.setProperty('background',`linear-gradient(rgba(1,7,15,${darkness}),rgba(1,7,15,${darkness})),url("${bg.image}") ${finite(bg.position,0,100,50)}% ${finite(bg.positionY,0,100,50)}% / cover no-repeat`,'important');
 }else{
  surface.style.setProperty('background',palettes.blue,'important');
 }
}
async function uploadBackground(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12000000)throw Error('Sélectionne un JPG, PNG ou WebP de 12 Mo maximum.');
 const img=new Image(),u=URL.createObjectURL(file);
 try{
  await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('Impossible de lire cette image.'));img.src=u});
  const canvas=document.createElement('canvas');
  const ratio=Math.min(1,1920/Math.max(img.width,img.height));
  canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const converted=canvas.toDataURL('image/webp',.76);
  if(converted.length>3200000)throw Error('Image trop volumineuse après compression : utilise une image plus légère.');
  const previous={...settings.background};
  settings.background={...previous,mode:'image',image:converted};
  applyBackground();
  if(!save()){settings.background=previous;applyBackground();throw Error('Stockage navigateur saturé. Exporte le JSON ou choisis une image plus légère.')}
 }finally{URL.revokeObjectURL(u)}
}

function save(){
 try{localStorage.setItem(store,JSON.stringify(settings));return true}
 catch(e){return false}
}
function pick(id){
 target=id;
 document.querySelectorAll('.vce-graphic-target').forEach(el=>{el.dataset.vceSelected='no'});
 selected=locate(id);
 if(selected)selected.dataset.vceSelected='yes';
 const fields=['x','y','scale','rotation'];
 for(const k of fields){const f=$('vce-editor-'+k);if(f)f.value=settings.items[id]?.[k]??(k==='scale'?1:0)}
 if($('vce-editor-pick'))$('vce-editor-pick').value=id;
 if($('vce-editor-text')){
  const current=selected?.textContent||'';
  $('vce-editor-text').value=Object.prototype.hasOwnProperty.call(settings.texts,id)?settings.texts[id]:current.trim().slice(0,240);
  $('vce-editor-text').disabled=!selected;
 }
}
function readControls(){
 if(!target)return;
 const v={x:finite($('vce-editor-x')?.value,-1000,1000,0),y:finite($('vce-editor-y')?.value,-1000,1000,0),
 scale:finite($('vce-editor-scale')?.value,.3,2.2,1),rotation:finite($('vce-editor-rotation')?.value,-40,40,0)};
 settings.items[target]=v;renderItem(target);
}
function download(){
 const blob=new Blob([JSON.stringify({schema:'vce.overlay-layout.v1',overlay:basename,...settings},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='VCE-layout-'+basename.replace('.html','')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function upload(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12000000)throw Error('Image JPG, PNG ou WebP, 12 Mo max.');
 const img=new Image(),url=URL.createObjectURL(file);
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
 const c=document.createElement('canvas');const ratio=Math.min(1,1200/Math.max(img.width,img.height));c.width=Math.round(img.width*ratio);c.height=Math.round(img.height*ratio);
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 const data=c.toDataURL('image/webp',.78);
 settings.images[target]=data;renderItem(target);
 if(!save())throw Error('Photo trop volumineuse pour le stockage local. Exportez le JSON.');
 }finally{URL.revokeObjectURL(url)}
}
function marker(){
 if(!edit)return;
 document.body.classList.add('vce-graphic-editing');
 const panel=document.createElement('aside');panel.className='vce-editor-panel';panel.innerHTML=
 '<h2>VCE GRAPHIC STUDIO</h2><p class="vce-editor-muted">Déplace les blocs à la souris. Choisis un thème, modifie les tailles et place les portraits / logos. Les modifications restent sur cet appareil tant que tu ne les exportes pas.</p>'+
 '<section class="vce-editor-background"><h3>ARRIÈRE-PLAN</h3><label>Type de fond<select id="vce-bg-mode"><option value="default">Design original VCE</option><option value="preset">Dégradé personnalisé</option><option value="image">Photo / image importée</option></select></label><label>Couleur / ambiance<select id="vce-bg-preset"><option value="blue">Bleu racing</option><option value="red">Rouge compétition</option><option value="graphite">Graphite</option><option value="violet">Violet nuit</option><option value="black">Noir studio</option></select></label><label>Importer un arrière-plan<input id="vce-bg-file" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Position horizontale de la photo <output id="vce-bg-position-label">50 %</output><input id="vce-bg-position" type="range" min="0" max="100" value="50"></label><label>Position verticale <output id="vce-bg-position-y-label">50 %</output><input id="vce-bg-position-y" type="range" min="0" max="100" value="50"></label><label>Assombrir pour la lisibilité <output id="vce-bg-darkness-label">32 %</output><input id="vce-bg-darkness" type="range" min="0" max="85" value="32"></label><div class="vce-editor-buttons"><button type="button" id="vce-bg-remove">SUPPRIMER LA PHOTO</button></div><p class="vce-editor-muted">L’image et son cadrage sont conservés dans le brouillon de cet overlay et inclus dans l’export JSON.</p></section>'+
 '<div class="vce-editor-buttons"><button type="button" data-theme="red">ACCENT ROUGE</button><button type="button" data-theme="blue">ACCENT BLEU</button></div>'+
 '<label>Élément à modifier<select id="vce-editor-pick"></select></label>'+
 '<label>Décalage horizontal (px)<input id="vce-editor-x" type="number" step="5" value="0"></label>'+
 '<label>Décalage vertical (px)<input id="vce-editor-y" type="number" step="5" value="0"></label>'+
 '<label>Taille (facteur)<input id="vce-editor-scale" type="range" min=".3" max="2.2" step=".05" value="1"></label>'+
 '<label>Rotation (degrés)<input id="vce-editor-rotation" type="range" min="-40" max="40" step="1" value="0"></label>'+
 '<label>Texte à afficher (240 caractères max)<textarea id="vce-editor-text" maxlength="240" rows="3" placeholder="Titre, sous-titre, nom, annonce…"></textarea></label>'+
 '<div class="vce-editor-buttons"><button type="button" id="vce-editor-add-text">+ AJOUTER UN TEXTE</button><button type="button" id="vce-editor-reset-text">TEXTE PAR DÉFAUT</button></div>'+
 '<label>Remplacer la photo / le logo<input id="vce-editor-image" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 '<div class="vce-editor-buttons"><button type="button" id="vce-editor-save">ENREGISTRER</button><button type="button" id="vce-editor-export">EXPORT JSON</button><button type="button" id="vce-editor-import">IMPORT JSON</button><button type="button" id="vce-editor-reset">RÉINITIALISER</button></div>'+
 '<input id="vce-editor-import-file" type="file" accept=".json,application/json" hidden>'+
 '<p class="vce-editor-status" id="vce-editor-status" role="status"></p>';
 document.body.append(panel);
 const list=$('vce-editor-pick');
 function populate(){const old=list.value;list.replaceChildren(...ids().filter(([id])=>locate(id)).map(([id])=>new Option(id.toUpperCase().replaceAll('-',' '),id)));if([...list.options].some(o=>o.value===old))list.value=old;else if(list.options.length)pick(list.options[0].value)}
 populate();
 const bgMode=$('vce-bg-mode'),bgPreset=$('vce-bg-preset'),bgPosition=$('vce-bg-position'),bgPositionY=$('vce-bg-position-y'),bgDarkness=$('vce-bg-darkness');
 function syncBackgroundControls(){
  const bg=settings.background||{};
  bgMode.value=bg.mode||'default';bgPreset.value=bg.preset||'blue';
  bgPosition.value=finite(bg.position,0,100,50);bgPositionY.value=finite(bg.positionY,0,100,50);bgDarkness.value=finite(bg.darkness,0,85,32);
  $('vce-bg-position-label').textContent=bgPosition.value+' %';$('vce-bg-position-y-label').textContent=bgPositionY.value+' %';
  $('vce-bg-darkness-label').textContent=bgDarkness.value+' %';
  bgPosition.disabled=bgMode.value!=='image';bgPositionY.disabled=bgMode.value!=='image';bgDarkness.disabled=bgMode.value!=='image';
 }
 function updateBackground(){settings.background={...settings.background,mode:bgMode.value,preset:bgPreset.value,position:Number(bgPosition.value),positionY:Number(bgPositionY.value),darkness:Number(bgDarkness.value)};applyBackground();syncBackgroundControls();save()}
 bgMode.onchange=updateBackground;bgPreset.onchange=()=>{bgMode.value='preset';updateBackground()};
 bgPosition.oninput=updateBackground;bgPositionY.oninput=updateBackground;bgDarkness.oninput=updateBackground;
 $('vce-bg-file').onchange=async e=>{
  const status=$('vce-editor-status');
  try{await uploadBackground(e.target.files?.[0]);syncBackgroundControls();status.textContent='Arrière-plan chargé et enregistré sur cet appareil.'}
  catch(err){status.textContent=err.message}
  e.target.value='';
 };
 $('vce-bg-remove').onclick=()=>{settings.background={...settings.background,image:'',mode:'default'};applyBackground();syncBackgroundControls();save();$('vce-editor-status').textContent='Arrière-plan personnalisé supprimé.'};
 syncBackgroundControls();
 list.onchange=()=>pick(list.value);
 for(const k of ['x','y','scale','rotation'])$('vce-editor-'+k).oninput=readControls;
 $('vce-editor-text').oninput=()=>{
  if(!target||!selected)return;
  settings.texts[target]=$('vce-editor-text').value.slice(0,240);
  renderItem(target);
 };
 $('vce-editor-reset-text').onclick=()=>{
  if(!target)return;delete settings.texts[target];
  if(target.startsWith('custom-')){locate(target)?.remove();delete settings.items[target];pick(ids()[0][0])}
  else $('vce-editor-status').textContent='Texte par défaut rétabli au prochain rechargement de cet overlay.';
  save();location.reload();
 };
 $('vce-editor-add-text').onclick=()=>{
  let n=1;while(settings.texts['custom-'+n]!==undefined)n++;
  const id='custom-'+n;settings.texts[id]='NOUVEAU TEXTE';
  settings.items[id]={x:0,y:0,scale:1,rotation:0};
  ensureCustomText();refresh();pick(id);save()
 };
 panel.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.theme;apply();save()});
 $('vce-editor-save').onclick=()=>{$('vce-editor-status').textContent=save()?'Brouillon enregistré. Ouvre ?layout=local pour un aperçu propre.':'Stockage local indisponible. Exporte le JSON.'};
 $('vce-editor-export').onclick=download;
 $('vce-editor-reset').onclick=()=>{if(!confirm('Réinitialiser toutes les positions et images locales ?'))return;settings={theme:'blue',items:{},images:{},texts:{},background:{mode:'default',preset:'blue',image:'',position:50,positionY:50,darkness:32}};save();location.reload()};
 $('vce-editor-import').onclick=()=>$('vce-editor-import-file').click();
 $('vce-editor-import-file').onchange=async e=>{
  const f=e.target.files?.[0];if(!f||f.size>5000000)return;
  try{const incoming=JSON.parse(await f.text());if(incoming?.schema!=='vce.overlay-layout.v1'||incoming.overlay!==basename)throw Error('Ce fichier ne correspond pas à cet overlay.');
   settings.theme=incoming.theme==='red'?'red':'blue';settings.items=incoming.items&&typeof incoming.items==='object'?incoming.items:{};
   settings.images=incoming.images&&typeof incoming.images==='object'?incoming.images:{};
   settings.texts=incoming.texts&&typeof incoming.texts==='object'?incoming.texts:{};
   if(incoming.background&&typeof incoming.background==='object')settings.background={...settings.background,...incoming.background};
   apply();syncBackgroundControls();pick(target||ids()[0][0]);save();$('vce-editor-status').textContent='Composition importée.'
  }catch(err){$('vce-editor-status').textContent='Import impossible : '+err.message}
 };
 $('vce-editor-image').onchange=async e=>{
  try{await upload(e.target.files?.[0]);$('vce-editor-status').textContent='Image mise à jour sur cet appareil.'}
  catch(err){$('vce-editor-status').textContent=err.message}
 };
 document.addEventListener('pointerdown',e=>{
  if(panel.contains(e.target))return;
  const el=e.target.closest?.('.vce-graphic-target');if(!el)return;
  const id=el.dataset.vceElement;if(!id)return;
  pick(id);
  const scale=stage().getBoundingClientRect().width/1920||1;
  drag={id,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,scale,x:settings.items[id]?.x||0,y:settings.items[id]?.y||0};
  try{el.setPointerCapture(e.pointerId)}catch{}
  e.preventDefault();e.stopPropagation();
 },true);
 document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  settings.items[drag.id]={...(settings.items[drag.id]||{}),x:Math.round(drag.x+(e.clientX-drag.startX)/drag.scale),y:Math.round(drag.y+(e.clientY-drag.startY)/drag.scale)};
  renderItem(drag.id);pick(drag.id);
 },true);
 document.addEventListener('pointerup',()=>{if(drag){save();drag=null}},true);
 const refresh=()=>{ensureCustomText();
  for(const [id] of ids()){const el=locate(id);if(el){
   if(!el.dataset.vceElement){el.dataset.vceElement=id;el.classList.add('vce-graphic-target')}
   renderItem(id)
  }}
  populate()
 };
 refresh();
 new MutationObserver(()=>{if(!panel.__refresh){panel.__refresh=true;requestAnimationFrame(()=>{panel.__refresh=false;refresh()})}}).observe(stage(),{childList:true,subtree:true});
}
function run(){
 load();apply();marker();
 if(!edit){
  const surface=stage();if(!surface)return;let scheduled=false;
  new MutationObserver(()=>{
   if(scheduled)return;scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;apply()});
  }).observe(surface,{childList:true,subtree:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
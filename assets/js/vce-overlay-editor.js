/* VCE Graphic Layout Editor — local draft, explicit export, no server changes.
   Query ?edit=1 enables dragging/repositioning, theme selection and image uploads.
   ?layout=local displays saved layout without editor controls. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const edit=params.get('edit')==='1',preview=params.get('layout')==='local';
if(!edit&&!preview)return;
const overlays={
 'overlay-lineup.html':[['logo','.vce-official-logo'],['header','.top'],['title','.heading'],['drivers','.drivers'],['footer','.footer']],
 'overlay-resultats.html':[['logo','.vce-official-logo'],['header','.header'],['board','#board'],['footer','.foot']],
 'overlay-calendrier.html':[['logo','#vce-official-logo'],['header','.top'],['title','.title'],['cards','#cards'],['footer','.footer']]
};
const basename=location.pathname.split('/').pop(),groups=overlays[basename];if(!groups)return;
const store='vce-overlay-editor-v1:'+basename;
let settings={theme:'blue',items:{},images:{}},target=null,selected=null,drag=null;
const $=id=>document.getElementById(id);
const finite=(n,min,max,fallback)=>{const x=Number(n);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback};
const stage=()=>document.querySelector('#stage,.stage');
const attr=(el,s)=>el?.setAttribute?.('data-vce-overlay-theme',s);
function load(){
 try{const stored=JSON.parse(localStorage.getItem(store));if(stored&&typeof stored==='object'){
  settings.theme=stored.theme==='red'?'red':'blue';
  if(stored.items&&typeof stored.items==='object')settings.items=stored.items;
  if(stored.images&&typeof stored.images==='object')settings.images=stored.images;
 }}catch{}
}
function ids(){
 const arr=groups.slice();
 if(basename==='overlay-lineup.html')document.querySelectorAll('.drivers .driver').forEach((e,i)=>arr.push(['driver-'+(i+1),'.drivers .driver:nth-child('+(i+1)+')']));
 if(basename==='overlay-resultats.html')document.querySelectorAll('#board .result,#board .group-row,#board .group-driver').forEach((e,i)=>arr.push(['result-'+(i+1),'#board .result:nth-child('+(i+1)+'),#board .group-row:nth-child('+(i+1)+'),#board .group-driver:nth-child('+(i+1)+')']));
 return arr;
}
const locate=id=>document.querySelector(ids().find(x=>x[0]===id)?.[1]||'nosuchtag');
function renderItem(id){
 const el=locate(id);if(!el)return;
 const x=settings.items[id]||{};
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
 for(const [id] of ids())renderItem(id);
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
 '<div class="vce-editor-buttons"><button type="button" data-theme="red">FOND ROUGE</button><button type="button" data-theme="blue">FOND BLEU</button></div>'+
 '<label>Élément à modifier<select id="vce-editor-pick"></select></label>'+
 '<label>Décalage horizontal (px)<input id="vce-editor-x" type="number" step="5" value="0"></label>'+
 '<label>Décalage vertical (px)<input id="vce-editor-y" type="number" step="5" value="0"></label>'+
 '<label>Taille (facteur)<input id="vce-editor-scale" type="range" min=".3" max="2.2" step=".05" value="1"></label>'+
 '<label>Rotation (degrés)<input id="vce-editor-rotation" type="range" min="-40" max="40" step="1" value="0"></label>'+
 '<label>Remplacer la photo / le logo<input id="vce-editor-image" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 '<div class="vce-editor-buttons"><button type="button" id="vce-editor-save">ENREGISTRER</button><button type="button" id="vce-editor-export">EXPORT JSON</button><button type="button" id="vce-editor-import">IMPORT JSON</button><button type="button" id="vce-editor-reset">RÉINITIALISER</button></div>'+
 '<input id="vce-editor-import-file" type="file" accept=".json,application/json" hidden>'+
 '<p class="vce-editor-status" id="vce-editor-status" role="status"></p>';
 document.body.append(panel);
 const list=$('vce-editor-pick');
 function populate(){const old=list.value;list.replaceChildren(...ids().filter(([id])=>locate(id)).map(([id])=>new Option(id.toUpperCase().replaceAll('-',' '),id)));if([...list.options].some(o=>o.value===old))list.value=old;else if(list.options.length)pick(list.options[0].value)}
 populate();
 list.onchange=()=>pick(list.value);
 for(const k of ['x','y','scale','rotation'])$('vce-editor-'+k).oninput=readControls;
 panel.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.theme;apply();save()});
 $('vce-editor-save').onclick=()=>{$('vce-editor-status').textContent=save()?'Brouillon enregistré. Ouvre ?layout=local pour un aperçu propre.':'Stockage local indisponible. Exporte le JSON.'};
 $('vce-editor-export').onclick=download;
 $('vce-editor-reset').onclick=()=>{if(!confirm('Réinitialiser toutes les positions et images locales ?'))return;settings={theme:'blue',items:{},images:{}};save();location.reload()};
 $('vce-editor-import').onclick=()=>$('vce-editor-import-file').click();
 $('vce-editor-import-file').onchange=async e=>{
  const f=e.target.files?.[0];if(!f||f.size>5000000)return;
  try{const incoming=JSON.parse(await f.text());if(incoming?.schema!=='vce.overlay-layout.v1'||incoming.overlay!==basename)throw Error('Ce fichier ne correspond pas à cet overlay.');
   settings.theme=incoming.theme==='red'?'red':'blue';settings.items=incoming.items&&typeof incoming.items==='object'?incoming.items:{};
   settings.images=incoming.images&&typeof incoming.images==='object'?incoming.images:{};
   apply();pick(target||ids()[0][0]);save();$('vce-editor-status').textContent='Composition importée.'
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
 const refresh=()=>{for(const [id] of ids()){const el=locate(id);if(el&&!el.dataset.vceElement){el.dataset.vceElement=id;el.classList.add('vce-graphic-target');renderItem(id)}}populate()};
 refresh();
 new MutationObserver(()=>{if(!panel.__refresh){panel.__refresh=true;requestAnimationFrame(()=>{panel.__refresh=false;refresh()})}}).observe(stage(),{childList:true,subtree:true});
}
function run(){load();apply();marker()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
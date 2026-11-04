/* VCE ESPORT — Export PNG et publication STAFF vers la galerie pilotes. */
(function(){
'use strict';
const kind=document.body.dataset.vceOverlayKind;if(!kind)return;
const $=id=>document.getElementById(id);
const css=document.createElement('style');css.textContent='.vce-publish-panel{margin:20px 0;padding:20px;border:1px solid #385a7a;border-radius:12px;background:#101e31;color:#eaf4ff}.vce-publish-panel h2{margin:0 0 10px;font-size:19px}.vce-publish-panel p{font-size:13px;color:#a9c5df;line-height:1.5}.vce-publish-panel .vce-publish-actions{display:flex;flex-wrap:wrap;gap:10px}.vce-publish-panel button{padding:12px 15px;border:0;border-radius:7px;background:#267bc5;color:white;font-weight:800;cursor:pointer}.vce-publish-panel button:last-child{background:#e52f59}.vce-publish-panel button:disabled{opacity:.55;cursor:wait}.vce-publish-panel .vce-publish-status{font-size:13px;white-space:pre-wrap}';document.head.append(css);
const panel=document.createElement('section');panel.className='vce-publish-panel';panel.innerHTML='<h2>OVERLAY OFFICIEL · PNG FULL HD</h2><p>Exporte l’affiche en PNG 1920 × 1080 ou publie-la dans l’onglet Publications des pilotes. Publication réservée aux comptes STAFF.</p><div class="vce-publish-actions"><button type="button" id="vceExportPng">↓ Exporter PNG</button><button type="button" id="vcePublishPng">↗ Publier aux pilotes</button></div><p class="vce-publish-status" id="vcePublishStatus" role="status"></p>';
const anchor=document.querySelector('.layout')||document.querySelector('main')||document.querySelector('.wrap');if(anchor?.parentNode)anchor.parentNode.insertBefore(panel,anchor.nextSibling);else document.body.append(panel);
const status=$('vcePublishStatus');const msg=s=>status.textContent=s;
const slug=s=>String(s||kind).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').slice(0,55).replace(/^-|-$/g,'')||kind;
function title(){if(kind==='announcement')return $('event')?.value||'Announcement';if(kind==='lineup')return $('competition')?.value||'Line-up';return $('event')?.value||'Résultats';}
function saveLocal(){if(kind==='lineup'){document.getElementById('save')?.click()}else if(kind==='resultats'){document.getElementById('save')?.click()}else if(typeof draw==='function')draw()}
async function pngBlob(){
 if(kind==='announcement'){draw();return new Promise((ok,no)=>$('canvas').toBlob(b=>b?ok(b):no(Error('Capture PNG impossible')),'image/png'))}
 saveLocal();
 const frame=document.querySelector('iframe.preview')||document.getElementById('preview')||document.querySelector('iframe[src*="overlay-"]');
 if(!frame)throw Error('Aperçu overlay introuvable');
 // L’iframe partage l’origine et le stockage local du site.
 const doc=frame.contentDocument;if(!doc)throw Error('Aperçu inaccessible');
 if(kind==='resultats'){frame.src='overlay-resultats.html?export='+Date.now();await new Promise((ok,no)=>{frame.addEventListener('load',ok,{once:true});setTimeout(()=>no(Error('Aperçu trop lent')),12000)})}
 else {frame.contentWindow.location.reload();await new Promise((ok,no)=>{frame.addEventListener('load',ok,{once:true});setTimeout(()=>no(Error('Aperçu trop lent')),12000)})}
 const d=frame.contentDocument,stage=d.querySelector('#stage,.stage');if(!stage)throw Error('Surface graphique introuvable');
 await Promise.all([...d.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.addEventListener('load',r,{once:true});im.addEventListener('error',r,{once:true})})));
 if(d.fonts?.ready)await d.fonts.ready;
 const lib=await loadCapture(d);const old=stage.style.transform,oldOrigin=stage.style.transformOrigin,oldPosition=stage.style.position,oldTop=stage.style.top,oldLeft=stage.style.left;
 try{stage.style.transform='none';stage.style.transformOrigin='top left';stage.style.position='absolute';stage.style.top='0';stage.style.left='0';const canvas=await lib(stage,{backgroundColor:'#070d19',width:1920,height:1080,windowWidth:1920,windowHeight:1080,scale:1,useCORS:true,logging:false});return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('Conversion PNG impossible')),'image/png'))}
 finally{stage.style.transform=old;stage.style.transformOrigin=oldOrigin;stage.style.position=oldPosition;stage.style.top=oldTop;stage.style.left=oldLeft}
}
async function loadCapture(doc){if(doc.defaultView.html2canvas)return doc.defaultView.html2canvas;return new Promise((resolve,reject)=>{const sc=doc.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';sc.onload=()=>resolve(doc.defaultView.html2canvas);sc.onerror=()=>reject(Error('Bibliothèque de capture inaccessible'));doc.head.append(sc)})}
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VCE-'+kind+'-'+slug(title())+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
async function staffSession(){if(!window.VCESupabase?.configured())throw Error('Supabase non configuré');if(!await VCESupabase.isStaff())throw Error('Connexion STAFF requise : ouvre le tableau de bord STAFF et reconnecte-toi.');const sess=VCESupabase.session();if(!sess?.access_token)throw Error('Session STAFF expirée');return sess.access_token}
async function upload(blob,token){const cfg=window.VCE_SUPABASE;const path=kind+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,10)+'.png';const res=await fetch(cfg.url+'/storage/v1/object/vce-overlays/'+path,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+token,'Content-Type':'image/png','x-upsert':'false'},body:blob});if(!res.ok)throw Error('Stockage Supabase : '+res.status+' '+(await res.text()).slice(0,180));return cfg.url+'/storage/v1/object/public/vce-overlays/'+path}
async function publish(){const token=await staffSession();const blob=await pngBlob();if(blob.size>12*1024*1024)throw Error('PNG supérieur à 12 Mo. Réduis les photos.');const url=await upload(blob,token);const gallery=await VCESupabase.read('overlays');const entries=Array.isArray(gallery.items)?gallery.items:[];entries.unshift({id:Date.now()+'-'+kind,kind,title:title().slice(0,120),url,created_at:new Date().toISOString()});await VCESupabase.save('overlays',{version:1,items:entries.slice(0,80)});msg('Publication réussie ! L’affiche apparaît dans Publications sur le dashboard pilote.');}
let busy=false;async function run(fn){if(busy)return;busy=true;for(const b of panel.querySelectorAll('button'))b.disabled=true;msg('Génération PNG Full HD en cours…');try{await fn()}catch(e){msg('Erreur : '+e.message)}finally{busy=false;for(const b of panel.querySelectorAll('button'))b.disabled=false}}
$('vceExportPng').onclick=()=>run(async()=>{download(await pngBlob());msg('PNG téléchargé.');});$('vcePublishPng').onclick=()=>run(publish);
})();
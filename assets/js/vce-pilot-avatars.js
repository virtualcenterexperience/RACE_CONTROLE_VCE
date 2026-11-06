/* VCE PILOTE — public profile photos, private upload authenticated per pilot. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const validId=s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s||'');
const cfg=()=>window.VCE_SUPABASE||{};
let photos=new Map(),panel=null,current='',checking=0,refreshing=false,lastRefresh=0;let staffMode=false;const brokenPhotos=new Set();
const active=()=>{try{return slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''))}catch{return ''}};
const urlFor=entry=>{
 const path=entry?.storage_path;
 if(typeof path!=='string'||!/^([a-z0-9]+(?:-[a-z0-9]+)*)\/[a-zA-Z0-9_-]+\.jpg$/.test(path))return null;
 return cfg().url+'/storage/v1/object/public/vce-pilot-avatars/'+path.split('/').map(encodeURIComponent).join('/')+
 '?v='+encodeURIComponent(entry.updated_at||'1')
};
function showPhoto(node,id,initials){
 if(!node||!id)return;
 const value=photos.get(id),url=urlFor(value);
 if(url&&!brokenPhotos.has(url)){
  if(node.querySelector('img')?.dataset.avatarPath===url)return;
  node.replaceChildren();
  const img=document.createElement('img');
  img.alt='Photo de '+id.replace(/-/g,' ');
  img.loading=node.id==='vce-photo-big'?'eager':'lazy';
  img.decoding='async';img.dataset.avatarPath=url;img.src=url;
  img.addEventListener('error',()=>{brokenPhotos.add(url);if(img.isConnected){node.replaceChildren(document.createTextNode(initials));node.classList.remove('vce-photo-avatar')}},{once:true});
  node.classList.add('vce-photo-avatar');
  node.append(img)
 }else if(node.querySelector('img')){
  node.classList.remove('vce-photo-avatar');node.replaceChildren(document.createTextNode(initials))
 }
}
function rosterIdForCard(card,i){
 const direct=card.dataset.pilotId||card.dataset.pilotFallback;
 if(validId(direct))return direct;
 const list=(window.VCE_PILOT_ROSTER||[]);
 const label=card.querySelector('b,strong,.pilot-name');
 if(!label)return null;
 const full=(label.dataset.vceFullname||label.textContent||'').trim();
 const item=list.find(p=>p.id===slug(full)||p.name.toUpperCase()===full.toUpperCase());
 return item?.id||null
}
function drawSelection(){
 const root=$('pilotGrid');if(!root)return;
 const cards=root.querySelectorAll('.pilot-select');
 for(const [index,card] of [...cards].entries()){
  const id=rosterIdForCard(card,index);if(!validId(id))continue;
  const avatar=card.querySelector('.avatar');
  const name=card.querySelector('b,strong,.pilot-name');
  const initials=(name?.dataset.vceFullname||name?.textContent||id).trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase();
  showPhoto(avatar,id,initials)
 }
}
function drawProfile(){
 const id=active();if(!panel||!id)return;
 const name=$('name')?.textContent||id;
 const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 showPhoto($('vce-photo-big'),id,initials);
}
async function refresh(force=false){
 const c=cfg();if(!/^https:\/\/[^/]+\.supabase\.co$/.test(c.url||'')||!c.key||refreshing)return;
 if(!force&&Date.now()-lastRefresh<12000)return;
 refreshing=true;lastRefresh=Date.now();
 try{
  const res=await fetch(c.url+'/rest/v1/vce_pilot_avatars?select=pilot_slug,storage_path,updated_at',{
   headers:{apikey:c.key},cache:'no-store'
  });
  if(!res.ok)throw Error('Photo HTTP '+res.status);
  const data=await res.json();if(!Array.isArray(data))throw Error('Format des photos invalide');
  photos=new Map(data.filter(r=>validId(r?.pilot_slug)).map(r=>[r.pilot_slug,r]));
  drawSelection();drawProfile()
 }catch(e){console.warn('Photos pilotes : '+e.message)}
 finally{refreshing=false}
}
async function api(action,values={}){
 const c=cfg(),session=await window.VCESupabase?.validSession();
 if(!session?.access_token)throw Error('Connecte-toi avec ton compte pilote.');
 const res=await fetch(c.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',
  headers:{apikey:c.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action,...values})
 });
 const body=await res.json().catch(()=>({error:'Réponse incorrecte'}));
 if(!res.ok||body?.error)throw Error(body.error||'HTTP '+res.status);
 return body
}
async function verifyEdit(){
 const id=active(),request=++checking,button=$('vce-photo-change'),input=$('vce-photo-file');
 if(!button||!input)return;
 button.hidden=true;input.disabled=true;staffMode=false;
 if(!id||!window.VCEPilotAuthCanAccess?.(id))return;
 try{
  const isStaff=await window.VCESupabase?.isStaff();
  if(request!==checking||active()!==id)return;
  if(isStaff){
    staffMode=true;button.hidden=false;input.disabled=false;
    $('vce-photo-status').textContent='STAFF : photo publique de ce pilote. Choisis un portrait avec son accord.';
    return
  }
  const data=await api('pilot_whoami');
  if(request!==checking||active()!==id)return;
  if(data.pilot_slug!==id||data.password_change_required)return;
  button.hidden=false;input.disabled=false;
  $('vce-photo-status').textContent='Ta photo sera visible par tous les visiteurs.'
 }catch{
  if(request===checking)$('vce-photo-status').textContent='Modification réservée au pilote ou au STAFF authentifié.'
 }
}
async function compress(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Utilise une image JPG, PNG ou WebP.');
 if(file.size>8*1024*1024)throw Error('Image trop volumineuse : 8 Mo maximum.');
 const image=await createImageBitmap(file,{imageOrientation:'from-image'});
 try{
  const side=Math.max(1,Math.min(480,image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=side;canvas.height=side;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Traitement image indisponible');
  const crop=Math.min(image.width,image.height);
  ctx.fillStyle='#111827';ctx.fillRect(0,0,side,side);
  ctx.drawImage(image,(image.width-crop)/2,(image.height-crop)/2,crop,crop,0,0,side,side);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Compression impossible')),'image/jpeg',.76));
  if(blob.size>180000)throw Error('Image trop volumineuse après compression : choisis une autre photo.');
  return await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
   reader.onerror=()=>reject(new Error('Lecture image impossible'));
   reader.readAsDataURL(blob)
  })
 }finally{image.close()}
}
async function sendImage(file){
 if(!file)return;const id=active(),button=$('vce-photo-change'),message=$('vce-photo-status');
 button.disabled=true;message.textContent='Préparation et envoi de ta photo…';
 try{
  if(!id||!window.VCEPilotAuthCanAccess?.(id))throw Error('Profil non vérifié');
  const image_base64=await compress(file);
  const result=await api(staffMode?'staff_avatar_save':'pilot_avatar_save',{image_base64,pilot_slug:id});
  if(result.pilot_slug!==id||!result.storage_path)throw Error('La photo enregistrée ne correspond pas au profil');
  photos.set(id,{pilot_slug:id,storage_path:result.storage_path,updated_at:result.updated_at});
  drawSelection();drawProfile();
  message.textContent='✓ Ta nouvelle photo est publiée et visible par tous.';
  window.dispatchEvent(new Event('vce-avatar-updated'));
 }catch(e){message.textContent='Impossible de modifier la photo : '+e.message}
 finally{button.disabled=false;$('vce-photo-file').value=''}
}
function mount(){
 const dashboard=$('pilotDashboard'),hero=dashboard?.querySelector('.hero .row')||dashboard?.querySelector('.hero');
 if(!dashboard||!hero||panel)return;
 panel=document.createElement('div');panel.className='vce-profile-photo-panel';panel.id='vce-photo-panel';
 panel.innerHTML='<div id="vce-photo-big" class="vce-photo-big" aria-label="Photo de profil">VCE</div>'+
 '<div class="vce-photo-actions"><strong>MA PHOTO DE PROFIL</strong>'+
 '<button type="button" id="vce-photo-change" hidden>Changer ma photo</button>'+
 '<input type="file" id="vce-photo-file" accept="image/jpeg,image/png,image/webp" hidden>'+
 '<small class="vce-photo-hint">Portrait public · format carré, 480 px · JPG, PNG ou WebP</small>'+
 '<span id="vce-photo-status" role="status" aria-live="polite"></span></div>';
 hero.append(panel);
 $('vce-photo-change').onclick=()=>$('vce-photo-file').click();
 $('vce-photo-file').addEventListener('change',e=>sendImage(e.target.files?.[0]));
 const root=$('pilotGrid');
 if(root){
  let scheduled=false;
  new MutationObserver(()=>{
   if(scheduled)return;scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;drawSelection()})
  }).observe(root,{childList:true,subtree:true});
 }
 refresh(true);route();
 window.addEventListener('vce-roster-updated',()=>{drawSelection();refresh(true)});
 window.addEventListener('vce-pilot-verified',route);
 window.addEventListener('hashchange',route);
 window.addEventListener('pageshow',()=>refresh(true));
 window.addEventListener('vce-avatar-updated',()=>refresh(true));
 setInterval(()=>{if(!document.hidden)refresh()},30000)
}
function route(){
 ++checking;drawProfile();verifyEdit()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount()
})();
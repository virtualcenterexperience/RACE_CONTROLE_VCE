/* Pilot selection: first names are presentation only. IDs and full names stay unchanged. */
(()=>{'use strict';
function update(){
 const root=document.getElementById('pilotGrid');if(!root)return;
 for(const el of root.querySelectorAll('.pilot-select')){
  const label=el.querySelector('b,strong,.pilot-name');if(!label)continue;
  if(!label.dataset.vceFullname)label.dataset.vceFullname=label.textContent.trim();
  const full=label.dataset.vceFullname;
  const first=full.split(/\s+/).filter(Boolean)[0]||full;
  if(label.textContent!==first)label.textContent=first;
  const avatar=el.querySelector('.avatar');
  if(avatar&&!avatar.querySelector('img')){
   const initial=first.slice(0,1).toUpperCase();
   if(avatar.textContent.trim()!==initial)avatar.textContent=initial;
  }
 }
}
function init(){
 const root=document.getElementById('pilotGrid');if(!root)return;
 let scheduled=false;
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;update()})});
 observer.observe(root,{childList:true,subtree:true,characterData:true});
 update();window.addEventListener('vce-roster-updated',update);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

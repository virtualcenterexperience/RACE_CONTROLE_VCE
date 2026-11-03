/* VCE mode STAFF : verrou d'interface uniquement, PAS une authentification sécurisée.
   Remplacez la valeur ci-dessous par votre code. Il est visible dans les fichiers publics.
   Pour une sécurité réelle et une écriture automatique, il faut un backend authentifié. */
(function(){
 'use strict';
 const PASSWORD='VCE-STAFF-2026'; // CODE DE DEMONSTRATION — À MODIFIER
 const KEY='vce_staff_mode';
 const isStaff=()=>sessionStorage.getItem(KEY)==='yes';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function ui(){
   if(document.getElementById('vceStaffMode'))return;
   const bar=document.createElement('div');bar.id='vceStaffMode';
   bar.style.cssText='position:fixed;bottom:18px;right:18px;z-index:9998;background:#102039;color:white;border:1px solid #426185;border-radius:12px;padding:12px;box-shadow:0 10px 35px #0008;font:14px Arial,sans-serif;max-width:calc(100vw - 36px)';
   const btn=document.createElement('button');btn.textContent=isStaff()?'🔓 Mode STAFF : actif':'🔒 Mode STAFF';btn.style.cssText='background:#ff3155;border:0;border-radius:8px;color:white;padding:11px 15px;cursor:pointer;font-weight:bold';
   const links=document.createElement('div');links.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:9px';
   const render=()=>{
     btn.textContent=isStaff()?'🔓 Mode STAFF : actif':'🔒 Mode STAFF';
     links.replaceChildren();
     if(!isStaff())return;
     [['📅 Calendrier','calendrier-staff.html'],['🏆 Résultats','resultats-staff.html'],['👥 Lineup','lineup-staff.html']].forEach(([label,href])=>{
       const a=document.createElement('a');a.href=href;a.textContent=label;a.style.cssText='color:#fff;background:#1c3555;padding:8px;border-radius:6px;text-decoration:none';links.append(a);
     });
     const leave=document.createElement('button');leave.textContent='Quitter';leave.style.cssText='background:transparent;color:#fff;border:1px solid #58708e;border-radius:6px;padding:8px;cursor:pointer';leave.onclick=()=>{sessionStorage.removeItem(KEY);render();if(document.body.dataset.vceStaffEditor==='yes')location.href='pilote.html'};links.append(leave);
   };
   btn.onclick=()=>{
     if(isStaff()){render();return}
     const code=prompt('Mot de passe STAFF (accès aux boutons d’édition) :');
     if(code===null)return;
     if(code!==PASSWORD){alert('Mot de passe incorrect.');return}
     sessionStorage.setItem(KEY,'yes');render();
   };
   bar.append(btn,links);document.body.append(bar);render();
 }
 document.addEventListener('DOMContentLoaded',()=>{
   ui();
   if(document.body.dataset.vceStaffEditor==='yes'&&!isStaff()){
     const mask=document.createElement('div');mask.id='vceStaffMask';
     mask.style.cssText='position:fixed;inset:0;background:#071020f5;color:white;z-index:9997;display:flex;align-items:center;justify-content:center;text-align:center;font:18px Arial,sans-serif;padding:30px';
     mask.innerHTML='<div><h2>🔒 ÉDITION RÉSERVÉE AU STAFF</h2><p>Activez le mode STAFF en bas à droite pour modifier cette rubrique.</p><p><a href="pilote.html" style="color:#8ac4ff">← Retour aux pilotes</a></p></div>';
     document.body.append(mask);
     const obs=new MutationObserver(()=>{if(isStaff()){mask.remove();obs.disconnect()}});
     obs.observe(document.getElementById('vceStaffMode'),{subtree:true,childList:true,characterData:true});
   }
 });
})();

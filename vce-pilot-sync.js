/* Assignments and notices use Supabase only. Profile statistics have their own controller. */
(()=>{'use strict';
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sequence=0,checkedAt=0;
function selected(){try{return slug(decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||''))}catch{return ''}}
function clear(){sequence++;document.getElementById('assignedList')?.replaceChildren();document.getElementById('vceNotices')?.remove();document.getElementById('vceBell')?.remove()}
async function sync(){
 const request=++sequence,id=selected();
 const p=(window.VCE_PILOT_ROSTER||[]).find(p=>p.id===id||slug(p.name)===id);
 if(!p||!window.VCEPilotAuthCanAccess?.(p.id))return;
 const current=()=>request===sequence&&selected()===id&&window.VCEPilotAuthCanAccess?.(p.id);
 const assigned=document.getElementById('assignedList');
 try{
  checkedAt=Date.now();
  const response=await window.VCESupabase.read('training_assignments');
  if(!Array.isArray(response?.items))throw Error('Liste des attributions non confirmée par Supabase.');
  if(!current())return;
  const my=response.items.filter(a=>a.pilotSlug?a.pilotSlug===p.id:[p.id,slug(p.name)].includes(slug(a.driver||a.pilot)));
  if(assigned)assigned.innerHTML=my.map(a=>`<article class="item"><b>EXERCICE PERSONNEL — COACH IRL</b><p>${esc(a.circuit)} · ${esc(a.car)} · ${esc(a.laps)} tours</p><p>${esc(a.exercise)}</p><a href="coach-irl.html?assignment=${encodeURIComponent(a.id)}&pilot=${encodeURIComponent(p.id)}">CONSULTER LA SÉANCE →</a></article>`).join('')||'<p>Aucun entraînement attribué par le STAFF.</p>';
  const dash=document.getElementById('pilotDashboard');if(!dash)return;
  let block=document.getElementById('vceNotices');if(!block){block=document.createElement('section');block.id='vceNotices';block.className='panel section';dash.append(block)}
  block.innerHTML='<h2>NOTIFICATIONS DU STAFF</h2>'+(my.length?my.slice().reverse().map(a=>`<div class="item">Nouvel entraînement attribué : ${esc(a.exercise)} · <a href="coach-irl.html?assignment=${encodeURIComponent(a.id)}&pilot=${encodeURIComponent(p.id)}">Voir l’entraînement</a></div>`).join(''):'<p>Aucune notification</p>');
  let bell=document.getElementById('vceBell');if(!bell){bell=document.createElement('button');bell.type='button';bell.id='vceBell';bell.className='vce-notify-bell';(dash.querySelector('.actions')||dash).prepend(bell)}
  const key='vce_read_'+p.id;let seen=[];
  try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data))seen=data}catch{}
  const unread=my.filter(a=>!seen.includes(a.id));
  bell.textContent='🔔';bell.classList.toggle('has-new',unread.length>0);bell.setAttribute('data-count',unread.length>99?'99+':String(unread.length));bell.setAttribute('aria-label',unread.length+' notifications non lues');
  bell.onclick=()=>{if(!current())return;if(!document.documentElement.classList.contains('vce-pilot-spectator')){try{localStorage.setItem(key,JSON.stringify(my.map(a=>a.id)))}catch{}bell.classList.remove('has-new');bell.setAttribute('data-count','0');bell.setAttribute('aria-label','0 notifications non lues')}block.scrollIntoView({behavior:'smooth'})};
 }catch(error){if(current()&&assigned){assigned.textContent='Attributions non synchronisées : '+error.message+' Utilise Actualiser pour réessayer.';document.getElementById('vceNotices')?.replaceChildren();document.getElementById('vceBell')?.remove()}}
}
function start(){if(!location.pathname.endsWith('pilote.html'))return;
 for(const event of ['vce-pilot-verified','vce-roster-updated','vce-pilot-manual-refresh','vce-training-updated'])window.addEventListener(event,sync);
 window.addEventListener('storage',event=>{if(event.key==='vce_training_updated_at')sync()});
 window.addEventListener('hashchange',clear);window.addEventListener('vce-auth-session-ended',clear);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-checkedAt>=120_000)sync()});
 setInterval(()=>{if(!document.hidden)sync()},120_000);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

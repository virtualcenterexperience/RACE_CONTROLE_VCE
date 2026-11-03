
const ROOT='data/vce/';
const read=async(name,fallback)=>{try{let r=await fetch(ROOT+name+'.json?'+Date.now(),{cache:'no-store'});return r.ok?await r.json():fallback}catch{return fallback}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const dl=(name,data)=>{let a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
const date=()=>new Date().toISOString().slice(0,10);
const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
let state={pilotes:[],attributions:[],seances:[],notifications:[]};
async function load(){for(let k of Object.keys(state))state[k]=await read(k,[]);return state}
function flash(msg){document.querySelector('#flash').textContent=msg}
function panel(name){document.querySelectorAll('[data-page]').forEach(e=>e.hidden=e.dataset.page!==name);document.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===name));}
function choose(){return state.pilotes.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
function render(){
 const $=x=>document.getElementById(x);
 $('pilotSelect').innerHTML=choose();$('validationPilot').innerHTML=choose();
 $('roster').innerHTML=state.pilotes.map(p=>`<div class="entry"><b>${esc(p.name)}</b> <small>${esc(p.id)}</small> <button data-remove-pilot="${esc(p.id)}">Retirer</button></div>`).join('')||'Aucun pilote';
 $('assigned').innerHTML=state.attributions.map(a=>`<div class="entry"><b>${esc(a.driver)}</b> · ${esc(a.exercise)} <small>${esc(a.circuit)} · ${esc(a.status||'assigned')}</small><button data-remove-assign="${esc(a.id)}">Supprimer</button></div>`).join('')||'Aucune attribution';
 $('sessions').innerHTML=state.seances.map(s=>`<div class="entry"><b>${esc(s.pilot)}</b> · ${esc(s.mode)} · ${esc(s.date)} <small>${esc(s.laps)} tours · ${esc(s.status||'submitted')}</small><button data-validate="${esc(s.id)}">Valider</button><button data-delete-session="${esc(s.id)}">Supprimer</button></div>`).join('')||'Aucune séance dans le JSON partagé';
}
function notify(pilot,assignment){state.notifications.push({id:id(),pilot,assignment,text:'Vous avez reçu un entraînement',createdAt:new Date().toISOString()})}
function exportChanges(){for(const k of Object.keys(state))dl(k,state[k]);flash('4 JSON téléchargés. Publie-les dans data/vce/ sur GitHub pour synchroniser les pilotes.')}
document.addEventListener('DOMContentLoaded',async()=>{
 await load();render();
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>panel(b.dataset.tab));
 document.getElementById('addPilot').onsubmit=e=>{e.preventDefault();let n=e.target.elements.name.value.trim();if(!n)return;let pid=slug(n);if(state.pilotes.some(p=>p.id===pid))return flash('Pilote déjà présent');state.pilotes.push({id:pid,name:n});e.target.reset();render();flash('Pilote ajouté au brouillon. Exporter pour publier.')};
 document.getElementById('assignForm').onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));let p=state.pilotes.find(p=>p.id===d.pilot);if(!p)return;let assignment={id:id(),pilot:p.id,driver:p.name,mode:'coach-irl',status:'assigned',createdAt:new Date().toISOString(),...d};state.attributions.push(assignment);notify(p.id,assignment.id);e.target.reset();render();flash('Attribution et notification créées. Exporter les JSON pour les rendre visibles.')};
 document.getElementById('export').onclick=exportChanges;
 document.body.onclick=e=>{
  let b=e.target.closest('[data-remove-pilot],[data-remove-assign],[data-validate],[data-delete-session]');if(!b)return;
  if(b.dataset.removePilot){if(!confirm('Retirer le profil ? Les historiques sont conservés.'))return;state.pilotes=state.pilotes.filter(p=>p.id!==b.dataset.removePilot)}
  if(b.dataset.removeAssign){if(!confirm('Supprimer cette attribution ?'))return;state.attributions=state.attributions.filter(a=>a.id!==b.dataset.removeAssign)}
  if(b.dataset.validate){let s=state.seances.find(s=>s.id===b.dataset.validate);if(s)s.status='approved'}
  if(b.dataset.deleteSession){if(!confirm('Supprimer cette séance de l’historique ?'))return;state.seances=state.seances.filter(s=>s.id!==b.dataset.deleteSession)}
  render();flash('Modification en attente de publication. Cliquer Exporter.')
 };
 document.querySelectorAll('[data-tab]')[0].click();
});

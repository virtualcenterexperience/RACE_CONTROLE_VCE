(function(){
'use strict';
const cfg=window.VCE_GITHUB||{};
const kinds=['calendrier','lineup','resultats'];
const names={calendrier:'Calendrier',lineup:'Lineup',resultats:'Résultats'};
const keys={calendrier:'vce_calendar_v1',lineup:'vce_lineup_v1',resultats:'vce_resultats_v2'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>{if(!s)return 'Date à confirmer';const x=String(s).split('-');return x.length===3?`${x[2]}/${x[1]}/${x[0]}`:s};
const path=k=>(cfg.directory||'data/team').replace(/^\/+|\/+$/g,'')+'/'+k+'.json';
const configured=()=>!!(cfg.owner&&cfg.repo&&cfg.branch);
function local(k){try{return JSON.parse(localStorage.getItem(keys[k]))}catch{return null}}
async function read(k){if(!configured())throw Error('Configure vce-github-config.js (owner/repo).');const url='./'+path(k)+'?v='+Date.now();const r=await fetch(url,{cache:'no-store'});if(r.status===404)return null;if(!r.ok)throw Error('Lecture GitHub Pages : HTTP '+r.status);return r.json()}
 function render(kind,d){if(!d)return '<div class="empty">Aucune publication pour le moment.</div>';
 if(kind==='calendrier')return `<h2>${escape(d.name||'Championnat')} · ${escape(d.season||'')}</h2><p>${escape(d.cars||'')}</p>`+(d.rounds||[]).map((r,i)=>`<article class="vce-item"><b>🏁 MANCHE ${i+1} · ${escape(r.circuit)}</b><span>📅 ${date(r.date)} ${r.country?'· 🌍 '+escape(r.country):''}</span><small>${escape(r.cars||d.cars||'')}</small></article>`).join('')||'<div class="empty">Aucune manche.</div>';
 if(kind==='lineup')return `<h2>${escape(d.competition||'Lineup')}</h2><p>🏁 ${escape(d.circuit||'')} · 📅 ${date(d.date)} · 🏎️ ${escape(d.voiture||'')}</p>`+(d.pilotes||[]).map((p,i)=>`<article class="vce-item"><b><em>${String(i+1).padStart(2,'0')}</em> ${escape(typeof p==='string'?p:p.name)}</b></article>`).join('')||'<div class="empty">Aucun pilote.</div>';
 return `<h2>${escape(d.event||'Résultats')} · ${escape(d.season||'')}</h2><p>🏁 ${escape(d.circuit||'')} · 📅 ${date(d.date)}</p>`+[...(d.results||[])].sort((a,b)=>(+a.position||999)-(+b.position||999)).map(r=>{const full=[r.firstName,r.lastName].filter(Boolean).join(' ');const drivers=(r.drivers||[]).filter(n=>n&&n.toLowerCase()!==full.toLowerCase());return `<article class="vce-item"><b><em>${+r.position===1?'🥇':+r.position===2?'🥈':+r.position===3?'🥉':'P'+escape(r.position||'?')}</em> ${escape(full||'Pilote non renseigné')}</b><span>👥 ${escape(r.team||'Équipe non renseignée')}</span>${drivers.length?'<small>Équipage : '+drivers.map(escape).join(' · ')+'</small>':''}<small>${escape(r.brand||r.car||'')} ${r.score?'· '+escape(r.score):''} · 📅 ${date(r.resultDate||d.date)}</small></article>`}).join('')||'<div class="empty">Aucun résultat.</div>';
 }

const presetPath=k=>path(k).replace(/\.json$/,'-presets.json');
const fresh=()=>({version:1,updatedAt:null,presets:Array.from({length:5},(_,i)=>({id:i+1,title:'Preset '+(i+1),published:false,data:null}))});
function normalize(x){const d=fresh();if(x&&Array.isArray(x.presets)){for(let i=0;i<5;i++){const q=x.presets.find(q=>Number(q.id)===i+1)||x.presets[i];if(q)d.presets[i]={id:i+1,title:String(q.title||'Preset '+(i+1)).slice(0,100),published:!!q.published,data:q.data||null}}}return d}
async function readPresets(k){const r=await fetch('./'+presetPath(k)+'?v='+Date.now(),{cache:'no-store'});if(r.status===404)return fresh();if(!r.ok)throw Error('Lecture des presets impossible (HTTP '+r.status+')');return normalize(await r.json())}
function editor(k,getData){const area=document.createElement('section');area.className='vce-presets';area.style.cssText='max-width:1180px;margin:24px auto;padding:24px;border-radius:16px;background:#101d31;border:1px solid #355578;color:#fff;font:15px system-ui';area.innerHTML=`<h2>📂 5 PRESETS — ${names[k].toUpperCase()}</h2><p style="color:#a8c6eb">Sélectionne un emplacement, modifie les champs dans le formulaire STAFF, puis exporte le JSON et publie-le sur GitHub. Le nom et les textes du preset seront visibles par les pilotes.</p><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label>Preset<br><select class="ps-slot" style="padding:12px;background:#081527;color:white;border:1px solid #476182;border-radius:8px"></select></label><label>Nom du preset<br><input class="ps-title" maxlength="100" style="padding:12px;background:#081527;color:white;border:1px solid #476182;border-radius:8px" placeholder="Nom affiché aux pilotes"></label><button class="ps-load" type="button">📥 Charger dans le formulaire</button></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="ps-publish" type="button">⬇ Exporter le JSON (sans token)</button><button class="ps-hide" type="button" style="background:#9b2943">Masquer puis exporter</button></div><p class="ps-status" role="status" style="color:#9dc7ff"></p>`;
(document.querySelector('.wrap')||document.querySelector('main')||document.body).append(area);
const $=s=>area.querySelector(s),sel=$('.ps-slot'),title=$('.ps-title'),status=$('.ps-status');let db=fresh();let busy=false;
function fill(){sel.innerHTML='';db.presets.forEach((q,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+' — '+q.title+(q.published?' 🟢':' ⚪');sel.append(o)});select()}
function select(){title.value=db.presets[+sel.value]?.title||''}sel.onchange=select;
async function refresh(){try{db=await readPresets(k);fill();status.textContent='✅ Presets chargés depuis GitHub.'}catch(e){fill();status.textContent='⚠️ '+e.message}};
$('.ps-load').onclick=()=>{const q=db.presets[+sel.value];if(!q?.data){status.textContent='Ce preset ne contient pas encore de données.';return}if(!confirm('Charger ce preset dans le formulaire ? Les modifications locales non enregistrées seront remplacées.'))return;localStorage.setItem(keys[k],JSON.stringify(q.data));sessionStorage.setItem('vce-selected-preset-'+k,String(q.id));location.reload()};
const previous=sessionStorage.getItem('vce-selected-preset-'+k);refresh().then(()=>{if(previous){sel.value=String(Math.max(0,Math.min(4,Number(previous)-1)));select();sessionStorage.removeItem('vce-selected-preset-'+k)}});
async function update(hide){
 if(busy)return;busy=true;
 try{
  db=await readPresets(k);const i=+sel.value,q=db.presets[i];
  q.title=title.value.trim()||'Preset '+(i+1);
  if(hide)q.published=false;else{q.data=getData();q.published=true}
  db.updatedAt=new Date().toISOString();
  const blob=new Blob([JSON.stringify(db,null,2)+'\\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=k+'-presets.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  status.textContent='JSON exporté. Publie data/team/'+k+'-presets.json sur GitHub pour rendre la modification visible aux pilotes.';
  fill();sel.value=String(i);select();
 }catch(e){status.textContent='Erreur : '+e.message}finally{busy=false}
}
$('.ps-publish').onclick=()=>update(false);$('.ps-hide').onclick=()=>update(true);
}
async function viewer(k){const host=document.getElementById('vce-live-content'),state=document.getElementById('vce-live-state');if(!host)return;const section=host.parentElement;const menu=document.createElement('div');menu.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:16px 0';section.insertBefore(menu,host);let selected=1;
async function reload(){try{const db=await readPresets(k);const available=db.presets.filter(q=>q.published&&q.data);menu.replaceChildren();if(!available.length){host.innerHTML='<p>📭 Aucun preset publié par le STAFF pour le moment.</p>';state.textContent='En attente de publication.';return}if(!available.some(q=>q.id===selected))selected=available[0].id;available.forEach(q=>{const b=document.createElement('button');b.textContent='📁 '+q.title;b.style.cssText='padding:12px;border-radius:9px;border:1px solid #3380c1;background:'+(q.id===selected?'#1779c9':'#102640')+';color:white;cursor:pointer';b.onclick=()=>{selected=q.id;reload()};menu.append(b)});const q=available.find(q=>q.id===selected);host.innerHTML='<h2>📌 '+escape(q.title)+'</h2>'+render(k,q.data);state.textContent='🌐 Données publiées par le STAFF · actualisation toutes les 60 secondes';if(k==='calendrier'){const f=document.createElement('iframe');f.title='Calendrier graphique VCE';f.style.cssText='width:100%;aspect-ratio:16/9;border:1px solid #385775;border-radius:12px;margin:16px 0;background:#070f1c';f.src='overlay-calendrier.html';host.prepend(f);f.addEventListener('load',()=>f.contentWindow.postMessage({type:'VCE_CALENDAR_PRESET',data:q.data},location.origin))}}
catch(e){state.textContent='⚠️ '+e.message;host.innerHTML='<p>Impossible de charger les presets.</p>'}}
await reload();setInterval(()=>{if(!document.hidden)reload()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload()})}
function staff(k,getData){editor(k,getData)}

window.VCEGitHub={viewer,staff,read};
})();

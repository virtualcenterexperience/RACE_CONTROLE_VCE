
(function(){
const root='data/vce/',get=async name=>{try{let r=await fetch(root+name+'.json?'+Date.now(),{cache:'no-store'});return r.ok?await r.json():[]}catch{return []}};
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function resultsFor(p){
 let all=[];if(window.VCESupabase?.configured()){try{const d=await window.VCESupabase.read('resultats');const groups=(d.presets||[]).filter(x=>x.published&&x.data).map(x=>x.data);for(const g of groups)for(const x of (g.results||[])){const names=[(x.firstName||'')+' '+(x.lastName||''),x.pilot||'',...(Array.isArray(x.drivers)?x.drivers:[])];if(names.some(n=>slug(n)===p.id||slug(n)===slug(p.name)))all.push({...x,event:g.event||g.title||'Course',date:x.resultDate||g.date||''})}}catch(e){console.warn('Résultats Supabase',e)}return [...new Map(all.map(r=>[[r.event,r.date,r.position,r.firstName,r.lastName].join('|'),r])).values()]}for(const file of ['resultats-presets.json','resultats.json']){
  try{const r=await fetch('data/team/'+file+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)continue;const d=await r.json();
  const groups=Array.isArray(d.presets)?d.presets.filter(x=>x.published&&x.data).map(x=>x.data):[d];
  for(const g of groups)for(const x of (g.results||[])){
   const names=[(x.firstName||'')+' '+(x.lastName||''),x.pilot||'',...(Array.isArray(x.drivers)?x.drivers:[])];
   if(names.some(n=>slug(n)===p.id))all.push({...x,event:g.event||g.title||'Course',date:x.resultDate||g.date||''});
  }
  if(all.length)break;
 }catch(e){console.warn('Résultats TEAM',e)}
 }
 const unique=new Map(all.map(r=>[[r.event,r.date,r.position,r.firstName,r.lastName].join('|'),r]));return [...unique.values()];
}
function ratingRace(r){
 const st=String(r.status||r.statut||'').toUpperCase();
 if(st.includes('DNF')||st.includes('ABANDON'))return -25;
 const pos=Number(r.position);if(!pos)return 0;
 return pos===1?100:pos<=3?80:pos<=8?25:pos<=12?10:pos<=18?-10:-25;
}
async function sync(){
 const [pilotes,attributions,notifications,seances]=await Promise.all(['pilotes','attributions','notifications','seances'].map(get));
 const name=decodeURIComponent(location.hash.slice(1)||new URLSearchParams(location.search).get('pilot')||'');
 const p=pilotes.find(p=>p.id===slug(name)||slug(p.name)===slug(name));
 if(!p)return;
 let remote=[];try{if(window.VCESupabase?.configured()){const d=await VCESupabase.read('training_assignments');remote=Array.isArray(d.items)?d.items:[]}}catch(e){console.warn('Attributions Supabase indisponibles',e)}const remoteMine=remote.filter(a=>slug(a.driver||a.pilot)===p.id||slug(a.driver||a.pilot)===slug(p.name));const my=[...attributions.filter(a=>a.pilot===p.id),...remoteMine.map(a=>({...a,source:'supabase'}))],myN=[...notifications.filter(n=>n.pilot===p.id),...remoteMine.map(a=>({id:a.id,text:'Nouvel entraînement attribué par le coach : '+a.exercise,assignment:a.id,source:'supabase'}))],myS=seances.filter(s=>s.pilot===p.id);
 let assigned=document.getElementById('assignedList');if(assigned){assigned.innerHTML=my.map(a=>`<div class="item"><b>EXERCICE PERSONNEL — COACH IRL</b><p>${esc(a.circuit)} · ${esc(a.car)} · ${esc(a.laps)} tours</p><p>${esc(a.exercise)}</p><a href="coach-irl.html?assignment=${encodeURIComponent(a.id)}&pilot=${encodeURIComponent(p.name)}">CONSULTER LA SÉANCE →</a></div>`).join('')||'<p>Aucun entraînement attribué par le STAFF.</p>'}
 let dash=document.getElementById('pilotDashboard');if(!dash)return;
 let bell=document.getElementById('vceBell');if(!bell){bell=document.createElement('button');bell.id='vceBell';bell.className='btn';(dash.querySelector('.actions')||dash).prepend(bell)}
 const key='vce_read_'+p.id,seen=JSON.parse(localStorage.getItem(key)||'[]'),unread=myN.filter(n=>!seen.includes(n.id));
 bell.textContent='🔔 '+unread.length;bell.onclick=()=>{localStorage.setItem(key,JSON.stringify(myN.map(n=>n.id)));bell.textContent='🔔 0';document.getElementById('vceNotices').scrollIntoView({behavior:'smooth'})};
 let block=document.getElementById('vceNotices');if(!block){block=document.createElement('section');block.id='vceNotices';block.className='panel section';dash.append(block)}
 block.innerHTML='<h2>NOTIFICATIONS</h2>'+ (myN.length?myN.slice().reverse().map(n=>`<div class="item">${esc(n.text)} · <a href="coach-irl.html?assignment=${encodeURIComponent(n.assignment)}&pilot=${encodeURIComponent(p.name)}">Voir l’entraînement</a></div>`).join(''):'<p>Aucune notification</p>');
 const races=await resultsFor(p);
 let race=document.getElementById('vceRace');if(!race){race=document.createElement('section');race.id='vceRace';race.className='panel section';dash.append(race)}
 const positions=races.map(r=>Number(r.position)),top20=positions.filter(n=>n>=1&&n<=20).length,top5=positions.filter(n=>n>=1&&n<=5).length,podium=positions.filter(n=>n>=1&&n<=3).length,safety=races.reduce((n,r)=>n+ratingRace(r),0);
 race.innerHTML='<h2>MES RÉSULTATS TEAM</h2><p>'+races.length+' courses · '+top20+' TOP 20 · '+top5+' TOP 5 · '+podium+' podiums · '+safety+' R course</p>'+races.slice(0,12).map(r=>'<div class="item">'+esc(r.event)+' · P'+esc(r.position)+' · '+(ratingRace(r)>=0?'+':'')+ratingRace(r)+' R</div>').join('');
 let hist=document.getElementById('vceHistory');if(!hist){hist=document.createElement('section');hist.id='vceHistory';hist.className='panel section';dash.append(hist)}
 hist.innerHTML='<h2>HISTORIQUE PERSONNEL DES SÉANCES</h2>'+(myS.length?myS.slice().reverse().map(s=>`<div class="item">${esc(s.date)} · ${esc(s.mode)} · ${esc(s.circuit)} · ${esc(s.laps)} tours · ${esc(s.status)}</div>`).join(''):'<p>Aucune séance publiée.</p>');
}
async function coach(){
 if(!location.pathname.endsWith('coach-irl.html'))return;
 const q=new URLSearchParams(location.search),a=q.get('assignment'),pilot=q.get('pilot');if(!a)return;
 const assignments=await get('attributions');try{if(window.VCESupabase?.configured()){const d=await VCESupabase.read('training_assignments');assignments.push(...(Array.isArray(d.items)?d.items:[]))}}catch(e){console.warn('Attribution Supabase indisponible',e)}const row=assignments.find(x=>x.id===a&&slug(x.driver)===slug(pilot));const main=document.querySelector('main')||document.body;
 const div=document.createElement('section');div.style.cssText='padding:20px;background:#13243a;color:white;border:1px solid #365273;border-radius:10px;margin:20px 0';
 if(row){div.innerHTML=`<h2>EXERCICE COACH IRL ATTRIBUÉ PAR LE STAFF</h2><p>${esc(row.driver)}</p><p>${esc(row.circuit)} · ${esc(row.car)} · ${esc(row.laps)} tours</p><p>${esc(row.exercise)}</p><p>${esc(row.message)}</p><p>Chrono cible : ${esc(row.target||'Libre')}</p>`;const error=main.querySelector('.notice,.error');if(error&&error.textContent.includes('introuvable'))error.style.display='none'}
 else div.textContent='Exercice non publié dans data/vce/attributions.json ou pilote incorrect.';
 main.append(div);
}
document.addEventListener('DOMContentLoaded',()=>{if(location.pathname.endsWith('pilote.html')){sync();window.addEventListener('hashchange',sync);setInterval(()=>{if(!document.hidden)sync()},10000)}coach()});
})();

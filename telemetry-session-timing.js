/* Same-session scoring only. No opponent inputs inferred from lap times. */
(()=>{'use strict';
const $=id=>document.getElementById(id);const snapshots=new Map();let key='';
const panel=document.createElement('section');panel.className='panel';panel.id='vce-session-timing';
const h=document.createElement('h2');h.textContent='PILOTES DE LA SESSION · CHRONOS';
const note=document.createElement('p');note.className='muted';note.textContent='Classement transmis par le jeu. Les chronos permettent la comparaison ; les inputs et trajectoires des adversaires nécessitent leurs propres données autorisées.';
const controls=document.createElement('div');controls.style.cssText='display:flex;gap:12px;flex-wrap:wrap';
for(const [id,label] of [['vce-timing-a','Pilote A'],['vce-timing-b','Pilote B']]){
 const box=document.createElement('label');box.textContent=label+' ';const select=document.createElement('select');select.id=id;select.style.maxWidth='100%';select.onchange=compare;box.append(select);controls.append(box);
}
const result=document.createElement('p');result.id='vce-session-timing-delta';result.setAttribute('aria-live','polite');
const wrap=document.createElement('div');wrap.style.overflowX='auto';const table=document.createElement('table');table.style.width='100%';table.innerHTML='<thead><tr><th>Pos.</th><th>Pilote</th><th>Catégorie</th><th>Meilleur</th><th>Dernier</th></tr></thead><tbody></tbody>';wrap.append(table);
panel.append(h,note,controls,result,wrap);($('tt-sessions')||$('vce-stream'))?.after(panel);
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const fmt=n=>valid(n)?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
let rows=[];
function compare(){
 const a=rows.find(r=>String(r.id)===$('vce-timing-a').value),b=rows.find(r=>String(r.id)===$('vce-timing-b').value);
 const delta=(x,y)=>valid(x)&&valid(y)?((x-y>=0?'+':'')+(x-y).toFixed(3)+' s'):'indisponible';
 result.textContent=a&&b?'A − B · meilleur : '+delta(a.best_lap_s,b.best_lap_s)+' · dernier : '+delta(a.last_lap_s,b.last_lap_s):'Aucun classement reçu pour cette session. Disponible avec VCE 3.9.2 sur LMU ou une archive contenant le classement.';
}
function render(){
 const session=window.vceSession;rows=(snapshots.get(session?.id)||session?.participants||[]).slice(0,104);
 const next=String(session?.id)+JSON.stringify(rows);if(key===next)return;key=next;
 rows.sort((a,b)=>(a.position||999)-(b.position||999));
 for(const id of ['vce-timing-a','vce-timing-b']){
  const select=$(id),previous=select.value;select.replaceChildren(...rows.map(r=>new Option(r.name+' · '+(r.class||r.car||''),String(r.id))));
  const fallback=id==='vce-timing-a'?(rows.find(r=>r.is_player)||rows[0]):(rows.find(r=>!r.is_player)||rows[0]);
  if(rows.some(r=>String(r.id)===previous))select.value=previous;else if(fallback)select.value=String(fallback.id);
 }
 const body=table.querySelector('tbody');body.replaceChildren();
 for(const row of rows){const tr=document.createElement('tr');for(const value of [row.position??'—',row.name+(row.is_player?' · TOI':''),row.class||'—',fmt(row.best_lap_s),fmt(row.last_lap_s)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}body.append(tr)}
 compare();
}
document.addEventListener('vce-live-frame',e=>{const frame=e.detail||{};if(frame.session_id===window.vceSession?.id&&frame.participants?.length){snapshots.set(frame.session_id,frame.participants);if(snapshots.size>12)snapshots.delete(snapshots.keys().next().value);render()}});
document.addEventListener('vce-cloud-update',render);$('session')?.addEventListener('change',()=>setTimeout(render,0));render();
})();

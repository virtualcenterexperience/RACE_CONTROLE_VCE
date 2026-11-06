/* VCE SESSION RECAP: completed laps, interactive scrub and comparable telemetry */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const has=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=n=>has(n)&&n>0?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
const html=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
let active=false,source=null,mouse=50;
function renderRow(parent,label,value){
 const item=html('article','vce-recap-metric');item.append(html('small','',label),html('strong','',value));parent.append(item);
}
function closest(lap,progress){
 const items=(lap?.samples||[]).filter(x=>has(x.lap_pos));
 if(!items.length)return null;
 return items.reduce((a,b)=>!a||Math.abs(b.lap_pos-progress)<Math.abs(a.lap_pos-progress)?b:a,null);
}
function state(){
 const s=window.vceSession,body=$('vce-recap');
 if(!body)return;
 if(!s){
  $('vce-recap-state').textContent='EN ATTENTE DE SESSION';body.hidden=true;return;
 }
 const saved=(s.laps||[]).filter(l=>l.valid!==false&&Array.isArray(l.samples)&&l.samples.length);
 const timed=saved.filter(l=>has(l.time)&&l.time>0);
 body.hidden=false;
 $('vce-recap-state').textContent=s.status==='in_progress'?'SESSION EN COURS · BILAN PROVISOIRE':'SESSION TERMINÉE · RÉCAPITULATIF';
 const cards=$('vce-recap-metrics');cards.replaceChildren();
 const best=timed.length?Math.min(...timed.map(l=>l.time)):null;
 const avg=timed.length?timed.reduce((n,l)=>n+l.time,0)/timed.length:null;
 const sigma=timed.length>1?Math.sqrt(timed.reduce((n,l)=>n+(l.time-avg)**2,0)/timed.length):null;
 const speeds=saved.flatMap(l=>(l.samples||[]).map(x=>x.speed).filter(has));
 renderRow(cards,'TOURS ENREGISTRÉS',String(saved.length));
 renderRow(cards,'MEILLEUR TOUR',fmt(best));
 renderRow(cards,'MOYENNE',fmt(avg));
 renderRow(cards,'ÉCART-TYPE',has(sigma)?sigma.toFixed(3)+' s':'—');
 renderRow(cards,'VITESSE MAX',speeds.length?Math.max(...speeds).toFixed(1)+' km/h':'—');
 renderRow(cards,'CIRCUIT',s.track||'—');
 const rows=$('vce-recap-rows');rows.replaceChildren();
 for(const [i,l] of saved.entries()){
  const tr=html('tr');
  for(const cell of [String(l.number??i+1),fmt(l.time),
   (l.samples||[]).map(x=>x.speed).filter(has).reduce((a,b)=>Math.max(a,b),0).toFixed(1)+' km/h',
   String(l.samples?.length||0)]){
     const td=html('td','',cell);tr.append(td);
  }
  const act=html('td');const b=html('button','', 'ANALYSER');
  b.onclick=()=>{const selectable=(s.laps||[]).filter(l=>l.valid!==false&&
   ((has(l.time)&&l.time>0)||(Array.isArray(l.samples)&&l.samples.length>=10)));
   const ix=selectable.indexOf(l);if(ix<0)return;
   $('lap').value=String(ix);$('lap').dispatchEvent(new Event('change'));document.getElementById('tt-curves')?.scrollIntoView({behavior:'smooth'})};
  act.append(b);tr.append(act);rows.append(tr);
 }
 updateScrub();
}
function updateScrub(){
 const s=window.vceSession;if(!s)return;
 const valid=(s.laps||[]).filter(l=>l.valid!==false&&((has(l.time)&&l.time>0)||(l.samples||[]).length>=10));
 const selected=valid[Number($('lap')?.value||0)];
 const ext=window.VCEexternalReferenceLap;
 const compare=$('reference')?.value==='external'&&ext?.baseId===s.id?ext.lap:valid[Number($('reference')?.value||0)];
 const progress=mouse/100;
 const a=closest(selected,progress),b=closest(compare,progress);
 const list=$('vce-recap-scrub-values');if(!list)return;
 list.replaceChildren();
 const append=(label,x,y,unit='',transform=z=>z)=>{
   const cell=html('article','vce-recap-scrub-stat');
   const av=has(x)?transform(x).toFixed(1)+unit:'—';
   const bv=has(y)?transform(y).toFixed(1)+unit:'—';
   cell.append(html('small','',label),html('strong','',av+' / '+bv));list.append(cell);
 };
 append('VITESSE',a?.speed,b?.speed,' km/h');
 append('FREIN',a?.brake,b?.brake,' %');
 append('ACCÉLÉRATEUR',a?.throttle,b?.throttle,' %');
 append('VOLANT',a?.steering,b?.steering,'');
 $('vce-recap-scrub-progress').textContent=mouse+' % du circuit';
}
function create(){
 const root=document.querySelector('#tt-history')||document.querySelector('main');
 if(!root)return;
 const section=html('section','panel vce-recap');section.id='vce-recap';
 const head=html('div','head');head.append(html('h2','','RÉCAPITULATIF DE SESSION ET COMPARATEUR'),
 html('span','','EN ATTENTE DE SESSION'));head.lastChild.id='vce-recap-state';section.append(head);
 const cards=html('div','vce-recap-metrics');cards.id='vce-recap-metrics';section.append(cards);
 const scroll=html('div','vce-recap-scroll');
 const table=html('table','vce-recap-table');table.innerHTML='<thead><tr><th>TOUR</th><th>CHRONO</th><th>VITESSE MAX</th><th>ÉCHANTILLONS</th><th>ACTION</th></tr></thead><tbody id="vce-recap-rows"></tbody>';
 scroll.append(table);section.append(scroll);
 const title=html('h3','', 'EXPLORER LE TOUR · TOI VS RÉFÉRENCE');
 section.append(title);
 const slider=html('input');slider.type='range';slider.id='vce-recap-slider';slider.min='0';slider.max='100';slider.step='1';slider.value='50';
 slider.oninput=()=>{mouse=Number(slider.value);updateScrub()};section.append(slider);
 const meter=html('strong','', '50 % du circuit');meter.id='vce-recap-scrub-progress';section.append(meter);
 const vals=html('div','vce-recap-scrub-values');vals.id='vce-recap-scrub-values';section.append(vals);
 root.after(section);
 document.addEventListener('vce-cloud-update',state);
 for(const id of ['session','lap','reference'])$(id)?.addEventListener('change',()=>setTimeout(state,0));
 state();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create);else create();
})();
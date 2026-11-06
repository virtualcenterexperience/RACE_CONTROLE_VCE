/* VCE Tour Studio — visual controls only, preserves telemetry sources and IDs */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const fmt=v=>Number.isFinite(v)?v.toFixed(1):'—';
function init(){
const layout=$('tt-circuit'),map=$('map'),plots=$('plots');if(!layout||!map||!plots)return;
layout.classList.add('vce-tour-studio');
const mapPanel=map.closest('.panel'),curvePanel=plots.closest('.panel');
mapPanel?.classList.add('vce-track-panel');curvePanel?.classList.add('vce-input-panel');
const toolbar=document.createElement('div');toolbar.className='vce-map-tools';
toolbar.innerHTML='<span class="vce-map-kicker">TRAJECTOIRES DU TOUR</span><button type="button" data-mode="both" class="selected">2 trajectoires</button><button type="button" data-mode="pilot">Pilote</button><button type="button" data-mode="reference">Référence</button><button type="button" id="vce-map-fit">Recentrer</button>';
map.parentNode.insertBefore(toolbar,map);
let mode='both';
function updateMode(m){mode=m;toolbar.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===m));map.dataset.mode=m;
 const lines=[...map.querySelectorAll('polyline')];lines.forEach(line=>{const c=(line.getAttribute('stroke')||'').toLowerCase();const ref=['#4d9dff','#3687dc'].includes(c);const pilot=['#ff911d','#f28b28'].includes(c);line.style.opacity=(m==='both'||(m==='pilot'&&!ref)||(m==='reference'&&!pilot))?'1':'.08'})}
toolbar.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>updateMode(b.dataset.mode));
$('vce-map-fit').onclick=()=>{map.style.transform='';map.style.transformOrigin='center'};
new MutationObserver(()=>updateMode(mode)).observe(map,{childList:true});
const header=document.createElement('div');header.className='vce-input-head';header.innerHTML='<strong>INPUTS & VITESSE · TOUR SÉLECTIONNÉ</strong><span>Courbes issues des échantillons du jeu</span>';
curvePanel.insertBefore(header,curvePanel.querySelector('.channels'));
const overview=document.createElement('div');overview.className='vce-tour-summary';
overview.innerHTML='<div><small>CHRONO PILOTE</small><b id="vce-tour-summary-time">—</b></div><div><small>RÉFÉRENCE</small><b id="vce-tour-summary-ref">—</b></div><div><small>ÉCART</small><b id="vce-tour-summary-delta">—</b></div><div><small>VITESSE MAX</small><b id="vce-tour-summary-speed">—</b></div><div><small>FREIN MAX</small><b id="vce-tour-summary-brake">—</b></div><div><small>ACCÉLÉRATEUR MAX</small><b id="vce-tour-summary-throttle">—</b></div>';
layout.before(overview);
const stats=()=>{
 for(const [to,from] of [['vce-tour-summary-time','lapTime'],['vce-tour-summary-ref','refTime'],['vce-tour-summary-delta','delta']])$(to).textContent=$(from)?.textContent||'—';
 const s=window.vceSession;const laps=(s?.laps||[]).filter(l=>l.valid!==false&&(Number.isFinite(l.time)||l.samples?.length>=10));
 const lap=laps[Number($('lap')?.value||0)];const samples=lap?.samples||[];
 const max=k=>{const vals=samples.map(p=>p[k]).filter(v=>typeof v==='number'&&Number.isFinite(v));return vals.length?Math.max(...vals):null};
 const speed=max('speed'),brake=max('brake'),throttle=max('throttle');
 $('vce-tour-summary-speed').textContent=speed===null?'—':fmt(speed)+' km/h';
 $('vce-tour-summary-brake').textContent=brake===null?'—':fmt(brake)+' %';
 $('vce-tour-summary-throttle').textContent=throttle===null?'—':fmt(throttle)+' %';
};
['session','lap','reference'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(stats,50)));
document.addEventListener('vce-cloud-update',()=>setTimeout(stats,50));
setInterval(stats,1800);stats();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
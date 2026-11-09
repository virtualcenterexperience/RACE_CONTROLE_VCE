/* VCE Telemetry navigation 2026-11-09.
   Separate Tour and Setup interfaces; load only the active workspace's modules.
   No changes to source telemetry, authentication or game data. */
(()=>{
'use strict';
const mode=new URLSearchParams(location.search).get('view')==='setup'?'setup':'tour';
document.documentElement.dataset.telemetryView=mode;
document.body?.classList.add('vce-telemetry-workspace');
const sections={
 tour:[['#tt-overview','Vue d’ensemble'],['#vce-tour-live-host','Tour en direct'],['#tt-sessions','Tour X contre X'],['#tt-circuit','Carte & trajectoires'],['#tt-compare','Comparaison de tours'],['#tt-curves','Courbes de pilotage'],['#tt-history','Tours enregistrés'],['#vce-replay','Replay'],['#vce-analysis','Analyse du tour']],
 setup:[['#tt-overview','Vue d’ensemble'],['#tt-sessions','Choisir la séance'],['#vce-setup-live','Capteurs en direct'],['#vce-setup-compare','Carte & comparaison'],['#vce-setup-curves','Courbes mécaniques'],['#vce-setup-values','Données du véhicule']]
};
const scripts=mode==='setup'
 ? ['telemetry-setup-live.js','telemetry-setup-map.js','telemetry-setup-overview.js','telemetry-setup-studio.js']
 : ['telemetry-inputs.js','telemetry-recap.js','telemetry-advanced.js','telemetry-compare-ui.js','telemetry-replay3d.js','telemetry-replay-world3d.js','telemetry-engineering-v33.js','telemetry-tour-studio.js'];
function link(label,href,cls=''){
 const a=document.createElement('a');a.href=href;a.textContent=label;a.className=cls;return a;
}
function navigation(){
 const nav=document.querySelector('.tt-nav');if(!nav)return;
 nav.classList.add('vce-category-nav');
 [...nav.querySelectorAll('a')].forEach(a=>a.remove());
 const bottom=nav.querySelector('.tt-nav-bottom');
 const general=link('← Salon télémétrie','telemetry-salon.html'+location.hash,'vce-general-nav');
 const tour=link('◷ Télémétrie Tour','telemetry.html?view=tour'+location.hash,'vce-workspace-link'+(mode==='tour'?' is-active':''));
 const setup=link('⚙ Télémétrie Setup','telemetry.html?view=setup'+location.hash,'vce-workspace-link'+(mode==='setup'?' is-active':''));
 const anchors=sections[mode].map(([id,label])=>link(label,id,'vce-section-link'));
 nav.insertBefore(general,bottom);nav.insertBefore(tour,bottom);nav.insertBefore(setup,bottom);
 anchors.forEach(a=>nav.insertBefore(a,bottom));
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
  if(visible){anchors.forEach(a=>a.classList.toggle('is-active',a.hash==='#'+visible.target.id))}
 },{rootMargin:'-12% 0px -65% 0px',threshold:0}):null;
 if(observer){
  const watch=()=>{
   anchors.forEach(a=>{const target=document.getElementById(a.hash.slice(1));if(target&&!target.dataset.vceObserved){target.dataset.vceObserved='1';observer.observe(target)}});
  };
  watch();document.addEventListener('vce-cloud-update',watch,{once:true});setTimeout(watch,1800);
 }
}
function errorMessage(path){
 const main=document.querySelector('main');if(!main)return;
 let message=document.getElementById('vce-module-error');
 if(!message){message=document.createElement('p');message.id='vce-module-error';message.setAttribute('role','alert');message.style.cssText='background:#431b2a;border:1px solid #f34365;color:#fff;padding:13px;border-radius:8px';main.prepend(message)}
 message.textContent='Module '+(mode==='setup'?'Setup':'Tour')+' indisponible : '+path+'. Recharge la page si nécessaire.';
}
async function loadModules(){
 // Start network downloads together but execute in order to preserve module dependencies.
 scripts.forEach(path=>{
  const pre=document.createElement('link');pre.rel='preload';pre.as='script';pre.href=path+'?v=20261109-v41';document.head.append(pre);
 });
 for(const path of scripts){
  try{
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=path+'?v=20261109-v41';
    script.onload=resolve;script.onerror=()=>reject(new Error(path));
    document.body.append(script);
   });
  }catch(error){console.error('[VCE telemetry module]',error);errorMessage(path)}
 }
}
function updateTourArchive(){
 const badge=document.getElementById('vce-tour-recording-status');
 if(!badge)return;
 const sessions=window.vceTelemetryData?.sessions||[];
 const loaded=sessions.reduce((total,session)=>total+(session.laps||[]).filter(l=>Array.isArray(l.samples)&&l.samples.length>1).length,0);
 const available=sessions.length;
 badge.textContent=loaded?'● '+loaded+' TOUR(S) CHARGÉ(S) · '+available+' SÉANCE(S)':'○ AUCUN TOUR ARCHIVÉ CHARGÉ';
 badge.dataset.ready=loaded?'yes':'no';
}
function init(){
 document.body.classList.add('vce-telemetry-workspace');
 document.addEventListener('vce-cloud-update',updateTourArchive);
 updateTourArchive();
 const title=document.querySelector('.intro h1');
 if(title){title.innerHTML=mode==='setup'?'TÉLÉMÉTRIE <span>SETUP</span>':'TÉLÉMÉTRIE <span>TOUR</span>'}
 const desc=document.querySelector('.intro p');
 if(desc)desc.textContent=mode==='setup'
  ? 'Analyse mécanique · suspensions, pneus, aérodynamique et carburant · données natives uniquement.'
  : 'Analyse pilotage · carte du circuit, inputs, comparaison et chronos · live et sessions sauvegardées.';
 const hash=location.hash;
 const tourTab=document.getElementById('vce-tour-tab'),setupTab=document.getElementById('vce-setup-tab');
 if(tourTab)tourTab.href='telemetry.html?view=tour'+hash;
 if(setupTab)setupTab.href='telemetry.html?view=setup'+hash;
 // Existing streaming and archive IDs remain stable; only their layout changes.
 const live=document.getElementById('vce-stream'),liveHost=document.getElementById('vce-tour-live-host');
 if(live&&liveHost)liveHost.append(live);
 const setup=document.getElementById('tt-setup'),values=document.getElementById('vce-setup-values');
 if(setup&&values)values.append(setup);
 const header=document.querySelector('body>header');
 if(header&&!header.querySelector('.vce-salon-back'))header.append(link('← Salon général','telemetry-salon.html'+location.hash,'vce-salon-back'));
 navigation();
 loadModules();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

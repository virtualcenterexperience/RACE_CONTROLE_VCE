/* VCE telemetry navigation: load only the scripts belonging to the active workspace.
   Shared telemetry capture, authenticated cloud and live scripts remain in telemetry.html. */
(()=>{
'use strict';
const view=new URLSearchParams(location.search).get('view')==='setup'?'setup':'tour';
document.documentElement.dataset.telemetryView=view;
const modules=view==='setup'
 ? ['telemetry-mechanical.js','telemetry-setup-overview.js','telemetry-setup-studio.js']
 : ['telemetry-inputs.js','telemetry-recap.js','telemetry-advanced.js','telemetry-compare-ui.js','telemetry-replay3d.js','telemetry-replay-world3d.js','telemetry-engineering-v33.js','telemetry-tour-studio.js'];
async function loadModules(){
 for(const path of modules){
  try{
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=path;script.onload=resolve;
    script.onerror=()=>reject(new Error('Script introuvable : '+path));
    document.body.append(script);
   });
  }catch(error){
   console.error('[VCE Telemetry]',error);
   const main=document.querySelector('main');
   if(main){
    let info=document.getElementById('vce-module-error');
    if(!info){info=document.createElement('p');info.id='vce-module-error';info.setAttribute('role','alert');info.style.cssText='background:#411b2a;border:1px solid #f32d56;color:#fff;padding:12px;border-radius:7px';main.prepend(info)}
    info.textContent='Un module '+(view==='setup'?'Setup':'Tour')+' n’a pas pu être chargé. Actualise la page ou vérifie les fichiers GitHub. ('+path+')';
   }
  }
 }
}
function init(){
 const header=document.querySelector('header');
 if(header&&!header.querySelector('.vce-salon-back')){
  const link=document.createElement('a');link.href='telemetry-salon.html';
  link.textContent='← Salon télémétrie général';link.className='vce-salon-back';header.append(link);
 }
 const intro=document.querySelector('.intro h1');
 if(intro)intro.innerHTML=view==='setup'?'TÉLÉMÉTRIE <span>SETUP</span>':'TÉLÉMÉTRIE <span>TOUR</span>';
 const desc=document.querySelector('.intro p');
 if(desc)desc.textContent=view==='setup'
  ? 'Analyse mécanique : aérodynamique, suspensions, garde au sol, carrossage, pneus et carburant.'
  : 'Analyse pilotage : tours, inputs, trajectoires, freinages, secteurs et écarts chronométriques.';
 const nav=document.querySelector('.tt-nav');
 if(nav){
  nav.classList.add('vce-category-nav');
  nav.querySelectorAll('a').forEach(a=>{
   if(a.getAttribute('href')?.startsWith('#'))a.classList.add('vce-tour-nav');
  });
  if(!nav.querySelector('.vce-general-nav')){
   const a=document.createElement('a');a.className='vce-general-nav';a.href='telemetry-salon.html';a.textContent='⌂ Salon général';nav.prepend(a);
   const b=document.createElement('a');b.href='telemetry.html?view=tour'+location.hash;b.textContent='◷ Télémétrie Tour';nav.append(b);
   const c=document.createElement('a');c.href='telemetry.html?view=setup'+location.hash;c.textContent='⚙ Télémétrie Setup';nav.append(c);
  }
 }
 loadModules();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

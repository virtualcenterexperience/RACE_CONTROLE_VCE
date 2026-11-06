/* VCE telemetry sections: keeps capture and Supabase scripts active in both views. */
(()=>{
 const view=new URLSearchParams(location.search).get('view')==='setup'?'setup':'tour';
 document.documentElement.dataset.telemetryView=view;
 function init(){
  const header=document.querySelector('header');
  if(header){const link=document.createElement('a');link.href='telemetry-salon.html';link.textContent='← Salon télémétrie général';link.className='vce-salon-back';header.append(link)}
  const intro=document.querySelector('.intro h1');if(intro)intro.innerHTML=view==='setup'?'TÉLÉMÉTRIE <span>SETUP</span>':'TÉLÉMÉTRIE <span>TOUR</span>';
  const desc=document.querySelector('.intro p');if(desc)desc.textContent=view==='setup'?'Analyse des suspensions, de la garde au sol et du comportement mécanique.':'Analyse des tours, des inputs, des trajectoires et des écarts chronométriques.';
  const nav=document.querySelector('.tt-nav');
  if(nav){nav.classList.add('vce-category-nav');const links=nav.querySelectorAll('a');links.forEach(a=>{if(a.getAttribute('href')?.startsWith('#'))a.classList.add('vce-tour-nav')});const a=document.createElement('a');a.href='telemetry-salon.html';a.textContent='⌂ Salon général';nav.prepend(a);const b=document.createElement('a');b.href='telemetry.html?view=tour'+location.hash;b.textContent='◷ Télémétrie Tour';nav.append(b);const c=document.createElement('a');c.href='telemetry.html?view=setup'+location.hash;c.textContent='⚙ Télémétrie Setup';nav.append(c)}
  if(view==='setup'){
   const mechanical=document.getElementById('vce-mechanical');
   if(mechanical){mechanical.classList.add('vce-setup-primary')}
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
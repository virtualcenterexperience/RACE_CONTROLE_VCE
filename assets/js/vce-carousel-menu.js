/* VCE Race Control — horizontal visual category / driver cards. 
   Pure presentation: profile IDs and authentication remain server-owned. */
(()=>{'use strict';
const t=(fr,en)=>document.documentElement.lang==='en'?en:fr;
const make=(tag,cls='',label='')=>{const x=document.createElement(tag);if(cls)x.className=cls;if(label)x.textContent=label;return x};
const artwork=['data/images/pilotage-coache.webp','data/images/simulateurs-vce.webp','data/images/coaching-sur-piste.webp'];
function carousel(track,{title,eyebrow,drivers=false}){
 if(!track||track.dataset.vceCarousel==='1')return;
 track.dataset.vceCarousel='1';
 track.classList.add('vce-race-track');
 const outer=make('section','vce-race-carousel');
 const toolbar=make('div','vce-race-toolbar');
 const heading=make('div','vce-race-heading');
 const small=make('small','',eyebrow),h2=make('h2','',title);
 heading.append(small,h2);
 const control=make('div','vce-race-controls');
 const counter=make('span','vce-race-index');
 const prev=make('button','vce-race-arrow','‹'),next=make('button','vce-race-arrow','›');
 prev.type=next.type='button';
 prev.setAttribute('aria-label',t('Voir les cartes précédentes','Previous cards'));
 next.setAttribute('aria-label',t('Voir les cartes suivantes','Next cards'));
 const view=make('div','vce-race-viewport');
 outer.append(toolbar,view);toolbar.append(heading,control);control.append(counter,prev,next);
 track.parentElement.insertBefore(outer,track);view.append(track);
 const tiles=()=>Array.from(track.children).filter(x=>x.matches(drivers?'.pilot-select':'.card'));
 function decorate(){
  if(!drivers)return;
  tiles().forEach((tile,i)=>{
   if(tile.classList.contains('vce-roster-skeleton'))return;
   tile.classList.add('vce-race-pilot-tile');
   if(tile.querySelector('.vce-race-pilot-art'))return;
   const art=make('span','vce-race-pilot-art');
   art.setAttribute('aria-hidden','true');
   art.style.backgroundImage='linear-gradient(180deg, transparent 8%, rgba(3,10,22,.72) 100%),url("'+artwork[i%artwork.length]+'")';
   tile.prepend(art);
  });
 }
 function update(){
  decorate();
  const arr=tiles(),max=Math.max(0,track.scrollWidth-track.clientWidth);
  const step=Math.max(1,arr[1]?.offsetLeft-arr[0]?.offsetLeft||track.clientWidth*.85);
  const page=Math.min(arr.length,Math.max(1,Math.round(track.scrollLeft/step)+1));
  counter.textContent=arr.length?String(page).padStart(2,'0')+' / '+String(arr.length).padStart(2,'0'):'00 / 00';
  prev.disabled=track.scrollLeft<4;
  next.disabled=track.scrollLeft>=max-4;
  outer.dataset.overflow=String(max>12);
 }
 function move(dir){
  const arr=tiles();const current=arr.find(x=>x.offsetLeft>track.scrollLeft+track.offsetLeft+4);
  const width=arr.length>1?arr[1].offsetLeft-arr[0].offsetLeft:(arr[0]?.getBoundingClientRect().width||240);
  track.scrollBy({left:dir*width*(innerWidth>=1100?2:1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 }
 prev.onclick=()=>move(-1);next.onclick=()=>move(1);
 track.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 window.addEventListener('hashchange',()=>requestAnimationFrame(update));
 if(drivers)new MutationObserver(()=>requestAnimationFrame(update)).observe(track,{childList:true});
 if(typeof ResizeObserver==='function')new ResizeObserver(update).observe(track);
 update();
}
function init(){
 carousel(document.querySelector('body.vce-page-chooser .cards'),
  {title:t('CHOISIS TON ESPACE','CHOOSE YOUR WORKSPACE'),eyebrow:'VCE ESPORT / RACE CONTROL'});
 carousel(document.querySelector('body.vce-page-pilot #pilotGrid'),
  {title:t('PILOTES VCE','VCE DRIVERS'),eyebrow:t('SÉLECTION DES PROFILS','DRIVER PROFILE SELECTION'),drivers:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* Reuse exactly the welcome photo embedded in index.html without copying 160KB into every page. */
(()=>{'use strict';async function useHomeImage(){
 try{const r=await fetch('index.html',{cache:'no-store'});if(!r.ok)return;
 const html=await r.text();const match=html.match(/<img[^>]*data-vce-hero="engineering-20261106"[^>]*src="(data:image\/jpeg;base64,[^"]+)"/i);
 if(match)document.body.style.setProperty('--vce-hero-image','url("'+match[1]+'")');
 }catch(e){console.warn('Photo accueil indisponible, utilisation de secours',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',useHomeImage,{once:true});else useHomeImage();
})();

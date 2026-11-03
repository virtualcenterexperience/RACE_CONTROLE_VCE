/* Correctif VCE - sauve les presets STAFF existants dans Supabase.
   Ce script doit être chargé après vce-github-sync.js.
   Il intercepte le bouton "Enregistrer pour tous", sans export JSON. */
(function(){
'use strict';
const KINDS={calendrier:'vce_calendar_v1',lineup:'vce_lineup_v1',resultats:'vce_resultats_v2'};
const kind=location.pathname.match(/(?:^|\/)(calendrier|lineup|resultats)-staff\.html$/)?.[1];
if(!kind)return;
function install(){
 const host=document.querySelector('.vce-presets');
 if(!host||host.dataset.supabaseFixed)return;
 host.dataset.supabaseFixed='yes';
 const publish=host.querySelector('.ps-publish');
 const hide=host.querySelector('.ps-hide');
 const status=host.querySelector('.ps-status');
 const selector=host.querySelector('.ps-slot');
 const title=host.querySelector('.ps-title');
 const save=document.getElementById('save');
 const loginHint=()=>{throw new Error('Connectez-vous d’abord en haut à droite avec votre compte STAFF Supabase.')};
 const defaults=()=>({version:1,updatedAt:null,presets:Array.from({length:5},(_,i)=>({id:i+1,title:'Preset '+(i+1),published:false,data:null}))});
 function form(){
  // Enregistre localement d'abord dans le formulaire existant.
  if(kind==='calendrier'&&typeof data==='function')return data();
  if(kind==='resultats'&&typeof collect==='function')return collect();
  if(kind==='lineup'&&typeof collect==='function'){
    collect();
    if(typeof model!=='undefined')return JSON.parse(JSON.stringify(model));
  }
  const v=localStorage.getItem(KINDS[kind]);
  return v?JSON.parse(v):null;
 }
 async function persist(mask){
  const sp=window.VCESupabase;
  if(!sp?.configured())throw new Error('Supabase non configuré.');
  if(!sp.session())loginHint();
  let db=await sp.read(kind);
  if(!db||!Array.isArray(db.presets))db=defaults();
  for(let i=0;i<5;i++)if(!db.presets[i])db.presets[i]={id:i+1,title:'Preset '+(i+1),published:false,data:null};
  const slot=Number(selector.value);
  if(!Number.isInteger(slot)||slot<0||slot>=5)throw new Error('Preset invalide.');
  const p=db.presets[slot];
  p.id=slot+1;
  p.title=title.value.trim()||'Preset '+(slot+1);
  if(mask){p.published=false;}else{
    const d=form();
    if(!d)throw new Error('Formulaire vide / données manquantes.');
    p.data=d;p.published=true;
  }
  db.updatedAt=new Date().toISOString();
  await sp.save(kind,db);
  return p;
 }
 async function submit(mask){
   publish.disabled=true;hide.disabled=true;status.textContent='Enregistrement dans Supabase…';
   try{
     const p=await persist(mask);
     status.textContent=mask?'✅ Masqué pour tous.':'✅ Enregistré pour tous ! Actualisation des autres pages sous 10 secondes.';
     const opt=selector.options[Number(selector.value)];
     if(opt)opt.textContent=p.id+' — '+p.title+(p.published?' 🟢':' ⚪');
   }catch(e){
     status.textContent='❌ Enregistrement impossible : '+(e?.message||String(e));
     console.error('VCE Supabase',e);
   }finally{publish.disabled=false;hide.disabled=false}
 }
 // Replace previous legacy handlers directly (which exported JSON).
 publish.onclick=()=>submit(false);
 hide.onclick=()=>submit(true);
 // Stop old Enregistrer handler from remaining local-only: save and publish
 if(save)save.addEventListener('click',()=>submit(false));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
})();

/* VCE — optional authenticated service check, no automatic polling or data editing. */
(()=>{
 'use strict';
 const entries=[
  ['vce-pilot-accounts','Comptes pilotes (lecture STAFF)'],
  ['vce-roster-sync','Présence / effectif (lecture STAFF)'],
  ['vce-training','Entraînements (lecture STAFF)'],
  ['vce-team','Publications Team (lecture STAFF)'],
  ['vce-telemetry-history','Historique télémétrie (lecture STAFF)'],
  ['vce-pilot-presence','Dernières connexions (lecture STAFF)']
 ];
 let panel=null;
 function mount(){
  if(panel||!document.getElementById('dashboard'))return;
  panel=document.createElement('section');panel.className='panel';panel.id='vce-services-panel';
  panel.style.cssText='margin:24px 12px;padding:20px;max-width:100%;border:1px solid #375577;border-radius:12px;background:#101c2e;color:#e7efff';
  const title=document.createElement('h2');title.textContent='SERVICES SUPABASE · DIAGNOSTIC';
  title.style.cssText='font-size:18px;margin:0 0 10px';
  const info=document.createElement('p');info.textContent='Contrôle manuel des nouveaux services en lecture seule. Ce test ne vérifie pas la connexion des pilotes, ne modifie aucune donnée et ne remplace pas les modules existants.';
  info.style.cssText='font-size:13px;line-height:1.5;color:#aec7e5';
  const button=document.createElement('button');button.type='button';button.textContent='VÉRIFIER LES 6 SERVICES';button.className='btn';button.style.cssText='padding:10px 14px';
  const output=document.createElement('div');output.setAttribute('role','status');output.setAttribute('aria-live','polite');
  output.style.cssText='margin-top:12px;font-size:13px;line-height:1.8;white-space:pre-line;color:#c7dcf5';
  button.addEventListener('click',async()=>{
   if(!window.VCESupabase?.session()){output.textContent='Connexion STAFF requise.';return;}
   button.disabled=true;output.textContent='Contrôle en cours…';const lines=[];
   for(const [name,label] of entries){
    try{
     const result=await window.VCESupabase.serviceRead(name);
     lines.push('✓ '+label+' — '+(Array.isArray(result.items)?result.items.length:'?')+' enregistrement(s) retourné(s), limité(s) à 20');
    }catch(err){lines.push('⚠ '+label+' — '+String(err?.message||'service indisponible').slice(0,130))}
    output.textContent=lines.join('\n');
   }
   button.disabled=false;
  });
  panel.append(title,info,button,output);
  document.getElementById('dashboard').append(panel);
 }
 document.addEventListener('DOMContentLoaded',mount,{once:true});
 window.addEventListener('vce-staff-authenticated',mount);
 if(document.readyState!=='loading')mount();
})();

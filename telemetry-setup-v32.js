/* VCE 3.2 — Display actual setup channels only. No estimated or invented setup values. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const scalar=v=>v===null||v===undefined||v===''?'—':
  typeof v==='number'&&Number.isFinite(v)?String(Math.round(v*100)/100):
  typeof v==='string'?v.slice(0,90):'—';
const describe=v=>{
 if(Array.isArray(v))return v.length?v.slice(0,8).map(scalar).join(' / '):'—';
 if(v&&typeof v==='object'){
   const entries=Object.entries(v).filter(([,x])=>x!==null&&x!==undefined&&
     (typeof x==='string'||typeof x==='number'||Array.isArray(x))).slice(0,8);
   return entries.length?entries.map(([k,x])=>k+': '+(Array.isArray(x)?x.map(scalar).join('/'):scalar(x))).join(' · '):'—';
 }
 return scalar(v);
};
const get=(o,keys)=>{for(const key of keys)if(o&&o[key]!==null&&o[key]!==undefined)return o[key];return null};
let last='';
function refresh(){
 const session=window.vceSession;
 const setup=session?.setup||session?.car_setup||session?.telemetry_setup||null;
 const laps=Array.isArray(session?.laps)?session.laps:[];
 const live=session?.live?.sample||session?.live?.telemetry||null;
 const sample=live||laps.at(-1)?.samples?.at(-1)||null;
 const raw={
  suspension:get(setup,['suspension','suspensions','dampers']),
  aero:get(setup,['aero','aerodynamics','wing']),
  drag:get(setup,['drag','drag_coefficient','cd']),
  gears:get(setup,['gear_ratios','gearbox','gears']),
  fuel:get(sample,['fuel_l','fuel'])??get(setup,['fuel_l','fuel']),
  tyres:get(sample,['tyre_temperatures','tire_temperatures','tyre_temp','tire_temp'])??get(setup,['tyre_temperatures','tire_temperatures']),
  dimensions:get(setup,['dimensions','car_dimensions','vehicle_size'])
 };
 const fingerprint=JSON.stringify(raw);
 if(fingerprint===last)return;last=fingerprint;
 let available=0;
 for(const [key,val] of Object.entries(raw)){
  const target=$('vce-setup-'+key);
  if(!target)continue;
  const text=describe(val);target.textContent=text;
  target.title=text;
  if(text!=='—')available++;
 }
 const note=$('vce-setup-note'),source=$('vce-setup-source');
 if(note)note.textContent=available?
  available+' catégorie(s) issue(s) des données réellement reçues. Les autres ne sont pas exposées par le flux actuel.':
  'Aucun réglage détaillé transmis par le jeu ou par un fichier de setup pour cette session.';
 if(source)source.textContent=available?'Données disponibles : '+available+'/7':'Données setup non disponibles';
}
document.addEventListener('DOMContentLoaded',()=>{refresh();setInterval(()=>{if(!document.hidden)refresh()},1500)});
})();
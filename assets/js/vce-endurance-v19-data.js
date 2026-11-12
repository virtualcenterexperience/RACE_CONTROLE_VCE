/* Legacy V19 strategy indicators, shared and cached. */

/* Fonctions V19 autonomes : les anciens modules externes n'étaient pas fournis. */
(()=>{
 const $v=id=>document.getElementById(id);
 const val=id=>{const e=$v(id);return e?e.value:''};
 const n=id=>Number(String(val(id)).replace(',','.'))||0;
 const fmt=x=>Number.isFinite(x)?x.toFixed(1):'—';
 function update(){
  const lap=(typeof lapSeconds==='function'?lapSeconds(val('lap')):0),fuel=n('fuel'),tank=n('tank'),hours=n('hours');
  const laps=lap>0?Math.ceil(hours*3600/lap):0;
  const stints=fuel>0&&tank>0?Math.max(1,Math.ceil(laps*fuel/tank)):0;
  const m=$v('v19-metrics');if(m)m.innerHTML=[['Tours estimés',laps||'—'],['Autonomie',fuel>0?Math.floor(tank/fuel)+' tours':'—'],['Arrêts essence',stints?Math.max(0,stints-1):'—'],['Carburant total',fuel>0?fmt(laps*fuel)+' L':'—']].map(([a,b])=>`<div class="v19-metric"><small>${a}</small><div style="font-size:22px;font-weight:900;margin-top:6px">${b}</div></div>`).join('');
  const fuelOut=$v('v19-fuel-output');if(fuelOut){const l=Math.max(0,n('v19-fuel-laps')),required=l*fuel*(1+n('safetyFuel')/100)+n('reserve')*fuel;fuelOut.textContent='Carburant nécessaire : '+fmt(required)+' L · À ajouter : '+fmt(Math.max(0,required-n('v19-fuel-onboard')))+' L';}
  const compare=$v('v19-compare');if(compare){compare.innerHTML=[['ÉCONOMIE',0.97],['NORMAL',1],['ATTAQUE',1.04]].map(([name,factor])=>`<div><b>${name}</b> · Conso estimée : ${fmt(fuel*factor)} L/tour · Total : ${fmt(laps*fuel*factor)} L</div>`).join('');}
 }
 function save(){
  if(typeof saveCurrentCourse==='function')try{saveCurrentCourse()}catch(e){}
  const data=localStorage.getItem('vce_race_control_v2');if(!data){alert('Aucune sauvegarde locale trouvée.');return;}
  const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VCE-Race-Control-3-courses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 const exp=$v('v19-export');if(exp)exp.addEventListener('click',save);
 const imp=$v('v19-import'),btn=$v('v19-import-btn');if(btn&&imp)btn.addEventListener('click',()=>imp.click());
 if(imp)imp.addEventListener('change',async()=>{try{const data=JSON.parse(await imp.files[0].text());if(!data||!Array.isArray(data.slots)||!Array.isArray(data.slotNames))throw Error('Format de sauvegarde invalide');if(!confirm('Remplacer les 3 courses par ce fichier ?'))return;localStorage.setItem('vce_race_control_v2',JSON.stringify(data));location.reload()}catch(e){alert('Import impossible : '+e.message)}});
 const analyse=$v('v19-analyse');if(analyse)analyse.addEventListener('click',()=>{if(typeof calculate==='function')calculate();update();$v('v19-tools')?.scrollIntoView({behavior:'smooth'})});
 const scenarios=$v('v19-scenarios');if(scenarios)scenarios.addEventListener('click',()=>{update();$v('v19-compare')?.scrollIntoView({behavior:'smooth'})});
 ['v19-fuel-laps','v19-fuel-onboard','fuel','tank','hours','lap','reserve','safetyFuel'].forEach(id=>$v(id)?.addEventListener('input',update));
 window.addEventListener('load',()=>{try{update()}catch(e){console.warn('Indicateurs V19:',e)}});
})();

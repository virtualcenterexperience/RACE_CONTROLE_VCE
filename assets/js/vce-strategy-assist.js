/* VCE Strategy Aid — independent, read-only chart based on current form values.
   Does not mutate the race model, saves, or pit calculations. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const number=id=>{const raw=$(id)?.value;if(raw===undefined||raw===null||String(raw).trim()==='')return null;const v=Number(raw);return Number.isFinite(v)?v:null};
const lang=()=>document.documentElement.lang==='en';
const txt=(fr,en)=>lang()?en:fr;
const safe=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
let last='';
function chart(){
 const root=$('vce-strategy-help');if(!root)return;
 const laps=number('v19-fuel-laps'),usage=number('fuel'),reserve=number('reserve'),tank=number('tank'),
 onboard=number('v19-fuel-onboard'),safety=number('safetyFuel');
 const values=[laps,usage,reserve,tank,onboard,safety];const key=values.join('|');if(key===last)return;last=key;
 const output=$('vce-strategy-bars'),notice=$('vce-strategy-note');output.replaceChildren();
 const valid=safe(laps,1,500)&&safe(usage,.001,100)&&safe(reserve,0,20)&&safe(tank,1,1000)&&safe(onboard,0,1000)&&safe(safety,0,100);
 if(!valid){notice.textContent=txt('Renseigne des valeurs positives et cohérentes pour afficher la visualisation. Les calculs ne remplacent pas la stratégie officielle.','Enter valid positive values to display the visualization. This helper does not replace the official strategy.');return}
 const total=usage*(laps+reserve)*(1+safety/100);
 const max=Math.max(total,tank,onboard,1);
 const rows=[
 {label:txt('Carburant recommandé · marge incluse','Recommended fuel · including margin'),value:total,max,color:'blue'},
 {label:txt('Capacité du réservoir','Tank capacity'),value:tank,max,color:'red'},
 {label:txt('Carburant à bord','Fuel onboard'),value:onboard,max,color:'green'}
 ];
 for(const r of rows){
  const line=document.createElement('div');line.className='vce-strategy-bar';
  const label=document.createElement('label');const title=document.createElement('span');title.textContent=r.label;
  const value=document.createElement('b');value.textContent=r.value.toFixed(1)+' L';
  label.append(title,value);line.append(label);
  const track=document.createElement('div');track.className='vce-strategy-track';const fill=document.createElement('i');fill.style.width=(r.value/max*100).toFixed(2)+'%';track.append(fill);line.append(track);output.append(line)
 }
 const diff=Math.max(0,total-onboard);
 const extra=total>tank?txt('Attention : le carburant nécessaire dépasse la capacité du réservoir. Prévois un ou plusieurs ravitaillements.','Warning: required fuel exceeds tank capacity. Plan refuelling stops.'):
 txt('La capacité du réservoir couvre cet objectif théorique.','Tank capacity covers this theoretical target.');
 notice.textContent=txt('À ajouter : ','Fuel to add: ')+diff.toFixed(1)+' L · '+extra+' '+txt('Vérifie la consommation et les règles réelles du championnat.','Check real fuel usage and championship rules.');
}
function mount(){
 if($('vce-strategy-help'))return;
 const anchor=$('v19-tools');if(!anchor)return;
 const root=document.createElement('section');root.id='vce-strategy-help';root.className='vce-strategy-help';
 root.innerHTML='<h2>⛽ AIDE VISUELLE · AUTONOMIE & CARBURANT</h2><p>Comparaison indépendante fondée sur les valeurs de course saisies : consommation, tours, réserve, marge de sécurité et réservoir.</p><div class="vce-strategy-bars" id="vce-strategy-bars"></div><p id="vce-strategy-note" role="status">En attente de paramètres.</p>';
 anchor.after(root);
 ['fuel','tank','reserve','safetyFuel','v19-fuel-laps','v19-fuel-onboard'].forEach(id=>$(id)?.addEventListener('input',chart));
 document.querySelectorAll('button').forEach(b=>{if(/recalculer|calculer|apply/i.test(b.textContent))b.addEventListener('click',()=>setTimeout(chart,80))});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)chart()});setInterval(()=>{if(!document.hidden)chart()},6500);chart();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
/* Tour comparison UI — selected and reference indices align with telemetry.js, including invalid laps. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>Number.isFinite(n)&&n>0?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
const laps=()=> (window.vceSession?.laps||[]).filter(l=>l&&(Number.isFinite(+l.time)&&+l.time>0||l.samples?.length>=2||Number.isInteger(l.number))).slice().sort((a,b)=>(a.number??0)-(b.number??0));
function sync(){
 const all=laps(),i=Number($('lap')?.value),j=Number($('reference')?.value),a=all[i];
 const external=$('reference')?.value==='external'&&window.VCEexternalReferenceLap?.baseId===window.vceSession?.id;
 const b=external?window.VCEexternalReferenceLap.lap:all[j];
 const time=l=>typeof l?.time==='number'&&l.time>0?l.time:null;
 $('vceCompareLap').textContent=fmt(time(a));$('vceCompareRef').textContent=fmt(time(b));
 $('vceCompareLapInfo').textContent=a?'Tour '+(a.number??i+1)+(a.valid===false?' · INVALIDE':''):'Aucun tour sélectionné';
 $('vceCompareRefInfo').textContent=b?(external?'Autre pilote · ':'Tour ')+(external?window.VCEexternalReferenceLap.pilot:(b.number??j+1))+(b.valid===false?' · INVALIDE':''):'Aucune référence';
 const d=time(a)!==null&&time(b)!==null?time(a)-time(b):NaN;
 const el=$('vceCompareDelta');el.textContent=Number.isFinite(d)?(d>0?'+':'')+d.toFixed(3)+' s':'—';el.className=Number.isFinite(d)?d<=0?'gain':'loss':'';
 $('vceCompareStatus').textContent=a&&b?'● Comparaison disponible':'○ En attente de données';
 $('vceCompareHint').textContent=a&&b?'Orange : tour analysé · bleu : référence. Les tours invalides restent analysables, mais sont exclus du meilleur tour automatique.':'Charge une session contenant des tours enregistrés pour commencer.';
}
$('vceSwapLaps')?.addEventListener('click',()=>{
 if($('reference')?.value==='external')return;
 const a=$('lap').value,b=$('reference').value;
 $('lap').value=b;$('reference').value=a;$('lap').dispatchEvent(new Event('change'));sync();
});
$('vceBestRef')?.addEventListener('click',()=>{
 const all=laps(),best=all.filter(l=>l.valid!==false&&typeof l.time==='number'&&l.time>0).sort((a,b)=>a.time-b.time)[0];
 if(!best)return;const ix=all.indexOf(best);
 $('reference').value=String(ix);$('reference').dispatchEvent(new Event('change'));sync();
});
$('vceCompareChannel')?.addEventListener('change',e=>{
 const names=['throttle','brake','steering','slip','gear','speed'];
 [...$('channels').children][names.indexOf(e.target.value)]?.click();
});
['lap','reference','session'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(sync,0)));
document.addEventListener('vce-cloud-update',sync);
const obs=new MutationObserver(sync);if($('lap'))obs.observe($('lap'),{childList:true});if($('reference'))obs.observe($('reference'),{childList:true});sync();
})();
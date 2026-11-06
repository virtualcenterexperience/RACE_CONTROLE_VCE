/* VCE ESPORT — combined coach evaluation / verified chrono ranking, advisory v1.
 * 20 coach criteria (1-5) => points /50; percentage of comparable LMU reference.
 * Unconfirmed weighting thresholds are provisional and must be approved by STAFF.
 */
(()=>{'use strict';
 const POLICY=Object.freeze({
  version:'vce-evaluation-ranking-proposal-2026-11',
  status:'PROPOSED_NOT_APPROVED',
  totalCriteria:20,
  maxPerCriterion:5,
  pointsBands:[{min:40,name:'ESPORT',rank:3},{min:30,name:'ACADÉMIE',rank:2},{min:20,name:'ROOKIE',rank:1},{min:0,name:'REFUSÉ',rank:0}],
  percentBands:[{max:101,name:'ESPORT',rank:3},{max:103,name:'ACADÉMIE',rank:2},{max:105,name:'ROOKIE',rank:1},{max:Infinity,name:'REFUSÉ',rank:0}],
  refusalPercent:105,
  versionStatus:'Barème de points proposé, validation STAFF requise'
 });
 const names=['REFUSÉ','ROOKIE','ACADÉMIE','ESPORT'];
 function score(scores){
  if(!Array.isArray(scores)||scores.length!==POLICY.totalCriteria)return null;
  const clean=scores.map(x=>x==null||x===''?null:Number(x));
  const count=clean.filter(Number.isInteger).length;
  if(count!==POLICY.totalCriteria||clean.some(x=>!Number.isInteger(x)||x<1||x>5))
   return {complete:false,rated:count,total:clean.reduce((a,b)=>a+(Number.isInteger(b)&&b>=1&&b<=5?b:0),0),points50:null,name:null};
  const total=clean.reduce((a,b)=>a+b,0),points50=total/2;
  return {complete:true,rated:20,total,points50,name:POLICY.pointsBands.find(x=>points50>=x.min).name};
 }
 function percentage(pct){
  const n=Number(pct);
  if(pct==null||pct===''||!Number.isFinite(n)||n<=0||n>250)return null;
  // All percentages >=105 are refused, including 107% or above.
  if(n>=105)return {percent:n,name:'REFUSÉ',rank:0};
  const band=POLICY.percentBands.find(x=>n<=x.max);
  return {percent:n,name:band.name,rank:band.rank};
 }
 function combine({scores,percent,referenceConfirmed=false}={}){
  const coach=score(scores),chrono=referenceConfirmed?percentage(percent):null;
  const result={version:POLICY.version,provisional:true,coach,chrono,
   category:null,ready:false,reason:'',pointsStatus:POLICY.versionStatus};
  if(!coach?.complete){
   result.reason='Notes coach incomplètes : 20 critères évalués nécessaires.';return result;
  }
  if(!chrono){
   result.reason='Pourcentage LMU absent ou non confirmé : référence voiture/circuit/catégorie et conditions requise.';return result;
  }
  const pointRank=names.indexOf(coach.name),chronoRank=chrono.rank;
  result.category=names[Math.min(pointRank,chronoRank)];
  result.ready=true;
  result.reason=result.category==='REFUSÉ'
   ?(chrono.percent>=105?'Seuil chrono VCE de 105 % atteint.':"Le score des critères ne dépasse pas le seuil minimal proposé.")
   :'Le niveau le plus bas entre la grille coach et le chrono comparable fixe l’orientation.';
  return result;
 }
 function timeSeconds(raw){
  if(typeof raw==='number')return Number.isFinite(raw)&&raw>0?raw:null;
  const str=String(raw??'').trim().replace(',','.');
  if(/^\d+(?:\.\d+)?$/.test(str)){const n=Number(str);return n>0?n:null}
  if(/^\d{1,3}:\d{2}(?:\.\d{1,3})?$/.test(str)){
   const [m,s]=str.split(':').map(Number);return s<60&&m>=0?m*60+s:null;
  }
  return null;
 }
 window.VCEEvaluationRanking={POLICY,score,percentage,combine,timeSeconds};
})();
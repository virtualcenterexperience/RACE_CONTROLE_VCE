/* VCE ESPORT — combined coach evaluation / verified chrono ranking, advisory v1.
 * Rated coach criteria (1–5) are weighted equally and normalized to /50.
 * Unconfirmed weighting thresholds are provisional and must be approved by STAFF.
 */
(()=>{'use strict';
 const POLICY=Object.freeze({
  version:'vce-evaluation-ranking-proposal-2026-11-optional-criteria',
  status:'PROPOSED_NOT_APPROVED',
  totalCriteria:20,
  maxPerCriterion:5,
  pointsBands:[{min:40,name:'ESPORT',rank:3},{min:30,name:'ACADÉMIE',rank:2},{min:20,name:'ROOKIE',rank:1},{min:0,name:'REFUSÉ',rank:0}],
  percentBands:[{max:101,name:'ESPORT',rank:3},{max:103,name:'ACADÉMIE',rank:2},{max:105,name:'ROOKIE',rank:1},{max:Infinity,name:'REFUSÉ',rank:0}],
  refusalPercent:105,
  versionStatus:'Barème de points proposé, validation STAFF requise'
 });
 const names=['REFUSÉ','ROOKIE','ACADÉMIE','ESPORT'];
 function score(scores,{finalized=false}={}){
  if(!Array.isArray(scores)||scores.length!==POLICY.totalCriteria)return null;
  const clean=scores.filter(value=>value!=null&&value!==''&&value!==0&&value!=='0').map(Number);
  const ratedScores=clean.filter(value=>Number.isInteger(value)&&value>=1&&value<=POLICY.maxPerCriterion);
  const rated=ratedScores.length;
  const total=ratedScores.reduce((sum,value)=>sum+value,0);
  const maxTotal=rated*POLICY.maxPerCriterion;
  const complete=finalized&&rated>0&&rated===clean.length;
  const points50=complete?50*total/maxTotal:null;
  const name=complete?POLICY.pointsBands.find(band=>points50>=band.min).name:null;
  return {complete,rated,total,maxTotal,points50,name};
 }
 function percentage(pct){
  const n=Number(pct);
  if(pct==null||pct===''||!Number.isFinite(n)||n<=0||n>250)return null;
  // All percentages >=105 are refused, including 107% or above.
  if(n>=105)return {percent:n,name:'REFUSÉ',rank:0};
  const band=POLICY.percentBands.find(x=>n<=x.max);
  return {percent:n,name:band.name,rank:band.rank};
 }
 function combine({scores,percent,referenceConfirmed=false,finalized=false}={}){
  const coach=score(scores,{finalized}),chrono=referenceConfirmed?percentage(percent):null;
  const result={version:POLICY.version,provisional:true,coach,chrono,
   category:null,ready:false,reason:'',pointsStatus:POLICY.versionStatus};
  if(!coach?.complete){
   result.reason=coach?.rated
    ?'Calcule la note finale à partir des critères évalués.'
    :'Note au moins un critère pour calculer une note.';
   return result;
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
/* VCE ESPORT — combined coach evaluation / verified chrono ranking, advisory v1.
 * Ten coach criteria (0–10) are weighted equally on the /100 scale.
 * Unconfirmed weighting thresholds are provisional and must be approved by STAFF.
 */
(()=>{'use strict';
 const POLICY=Object.freeze({
  version:'vce-evaluation-ranking-10x10-2026-11',
  status:'PROPOSED_NOT_APPROVED',
  totalCriteria:10,
  maxPerCriterion:10,
  pointsBands:[
   {min:25,name:'ESPORT',rank:3},
   {min:20,name:'ACADÉMIE',rank:2},
   {min:15,name:'ROOKIE',rank:1},
   {min:10,name:'OBSERVATION',rank:1},
   {min:0,name:'REFUSÉ',rank:0}
  ],
  percentBands:[{max:101,name:'ESPORT',rank:3},{max:103,name:'ACADÉMIE',rank:2},{max:105,name:'ROOKIE',rank:1},{max:Infinity,name:'REFUSÉ',rank:0}],
  refusalPercent:105,
  versionStatus:'Barème de points proposé, validation STAFF requise'
 });
 function coachBand(points){
  if(!Number.isFinite(points)||points<0||points>50)return null;
  return POLICY.pointsBands.find(band=>points>=band.min);
 }
 function score(scores,{finalized=false}={}){
  if(!Array.isArray(scores)||scores.length!==POLICY.totalCriteria)return null;
  const clean=scores.filter(value=>value!=null&&value!=='').map(Number);
  const ratedScores=clean.filter(value=>Number.isInteger(value)&&value>=0&&value<=POLICY.maxPerCriterion);
  const rated=ratedScores.length;
  const total=ratedScores.reduce((sum,value)=>sum+value,0);
  const maxTotal=rated*POLICY.maxPerCriterion;
  const complete=finalized&&rated>0&&rated===clean.length;
  const points100=complete?100*total/maxTotal:null;
  const points50=complete?points100/2:null;
  const name=coachBand(points50)?.name??null;
  return {complete,rated,total,maxTotal,points50,points100,name};
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
  result.category=coach.name;
  result.ready=true;
  const coachReason=coach.name==='OBSERVATION'
   ?'À améliorer d’urgence. Deuxième chance avec des objectifs précis et une réévaluation.'
   :coach.name==='REFUSÉ'
    ?'Refusé à ce stade. Une nouvelle évaluation est possible après avoir travaillé les points relevés.'
    :'Orientation déterminée par la note du coach sur 50.';
  const chronoReason=!chrono
   ?'Une référence LMU comparable peut compléter le dossier.'
   :chrono.name==='REFUSÉ'
    ?'Le seuil chrono LMU de 105 % est atteint ou dépassé. Le STAFF examine ce résultat avec la grille avant sa décision.'
    :chrono.name===coach.name
    ?'Le chrono LMU comparable va dans le même sens.'
    :'Repère chrono LMU : '+chrono.name+'. Le STAFF examine l’écart avec la grille avant sa décision.';
  result.reason=coachReason+' '+chronoReason;
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
 window.VCEEvaluationRanking={POLICY,score,coachBand,percentage,combine,timeSeconds};
})();
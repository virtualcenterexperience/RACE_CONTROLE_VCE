/* VCE ESPORT — combined coach evaluation / verified chrono ranking, advisory v1.
 * Rated coach criteria (1–5) are weighted equally and normalized to /50.
 * Unconfirmed weighting thresholds are provisional and must be approved by STAFF.
 */
(()=>{'use strict';
 const POLICY=Object.freeze({
  version:'vce-evaluation-ranking-proposal-2026-11-coach-observation',
  status:'PROPOSED_NOT_APPROVED',
  totalCriteria:20,
  maxPerCriterion:5,
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
  const clean=scores.filter(value=>value!=null&&value!==''&&value!==0&&value!=='0').map(Number);
  const ratedScores=clean.filter(value=>Number.isInteger(value)&&value>=1&&value<=POLICY.maxPerCriterion);
  const rated=ratedScores.length;
  const total=ratedScores.reduce((sum,value)=>sum+value,0);
  const maxTotal=rated*POLICY.maxPerCriterion;
  const complete=finalized&&rated>0&&rated===clean.length;
  const points50=complete?50*total/maxTotal:null;
  const name=coachBand(points50)?.name??null;
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
  result.category=coach.name;
  result.ready=true;
  const coachReason=coach.name==='OBSERVATION'
   ?'À améliorer d’urgence. Deuxième chance avec des objectifs précis et une réévaluation.'
   :'Orientation proposée à partir des compétences évaluées par le coach.';
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
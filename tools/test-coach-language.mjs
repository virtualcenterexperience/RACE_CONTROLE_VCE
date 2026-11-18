import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = {};
for (const file of ['assets/js/vce-coach-language.js', 'assets/js/vce-coach-engine-v2.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
}
const language = context.VCECoachLanguage;
const engine = context.VCECoachEngine;
const continents = ['europe','asie','afrique','amerique-du-nord','amerique-du-sud','oceanie'];
const data = {
  tracks: continents.flatMap(name => JSON.parse(fs.readFileSync('data/' + name + '.json')).circuits),
  cars: JSON.parse(fs.readFileSync('data/vce-cars-database-v20.json')),
  catalog: JSON.parse(fs.readFileSync('data/catalogue_voitures_circuits.json')),
  resources: JSON.parse(fs.readFileSync('data/ressources/coach-index-v1.json'))
};
const cases = [
  ['je sous vire en sortie', 'front'],
  ['ma voiture tire tout droit', 'front'],
  ['je souvire sur le vibreur', 'front'],
  ['le train avant glisse', 'front'],
  ['je perds l arriere au freinage', 'rear'],
  ['ma voiture part en tete a queue', 'rear'],
  ['elle survire quand je leve le pied', 'rear'],
  ['je bloque les roues au freinage', 'lock'],
  ['mes roues bloquent avec le frein', 'lock'],
  ['je freine trop tard', 'brake_late'],
  ['ma distance de freinage est trop longue', 'brake_late'],
  ['je freine trop tot et attends', 'brake_early'],
  ['comment faire le freinage degressif', 'trail'],
  ['explique le trail braking', 'trail'],
  ['a quoi sert l abs', 'abs'],
  ['mon ABS intervient beaucoup', 'abs'],
  ['comment regler le traction control', 'tc'],
  ['explique le controle de traction', 'tc'],
  ['ca patine quand j accelere', 'traction'],
  ['je manque de motricite', 'traction'],
  ['je saute sur les vibreurs', 'curb'],
  ['la voiture rebondit sur un kerb', 'bounce'],
  ['mes pneus sont trop chauds', 'tyre_hot'],
  ['j ai une surchauffe a l avant', 'tyre_hot'],
  ['comment chauffer les pneus', 'tyre_cold'],
  ['je roule avec des pneus froids', 'tyre_cold'],
  ['j use mes pneus trop vite', 'tyre_wear'],
  ['la degradation augmente en course', 'tyre_wear'],
  ['quelles pressions pneus a chaud', 'pressure'],
  ['combien de psi dans les pneus', 'pressure'],
  ['je suis lent sous la pluie', 'rain'],
  ['comment piloter sur piste humide', 'rain'],
  ['j ai de l aquaplaning', 'aquaplaning'],
  ['je perds la voiture dans une flaque', 'aquaplaning'],
  ['je veux travailler la regularite', 'consistency'],
  ['mes chronos varient beaucoup', 'consistency'],
  ['comment gagner du temps', 'pace'],
  ['je veux ameliorer mon temps', 'pace'],
  ['je rate la corde', 'apex'],
  ['comment choisir une trajectoire', 'apex'],
  ['j ai trop de volant a la corde', 'steering'],
  ['mes corrections volant sont enormes', 'steering'],
  ['je galere dans les virages lents', 'slow_corner'],
  ['comment passer une epingle', 'slow_corner'],
  ['je perds confiance en virage rapide', 'fast_corner'],
  ['comment gerer les courbes rapides', 'fast_corner'],
  ['je rate une chicane', 'chicane'],
  ['je galere dans un enchainement', 'chicane'],
  ['comment economiser du carburant', 'fuel'],
  ['je consomme trop d essence', 'fuel'],
  ['je veux apprendre a depasser', 'overtake'],
  ['je rate les depassements', 'overtake'],
  ['je n arrive pas a defendre', 'defense'],
  ['comment travailler la defense', 'defense'],
  ['je suis gene par le trafic', 'traffic'],
  ['je galere en multiclasse', 'traffic'],
  ['je fais trop de contacts', 'contact'],
  ['comment eviter un accrochage', 'contact'],
  ['je perds ma concentration', 'mental'],
  ['je panique sous pression', 'mental'],
  ['comment travailler le depart', 'start'],
  ['mon embrayage est difficile a gerer', 'start'],
  ['je rate mes retrogradages', 'gears'],
  ['quel rapport choisir', 'gears'],
  ['ma voiture talonne', 'bottoming'],
  ['le fond plat touche le sol', 'bottoming'],
  ['elle rebondit sur toute la courbe', 'bounce'],
  ['comment comprendre les amortisseurs', 'bounce'],
  ['je perds du temps aux stands', 'pit'],
  ['comment preparer un pitstop', 'pit'],
  ['je prends des penalites track limits', 'limits'],
  ['je depasse les limites de piste', 'limits'],
  ['comment comprendre mon setup', 'setup'],
  ['je ne comprends pas le differentiel', 'setup'],
  ['comment comparer des tours en telemetrie', 'telemetry'],
  ['comment analyser une video', 'telemetry'],
  ['je veux parler des pneus', 'tyres'],
  ['peux tu m aider sur interlagos', 'track'],
  ['je galere avec le freinage degressiff', 'trail']
];
const failures = cases.map(([question, expected]) => {
  const answer = engine.analyze(question, {}, data);
  return answer.conversation?.topicId === expected ? null :
    {question, expected, actual: answer.conversation?.topicId, paragraphs: answer.conversation?.paragraphs};
}).filter(Boolean);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
assert.equal(failures.length, 0, 'Known coaching questions should select the intended topic');
const first = engine.analyze('je sous vire au virage 2 a Interlagos en GT4', {}, data);
const retry = engine.analyze('j ai deja essaye, rien ne change', {}, data, first.context);
assert.equal(retry.conversation.topicId, 'front');
assert.match(retry.conversation.paragraphs.join(' '), /autre point/);
assert.notEqual(retry.conversation.paragraphs[1], first.conversation.paragraphs[1]);
const twice=engine.analyze('toujours pareil',{},data,retry.context);
assert.equal(twice.conversation.kind,'evidence');
assert.notEqual(twice.conversation.paragraphs[1],retry.conversation.paragraphs[1]);
const anotherTrack = engine.analyze('et maintenant a Monza en GT3', {}, data, first.context);
assert.equal(anotherTrack.context.cornerNumber, null);
assert.equal(anotherTrack.context.category, 'GT3');
const typoTrack = engine.analyze('je sousvire a Interlagoss en GT4', {}, data);
assert.match(typoTrack.context.trackLabel, /interlagos/i);
const negation=engine.analyze('je n ai pas de sous virage mais du survirage',{},data);
assert.equal(negation.conversation.topicId,'rear');
const phaseFollowup=engine.analyze('oui en sortie du virage',{},data,first.context);
assert.equal(phaseFollowup.conversation.topicId,'front');
const greeting = engine.analyze('salut', {}, data);
assert.equal(greeting.conversation.kind, 'greeting');
const unknown = engine.analyze('quel est le prix du bitcoin', {}, data);
assert.equal(unknown.conversation.supported, false);
console.log('PASS:', cases.length, 'topic questions, retries, circuit change, greetings and unsupported requests');

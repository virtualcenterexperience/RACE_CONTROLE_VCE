/* Offline DOM regression checks for reversible UI translation. No network or user data. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
for(const page of readdirSync('.').filter(name=>name.endsWith('.html')&&!name.startsWith('overlay-'))){
 assert.match(readFileSync(page,'utf8'),/assets\/js\/vce-i18n\.js\?v=20261123-language/,"Missing current language switch: "+page);
}
class TextNode {
 constructor(value){this.nodeType=3;this.nodeValue=value;this.parentElement=null;this.isConnected=true}
 get textContent(){return this.nodeValue}
}
class Element {
 constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs=new Map();this.dataset={};this.parentElement=null;this.isConnected=true;this.valueText=''}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.childNodes.push(node)}}
 get id(){return this.getAttribute('id')||''}set id(value){this.setAttribute('id',value)}
 get textContent(){return this.childNodes.map(x=>x.textContent).join('')}
 set textContent(value){this.childNodes=[];this.append(new TextNode(value))}
 get value(){return this.tagName==='OPTION'?(this.getAttribute('value')??this.textContent):this.valueText}
 set value(value){this.valueText=value}
 getAttribute(name){return this.attrs.get(name)??null}setAttribute(name,value){this.attrs.set(name,String(value))}hasAttribute(name){return this.attrs.has(name)}
 matches(selectors){return selectors.split(',').some(selector=>{
  selector=selector.trim();if(selector.startsWith('#'))return this.id===selector.slice(1);
  if(selector.startsWith('['))return this.hasAttribute(selector.slice(1,-1));
  if(selector==='.pilot-select b')return this.tagName==='B'&&this.parentElement?.matches('.pilot-select');
  if(selector.startsWith('.'))return selector.slice(1).split('.').every(cl=>(this.getAttribute('class')||'').split(' ').includes(cl));
  return this.tagName.toLowerCase()===selector;
 })}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null}
 querySelectorAll(selector){const descendants=[];function visit(el){for(const node of el.childNodes)if(node.nodeType===1){descendants.push(node);visit(node)}}visit(this);return descendants.filter(node=>selector==='#vce-language-switch button'?node.tagName==='BUTTON'&&node.closest('#vce-language-switch'):node.matches(selector))}
}
const root=new Element('html'),body=new Element('body');root.append(body);root.lang='fr';
function element(tag,text='',attrs={}){const el=new Element(tag);if(text)el.textContent=text;for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);body.append(el);return el}
const title=element('h1','TON PLAN DE PROGRESSION');
const long='Réponses extraites des fichiers de solutions VCE par recherche contextuelle. Ce n\'est pas un modèle IA génératif ni une lecture de télémétrie. Les hypothèses doivent être vérifiées en piste ou avec le coach.';
const paragraph=element('p',long),input=element('input','',{placeholder:'Rechercher un pilote...'});input.value='Freinage';
const textarea=element('textarea','Freinage'),user=element('span','Freinage',{class:'vce-user-content'});
const select=element('select'),option=new Element('option');option.textContent='Freinage';select.append(option);
const dynamic=element('p','Chargement des validations…');
const explicit=element('span','Texte de démonstration');explicit.dataset.en='Demo text';
let observer,blockedStorage=false;
const document={body,documentElement:root,title:'Entraînements | VCE ESPORT',readyState:'complete',
 createElement:tag=>new Element(tag),getElementById:id=>root.querySelectorAll('#'+id)[0]||null,
 querySelectorAll:selector=>root.querySelectorAll(selector),
 createTreeWalker:start=>{const texts=[];const visit=el=>{for(const node of el.childNodes||[]){if(node.nodeType===3)texts.push(node);else visit(node)}};visit(start);let i=0;return{currentNode:null,nextNode(){this.currentNode=texts[i++];return !!this.currentNode}}}
};
const storage=new Map(),location={search:'?lang=fr',href:'https://testing.invalid/training.html?lang=fr#report'};
const context={document,NodeFilter:{SHOW_TEXT:4},WeakMap,Map,Set,URL,URLSearchParams,location,history:{state:null,replaceState(_state,_title,url){location.href=url}},
 localStorage:{getItem:key=>storage.get(key),setItem(key,value){if(blockedStorage)throw Error('disabled');storage.set(key,value)}},
 requestAnimationFrame:fn=>fn(),CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},
 MutationObserver:class{constructor(callback){this.callback=callback;observer=this}observe(){this.active=true}disconnect(){this.active=false}},window:{dispatchEvent(){},addEventListener(){}}
};
runInNewContext(readFileSync('assets/js/vce-i18n.js','utf8'),context);
const buttons=document.getElementById('vce-language-switch').childNodes;
buttons[1].onclick();
assert.equal(root.lang,'en');assert.equal(title.textContent,'YOUR DEVELOPMENT PLAN');
assert.match(paragraph.textContent,/Answers are retrieved/,'Paragraphs longer than 210 characters must translate');
assert.equal(input.getAttribute('placeholder'),'Search for a driver…');assert.equal(input.value,'Freinage');
assert.equal(textarea.textContent,'Freinage');assert.equal(user.textContent,'Freinage');
assert.equal(option.textContent,'Braking');assert.equal(option.value,'Freinage','Translating a label must not change its submitted option value');
assert.equal(explicit.textContent,'Demo text');assert.equal(storage.get('vce_language'),'en');assert.match(location.href,/#report$/);
dynamic.childNodes[0].nodeValue='ENTRAÎNEMENTS ATTRIBUÉS';
observer.callback([{type:'characterData',target:dynamic.childNodes[0]}]);
assert.equal(dynamic.textContent,'ASSIGNED TRAINING','Existing text node updates must be observed');
buttons[0].onclick();assert.equal(root.lang,'fr');assert.equal(title.textContent,'TON PLAN DE PROGRESSION');assert.equal(paragraph.textContent,long);assert.equal(option.textContent,'Freinage');assert.equal(option.value,'Freinage');assert.equal(explicit.textContent,'Texte de démonstration');assert.equal(input.value,'Freinage');
blockedStorage=true;buttons[1].onclick();assert.equal(root.lang,'en','Language switching must still work when storage is unavailable');
console.log('PASS: FR/EN/FR, long paragraphs, dynamic text, attributes, protected user text, stable option values and unavailable storage.');

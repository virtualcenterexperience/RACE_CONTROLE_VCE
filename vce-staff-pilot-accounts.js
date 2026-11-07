/* VCE STAFF — pilot login provisioning. Credential shown once; never persisted in browser. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const prefix='vce-pilot-provision-';
let accounts=new Map(),pilots=[],busy=false,lastCode='';
function node(name){return $(prefix+name)}
async function api(action,pilot_slug){
 const auth=await window.VCESupabase?.validSession();
 if(!auth?.access_token)throw Error('Session STAFF expirée. Reconnecte-toi.');
 const c=window.VCE_SUPABASE;
 if(!c?.url||!c?.key)throw Error('Configuration Supabase indisponible');
 const response=await fetch(c.url+'/functions/v1/vce-telemetry',{
  method:'POST',cache:'no-store',
  headers:{apikey:c.key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({action,pilot_slug})
 });
 const data=await response.json().catch(()=>({error:'Réponse serveur illisible'}));
 if(!response.ok||data.error)throw Error(data.error||'Erreur HTTP '+response.status);
 return data
}
function message(s,error=false){
 node('message').textContent=s;
 node('message').dataset.error=String(error)
}
function clearCode(){
 lastCode='';
 node('result').textContent='';
 node('credentials').hidden=true;
 node('copy').disabled=true
}
function selected(){
 const id=node('select').value;
 return {id,exists:accounts.has(id),account:accounts.get(id)}
}
function update(){
 const {id,exists,account}=selected();
 node('create').textContent=exists?'GÉNÉRER UN NOUVEAU CODE':'CRÉER LE COMPTE';
 node('create').disabled=busy||!id;
 node('reset').disabled=busy||!id||!exists;
 node('refresh').disabled=busy;
 node('select').disabled=busy;
 node('help').textContent=!id?'Choisis un pilote dans la liste.'
   :exists?'Ce compte existe déjà'+(account?.active===false?' (désactivé)':'')+
      '. Un nouveau code remplace son ancien mot de passe. Son historique reste conservé.'
   :'Ce profil n’a pas encore de compte : CRÉER produit son premier code de connexion.'
}
async function refresh(options={}){
 const data=await api('staff_pilot_accounts');
 if(!Array.isArray(data.accounts))throw Error('Liste des comptes non reçue');
 accounts=new Map(data.accounts.filter(a=>a?.pilot_slug).map(a=>[a.pilot_slug,a]));
 const active=[...accounts.values()].filter(x=>x.active!==false).length;
 node('status').textContent=active+' compte(s) actif(s) · '+accounts.size+' compte(s) créé(s)';
 update();
 if(!options.silent)message('Liste synchronisée avec Supabase.')
}
function showCode(id,data){
 if(data?.ok!==true||typeof data.temporary_password!=='string'||!data.temporary_password||
    typeof data.identifier!=='string'||!data.identifier){
  throw Error('Le serveur n’a pas retourné de code provisoire valide.');
 }
 const name=pilots.find(x=>x.id===id)?.name||id;
 lastCode=data.temporary_password;
 node('result').textContent='Pilote : '+name+'\nIdentifiant : '+data.identifier+
    '\nCode provisoire : '+data.temporary_password+
    '\nÀ changer lors de la première connexion.';
 node('credentials').hidden=false;
 node('copy').disabled=false;
 node('credentials').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function provision(forceReset=false){
 const {id,exists}=selected();
 if(busy||!id)return;
 const reset=forceReset||exists;
 if(forceReset&&!exists){message('Ce pilote n’a pas de compte à réinitialiser.',true);return}
 const name=pilots.find(x=>x.id===id)?.name||id;
 const question=reset
  ?'Générer un NOUVEAU code pour '+name+' ?\n\nCela remplace immédiatement son ancien mot de passe. Il devra se reconnecter et changer le code provisoire. Les tours et résultats sont conservés.'
  :'Créer le compte de '+name+' et générer son premier code provisoire ?';
 if(!confirm(question))return;
 busy=true;update();clearCode();message(reset?'Génération du nouveau code…':'Création du compte et du code…');
 try{
  const data=await api(reset?'staff_reset_pilot':'staff_provision_pilot',id);
  showCode(id,data);
  try{await refresh({silent:true})}
  catch(e){console.warn('Liste des comptes non actualisée',e)}
  message('✓ Code provisoire généré pour '+name+'. Copie-le et transmets-le uniquement à ce pilote.');
 }catch(e){
  message('Impossible de générer le code : '+e.message,true);
 }finally{busy=false;update()}
}
async function copyCode(){
 if(!lastCode)return;
 try{
  await navigator.clipboard.writeText(lastCode);
  message('✓ Code copié. Transmets-le au pilote par un canal privé.');
 }catch{
  message('Copie automatique impossible : sélectionne le code affiché et copie-le manuellement.',true)
 }
}
async function init(){
 const host=$('work');if(!host)return;
 const section=document.createElement('section');section.className='panel vce-provision-panel';
 section.innerHTML='<h2>ACCÈS PILOTES · COMPTES SUPABASE</h2>'+
  '<p class="muted">Sélectionne un pilote pour créer son accès ou générer un nouveau code provisoire.</p>'+
  '<p id="vce-pilot-provision-status" role="status">Vérification…</p>'+
  '<div class="vce-provision-controls"><select id="vce-pilot-provision-select" aria-label="Sélection du pilote"></select>'+
  '<button type="button" id="vce-pilot-provision-create">CRÉER LE COMPTE</button>'+
  '<button type="button" id="vce-pilot-provision-reset">RÉINITIALISER</button>'+
  '<button type="button" id="vce-pilot-provision-refresh">ACTUALISER</button></div>'+
  '<p id="vce-pilot-provision-help" class="muted"></p>'+
  '<p id="vce-pilot-provision-message" class="muted" role="status" aria-live="polite"></p>'+
  '<div id="vce-pilot-provision-credentials" hidden>'+
  '<strong>CODE PROVISOIRE · À TRANSMETTRE EN PRIVÉ</strong>'+
  '<pre id="vce-pilot-provision-result"></pre>'+
  '<button type="button" id="vce-pilot-provision-copy" disabled>COPIER LE CODE</button>'+
  '<small>Ce code est affiché uniquement après sa génération. Il n’est pas conservé dans la page après rechargement.</small>'+
  '</div>';
 host.prepend(section);
 node('create').addEventListener('click',()=>provision(false));
 node('reset').addEventListener('click',()=>provision(true));
 node('refresh').addEventListener('click',async()=>{
  if(busy)return;busy=true;update();
  try{await refresh()}catch(e){message('Actualisation impossible : '+e.message,true)}
  finally{busy=false;update()}
 });
 node('copy').addEventListener('click',copyCode);
 node('select').addEventListener('change',()=>{clearCode();message('');update()});
 clearCode();update();
 try{
  if(!await window.VCESupabase?.isStaff())throw Error('Connexion STAFF autorisée requise.');
  let list;
  try{
   list=await api('staff_roster_list');
  }catch(e){
   list={items:(await VCESupabase.read('pilotes')).items};
  }
  if(!Array.isArray(list.items))throw Error('Liste des pilotes indisponible');
  pilots=list.items.filter(x=>x&&x.id&&x.name);
  const select=node('select');select.replaceChildren(new Option('— Sélectionner un pilote —',''));
  pilots.forEach(p=>select.add(new Option(p.name,p.id)));
  await refresh();
 }catch(e){message('Chargement des comptes impossible : '+e.message,true)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
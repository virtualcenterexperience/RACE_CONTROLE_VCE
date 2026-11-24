/* STAFF-only configuration. The webhook stays in Vault and is never returned. */
(()=>{'use strict';
const staffPage=document.body.dataset.vceResultsMode==='staff',mount=document.getElementById('overview');
if(!staffPage&&!mount)return;
const panel=document.createElement('details');panel.hidden=true;panel.id='vceDiscordResultsSettings';panel.className=staffPage?'vce-race-panel':'rc-discord-settings';
panel.innerHTML='<summary>Notifications Discord · Résultats</summary><p>Chaque nouveau résultat envoyé par un pilote déclenche une notification dans le salon du STAFF. La validation reste obligatoire.</p><form><label for="resultsDiscordWebhook">Webhook du salon STAFF · Résultats</label><input id="resultsDiscordWebhook" type="password" autocomplete="new-password" placeholder="https://discord.com/api/webhooks/…" required><p>Seul le STAFF peut enregistrer ce lien. Il est conservé côté serveur et ne sera pas réaffiché.</p><button type="submit" disabled>Enregistrer le salon des résultats</button></form><p role="status" aria-live="polite"></p>';
if(mount)mount.after(panel);else document.querySelector('main').append(panel);
const form=panel.querySelector('form'),input=panel.querySelector('input'),button=panel.querySelector('button'),status=panel.querySelector('[role=status]');
let generation=0,busy=false;
function reset(){generation++;panel.hidden=true;panel.open=false;input.value='';button.disabled=true;status.textContent=''}
async function config(webhook=null){
 const auth=window.VCESupabase;
 if(!await auth?.isStaff())throw Error('Accès STAFF requis');
 const session=await auth.validSession(),cfg=window.VCE_SUPABASE;
 if(!session?.access_token)throw Error('Session STAFF absente');
 const response=await fetch(cfg.url+'/rest/v1/rpc/vce_discord_results_config',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(14000),headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_webhook:webhook})});
 if(!response.ok)throw Error('Configuration refusée (HTTP '+response.status+').');
 return response.json();
}
async function check(){const seq=++generation;try{
 if(!await window.VCESupabase?.isStaff()){if(seq===generation)reset();return}
 const result=await config();if(seq!==generation)return;
 panel.hidden=false;button.disabled=false;status.textContent=result.configured?'Salon enregistré · notifications activées pour les prochains résultats.':'Ajoute le webhook du salon STAFF pour activer les notifications de résultats.';
}catch(error){if(seq===generation){reset()}}}
form.addEventListener('submit',async event=>{event.preventDefault();if(busy||button.disabled)return;
 const webhook=input.value.trim();if(!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(webhook)){status.textContent='Utilise une URL de webhook Discord valide.';return}
 busy=true;button.disabled=true;const seq=generation;
 try{await config(webhook);if(seq===generation){input.value='';status.textContent='Salon des résultats enregistré. Les prochains envois de pilotes seront notifiés.'}}
 catch(error){if(seq===generation)status.textContent=error.message}
 finally{busy=false;if(seq===generation)button.disabled=false}
});
window.addEventListener('vce-auth-session-ended',reset);window.addEventListener('vce-staff-logged-out',reset);window.addEventListener('vce-staff-authenticated',check);
check();
})();

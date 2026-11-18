(() => {
  'use strict';
  const mount = document.getElementById('overview');
  if (!mount) return;
  const panel = document.createElement('details');
  panel.className = 'rc-discord-settings';
  panel.innerHTML = '<summary>Notifications Discord · Entraînements</summary><p>Lorsqu’un pilote envoie une séance, le salon reçoit son nom, le circuit, la voiture et l’exercice, avec un lien vers les validations.</p><form><label for="trainingDiscordWebhook">Webhook du salon Discord</label><input id="trainingDiscordWebhook" type="password" autocomplete="new-password" placeholder="https://discord.com/api/webhooks/…" required><p>Dans Discord, ouvre les paramètres du salon → Intégrations → Webhooks. Copie son URL ici.</p><button type="submit">Enregistrer le salon</button></form><p role="status">Configuration disponible après connexion STAFF.</p>';
  mount.after(panel);
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const output = panel.querySelector('[role="status"]');
  let checking = false;
  async function status() {
    if (checking || !window.VCESupabase?.session()) return;
    checking = true;
    try {
      const result = await VCESupabase.discordTrainingConfig();
      output.textContent = result.configured ? 'Salon configuré. Notifications actives pour les prochains envois.' :
        'Ajoute le webhook du salon pour activer les notifications.';
    } catch (error) {
      output.textContent = 'Configuration inaccessible. Connecte-toi avec un compte STAFF.';
    } finally {
      checking = false;
    }
  }
  panel.addEventListener('toggle', () => { if (panel.open) status(); });
  window.addEventListener('vce-staff-authenticated', status);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await VCESupabase.discordTrainingConfig(input.value.trim());
      input.value = '';
      output.textContent = 'Salon enregistré. Les prochains envois de séance déclencheront une notification.';
    } catch (error) {
      output.textContent = 'Enregistrement impossible. Vérifie l’URL et ton accès STAFF.';
    } finally {
      button.disabled = false;
    }
  });
  window.addEventListener('vce-staff-logged-out', () => {
    panel.open = false;
    input.value = '';
    output.textContent = 'Configuration disponible après connexion STAFF.';
  });
})();

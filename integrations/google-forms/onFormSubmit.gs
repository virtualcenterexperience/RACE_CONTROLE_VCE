/**
 * VCE ESPORT — Google Sheets: notification de candidature reçue.
 * À installer dans la FEUILLE DE RÉPONSES liée au Google Forms.
 * Déclencheur INSTALLABLE : vceOnFormSubmit / Depuis feuille de calcul /
 *                         Lors de l'envoi du formulaire.
 *
 * Propriétés de script : VCE_WEBHOOK_SECRET = secret généré dans STAFF CONTROL.
 * Le secret ne doit pas être enregistré dans les fichiers publics du dépôt.
 * AUCUNE réponse nominative ou adresse e-mail n'est transmise.
 */
function vceOnFormSubmit(e) {
  if (!e || !e.range || !e.source) {
    throw new Error('Cette fonction doit être lancée par un déclencheur installable Google Sheets / envoi de formulaire.');
  }
  var secret = PropertiesService.getScriptProperties().getProperty('VCE_WEBHOOK_SECRET');
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
    throw new Error('VCE_WEBHOOK_SECRET absent ou invalide dans les propriétés du script.');
  }

  // Déduplication stable. Pas de noms, de téléphones ni de réponses à envoyer.
  var sheet = e.range.getSheet();
  var eventId = 'sheet-' + String(e.source.getId()) +
    '-tab-' + String(sheet.getSheetId()) +
    '-row-' + String(e.range.getRow());

  var endpoint = 'https://jitrxizvzamimbvfzuri.supabase.co/functions/v1/vce-applications';
  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-vce-hook-secret': secret },
    payload: JSON.stringify({
      action: 'ingest',
      event_id: eventId,
      submitted_at: new Date().toISOString()
    }),
    muteHttpExceptions: true,
    followRedirects: false
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    // Apps Script signale l'échec au propriétaire pour qu'il puisse le corriger.
    throw new Error('Notification VCE impossible : HTTP ' + code +
      '. Vérifiez le secret et les journaux de la fonction vce-applications.');
  }
}

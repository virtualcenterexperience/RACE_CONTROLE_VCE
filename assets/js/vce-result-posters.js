/* Private TEAM result posters shared by the studio and pilot profiles. */
(() => {
  'use strict';
  const bucket = 'vce-result-posters';
  const table = '/rest/v1/vce_result_posters';
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const idPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

  async function request(path, options = {}) {
    const { url, key } = window.VCE_SUPABASE;
    const session = await window.VCESupabase.validSession();
    if (!session?.access_token) throw new Error('Session expirée. Reconnecte-toi.');
    return fetch(url + path, {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
      headers: { apikey: key, Authorization: 'Bearer ' + session.access_token, ...options.headers }
    });
  }

  async function checked(response) {
    if (response.ok) return response;
    throw new Error('Serveur des affiches · HTTP ' + response.status);
  }

  function imagePath(id, authenticated = false) {
    if (!idPattern.test(id)) throw new Error('Identifiant d’affiche invalide.');
    return '/storage/v1/object/' + (authenticated ? 'authenticated/' : '') + bucket + '/' + id + '.png';
  }

  async function list(pilot, offset = 0, limit = 24) {
    const params = new URLSearchParams({
      select: 'id,title,mode,pilot_slugs,published,created_at',
      order: 'created_at.desc,id.desc',
      limit: String(limit),
      offset: String(offset)
    });
    if (pilot) {
      if (!slugPattern.test(pilot)) return [];
      params.set('published', 'eq.true');
      params.set('pilot_slugs', 'cs.{' + pilot + '}');
    }
    return (await checked(await request(table + '?' + params))).json();
  }

  async function image(id) {
    return (await checked(await request(imagePath(id, true)))).blob();
  }

  async function save(poster, blob) {
    if (!await window.VCESupabase.isStaff()) throw new Error('Connexion Staff requise.');
    if (blob.size > 12 * 1024 * 1024) throw new Error('Le PNG dépasse 12 Mo.');
    const response = await request(imagePath(poster.id), {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' },
      body: blob
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      if (response.status !== 409 && String(detail.statusCode) !== '409' && detail.error !== 'Duplicate') {
        throw new Error('Envoi du PNG impossible · HTTP ' + response.status);
      }
      // A previous upload may have succeeded before its response reached the browser.
      await image(poster.id);
    }
    await checked(await request(table + '?on_conflict=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(poster)
    }));
  }

  async function publishArchived(id) {
    if (!idPattern.test(id)) throw new Error('Identifiant d’affiche invalide.');
    if (!await window.VCESupabase.isStaff()) throw new Error('Connexion Staff requise.');
    await image(id);
    const response = await checked(await request(table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ published: true })
    }));
    if (!(await response.json()).length) throw new Error('Affiche introuvable.');
  }

  window.VCEResultPosters = { list, image, save, publishArchived };
})();

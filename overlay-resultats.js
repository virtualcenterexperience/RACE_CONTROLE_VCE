/* VCE ESPORT — overlay de résultats et export Full HD. */
'use strict';

const KEY = 'vce_resultats_v2';
const $ = id => document.getElementById(id);

function fit() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  const stage = $('stage');
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(innerWidth - 1920 * scale) / 2}px`;
  stage.style.top = `${(innerHeight - 1080 * scale) / 2}px`;
}

function niceDate(value) {
  const parts = String(value || '').split('-');
  return parts.length === 3 ? parts.reverse().join('/') : String(value || '');
}

function node(className, text = '') {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

function render() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const teamMode = ['endurance', 'equipe', 'team'].includes(data.mode);
  const results = Array.isArray(data.results) ? data.results : [];
  const rows = results.filter(Boolean).sort((a, b) => (+a.position || Infinity) - (+b.position || Infinity)).slice(0, 10);

  $('event').textContent = data.event || 'CHAMPIONNAT';
  $('date').textContent = [niceDate(data.date), data.circuit].filter(Boolean).join(' · ') || 'DATE DE COURSE';
  $('season').textContent = 'SAISON ' + (data.season || '2026');
  $('mode').textContent = teamMode ? 'CLASSEMENT ÉQUIPAGES' : data.mode === 'championnat' ? 'CHAMPIONNAT' : 'CLASSEMENT PILOTES';

  const board = $('board');
  board.replaceChildren();
  board.classList.toggle('is-solo', rows.length === 1 && !teamMode);
  board.classList.toggle('is-dense', rows.length > 5);
  if (!rows.length) {
    const empty = node('empty');
    empty.append(node('empty-mark', '—'), node('empty-title', 'En attente des résultats'),
      node('empty-copy', 'Le classement s’affichera dès qu’un résultat sera saisi.'));
    board.append(empty);
    return;
  }

  rows.forEach((row, index) => {
    const drivers = Array.isArray(row.drivers) ? row.drivers.filter(Boolean) : [];
    const pilot = [row.firstName, row.lastName].filter(Boolean).join(' ') || drivers[0];
    const name = teamMode ? row.team || pilot || 'Équipage' : pilot || 'Pilote';
    const position = +row.position || index + 1;
    const result = node('result');
    result.classList.toggle('is-first', position === 1);
    result.append(node('rank', 'P' + position));

    const portrait = node('portrait');
    const photo = [row.photo, row.photoUrl, row.image, row.imageUrl, row.portrait].find(value =>
      typeof value === 'string' && /^(https?:|data:image\/|blob:|(\.\/)?(?:data|images|assets)\/)/i.test(value));
    const initials = node('initials', name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join(''));
    if (photo) {
      const image = document.createElement('img');
      image.alt = '';
      image.onerror = () => image.replaceWith(initials);
      image.src = photo;
      portrait.append(image);
    } else {
      portrait.append(initials);
    }

    const content = node('result-content');
    const detail = teamMode && drivers.length ? drivers.join(' · ') : row.team || '';
    content.append(node('result-name', name), node('result-detail', detail));
    const car = [row.number ? '#' + row.number : '', row.brand].filter(Boolean).join(' · ');
    const meta = node('result-meta');
    meta.append(node('result-car', car));
    if (row.score != null && row.score !== '') meta.append(node('result-score', String(row.score)));
    result.append(portrait, content, meta);
    board.append(result);
  });
}

addEventListener('resize', fit);
addEventListener('storage', event => { if (event.key === KEY) render(); });
render();
fit();

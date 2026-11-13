import { decodeTga } from './vce-results-tga.js?v=1';

const $ = id => document.getElementById(id);
const form = $('result-form');
const field = name => form.elements.namedItem(name);
const canvas = $('poster');
const ctx = canvas.getContext('2d');
let W = canvas.width;
let H = canvas.height;
let exampleBackground = null;
let defaultPhotoReady;
const formats = {
  social: { width: 1080, height: 1350, layout: {
    vce: [66, 55, 26, 400], mode: [67, 129, 29, 950], event: [62, 177, 91, 950],
    details: [67, 290, 26, 950], position: [56, 344, 232, 580], brand: [67, 1294, 18, 940]
  }},
  landscape: { width: 1920, height: 1090, layout: {
    vce: [80, 57, 30, 500], mode: [80, 143, 30, 980], event: [75, 188, 103, 1180],
    details: [80, 312, 31, 1200], position: [80, 372, 226, 530], brand: [80, 1034, 20, 800]
  }}
};
const photoFrame = { zoom: 1, x: .5, y: .5 };
const condensed = 'Impact, "Arial Narrow", "DejaVu Sans Condensed", Arial, sans-serif';
const palettes = {
  red: { base: '#071527', accent: '#ff355b', blue: '#1b62bf', neutral: '#111c2e' },
  yellow: { base: '#06172e', accent: '#ffce35', blue: '#1667d4', neutral: '#102541' },
  gray: { base: '#161c27', accent: '#ff3f56', blue: '#3a79c8', neutral: '#414c5c' }
};
const modes = { solo: 'RÉSULTAT SOLO', championnat: 'CHAMPIONNAT', endurance: 'ENDURANCE' };
const state = { roster: [], manifest: {}, drivers: [], layers: [], selected: null, background: null, archived: null, offset: 0, view: null };
const portraits = new Map();
const imageTypes = ['png', 'webp', 'jpg', 'jpeg', 'tga'];
const urlPool = new Set();

function element(tag, text, properties = {}) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  Object.assign(node, properties);
  return node;
}
function option(value, label) {
  return element('option', label, { value: String(value) });
}
function label(title, input) {
  const node = element('label', title);
  node.append(input);
  return node;
}
function status(message) {
  $('edit-status').textContent = message;
}
function changed() {
  state.archived = null;
  draw();
}
function clip(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function data() {
  return Object.fromEntries(['mode','event','circuit','date','number','position'].map(key => [key, field(key).value.trim()]));
}
function normalizedDate(date) {
  return date ? new Date(date + 'T12:00:00').toLocaleDateString('fr-FR') : '';
}
function driverName(driver) {
  return state.roster.find(p => p.id === driver.id)?.name || '';
}
function firstName(driver) {
  const p = state.roster.find(p => p.id === driver.id);
  return p?.first_name || p?.firstName || (p?.id === 'maldonado-marius' ? 'Marius' : p?.name.trim().split(/\s+/)[0]) || '';
}
function sourceText(layer, d) {
  if (layer.text !== null) return layer.text;
  const driver = layer.driver === undefined ? null : state.drivers[layer.driver];
  if (driver) {
    return layer.field === 'name' ? firstName(driver).toUpperCase() || 'PILOTE ' + (layer.driver + 1) : driver.nation.toUpperCase();
  }
  const values = {
    event: d.event.toUpperCase() || 'NOM DE L’ÉPREUVE',
    position: d.position ? 'P' + d.position : 'P–',
    details: [d.circuit, normalizedDate(d.date), d.number && 'VOITURE #' + d.number].filter(Boolean).join('  /  '),
    mode: modes[d.mode]
  };
  return values[layer.id] || '';
}
function makeLayer(id, text, x, y, size, weight = 800, color = '#f4f7fb') {
  return { id, text, x, y, size, weight, color, customColor: false };
}
state.layers = [
  makeLayer('vce', 'VCE ESPORT', 0, 0, 0, 900),
  makeLayer('mode', null, 0, 0, 0),
  { ...makeLayer('event', null, 0, 0, 0, 900), display: true },
  makeLayer('details', null, 0, 0, 0, 700),
  { ...makeLayer('position', null, 0, 0, 0, 950), display: true },
  makeLayer('brand', 'VIRTUAL CENTER EXPERIENCE', 0, 0, 0, 750, '#b6c8dd')
];
state.selected = null;

function syncLayerPlacement(layer, x, y, size, width) {
  if (layer.autoX === undefined || layer.x === layer.autoX) layer.x = x;
  if (layer.autoY === undefined || layer.y === layer.autoY) layer.y = y;
  if (layer.autoSize === undefined || layer.size === layer.autoSize) layer.size = size;
  Object.assign(layer, { autoX: x, autoY: y, autoSize: size, maxWidth: width });
}

function setFormat(key) {
  const { width, height, layout } = formats[key];
  const scaleX = width / W;
  const scaleY = height / H;
  for (const layer of state.layers) {
    if (layer.x !== layer.autoX) layer.x = Math.round(layer.x * scaleX);
    if (layer.y !== layer.autoY) layer.y = Math.round(layer.y * scaleY);
    if (layout[layer.id]) syncLayerPlacement(layer, ...layout[layer.id]);
  }
  W = canvas.width = width;
  H = canvas.height = height;
  canvas.style.setProperty('--preview-width', Math.round(760 * W / H) + 'px');
  $('poster-dimension').textContent = W + ' × ' + H + ' px';
  $('layer-x').max = W - 1;
  $('layer-y').max = H - 1;
  syncDriverLayers(state.drivers.length);
  refreshLayers();
  changed();
}

function drawCover(image, x, y, w, h, { x: alignX = .5, y: alignY = .5, zoom = 1 } = {}) {
  const scale = Math.max(w / image.width, h / image.height) * zoom;
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, x + (w - dw) * alignX, y + (h - dh) * alignY, dw, dh);
  ctx.restore();
}
function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}
function driverBox(i, n) {
  const vertical = W < H;
  const columns = vertical ? Math.min(n, 3) : n;
  const gap = 12;
  const inset = vertical ? 66 : 80;
  const w = Math.min(440, (W - 2 * inset - (columns - 1) * gap) / columns);
  const h = vertical ? 82 : 104;
  const rows = Math.ceil(n / columns);
  const bottom = vertical ? 1254 : 1002;
  return { x: inset + (i % columns) * (w + gap), y: bottom - rows * (h + gap) + Math.floor(i / columns) * (h + gap), w, h };
}
function portraitsEnabled() {
  return $('show-portraits').checked;
}
function drawDriver(driver, i, n, palette) {
  const { x, y, w, h } = driverBox(i, n);
  const hasPortrait = portraitsEnabled() && Boolean(driver.image);
  ctx.fillStyle = '#080f1cd9';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x, y, w, 3);
  if (hasPortrait) drawCover(driver.image, x + 4, y + 7, h - 13, h - 13, { y: .27 });
}
function draw(editing = true) {
  const d = data();
  const palette = palettes[$('palette').value];
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, W, H);
  const vertical = W < H;
  const background = state.background || exampleBackground;
  if (background) drawCover(background, 0, 0, W, H, state.background ? photoFrame : { x: .5, y: vertical ? .5 : .64 });
  const edge = ctx.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, '#050913e0');
  edge.addColorStop(.31, '#05091360');
  edge.addColorStop(.62, '#05091300');
  edge.addColorStop(.83, '#05091338');
  edge.addColorStop(1, '#050913f9');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  const side = ctx.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, palette.base + (vertical ? '32' : 'd9'));
  side.addColorStop(.55, palette.base + '14');
  side.addColorStop(1, palette.base + '00');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, W, H);
  polygon([[W-220,0],[W,0],[W,187]], palette.blue + '9c');
  polygon([[W-114,0],[W-89,0],[W,82],[W,108]], palette.accent);
  polygon([[0,H-179],[150,H],[0,H]], palette.neutral + '88');
  ctx.fillStyle = palette.accent;
  ctx.fillRect(vertical ? 67 : 80, vertical ? 104 : 112, 71, 5);
  ctx.fillRect(vertical ? 67 : 80, H - 80, W - (vertical ? 134 : 160), 2);
  state.drivers.forEach((driver, i) => drawDriver(driver, i, state.drivers.length, palette));
  state.layers.forEach(layer => {
    const content = sourceText(layer, d).split('\n');
    const width = Math.max(1, Math.min(layer.maxWidth ?? W, W - layer.x - 10));
    const weight = layer.weight >= 800 ? 'bold' : 'normal';
    ctx.font = weight + ' ' + layer.size + 'px ' + (layer.display ? condensed : 'Arial, sans-serif');
    ctx.shadowColor = '#020710d9';
    ctx.shadowBlur = layer.display ? 20 : 5;
    ctx.fillStyle = !layer.customColor && ['position','mode'].includes(layer.id) ? palette.accent : layer.color;
    const widths = content.map(line => ctx.measureText(line).width);
    content.forEach((line, i) => {
      if (!line) return;
      ctx.save();
      ctx.translate(layer.x, layer.y + i * layer.size * 1.12);
      ctx.scale(Math.min(1, width / Math.max(1, widths[i])), 1);
      ctx.fillText(line, 0, 0);
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    layer.box = {
      w: Math.min(width, Math.max(32, ...widths)),
      h: content.length * layer.size * 1.12
    };
    if (editing && layer.id === state.selected) {
      ctx.strokeStyle = '#d2e8ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(layer.x - 5, layer.y - 5, layer.box.w + 10, layer.box.h + 10);
      ctx.setLineDash([]);
    }
  });
}

async function fromFile(blob, name) {
  if (blob.size > 30 * 1024 * 1024) throw new Error('Image supérieure à 30 Mo.');
  return /\.tga$/i.test(name) ? decodeTga(blob) : createImageBitmap(blob, { imageOrientation: 'from-image' });
}
async function fromPath(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Photo introuvable.');
  return fromFile(await response.blob(), path);
}
async function defaultPortrait(id, number) {
  for (const ext of imageTypes) {
    const path = 'data/images/pilotes/' + id + '/' + number + '.' + ext;
    try { return await fromPath(path); } catch {}
  }
  return null;
}
function listPortraits(id) {
  if (!portraits.has(id)) {
    const listed = state.manifest[id];
    const tasks = [1, 2].map(number => {
      const path = Array.isArray(listed) ? listed[number - 1] : null;
      if (typeof path === 'string' && /^data\/[\w./ -]+\.(?:png|webp|jpe?g|tga)$/i.test(path) && !path.split('/').includes('..')) {
        return fromPath(path).catch(() => defaultPortrait(id, number));
      }
      return defaultPortrait(id, number);
    });
    portraits.set(id, Promise.all(tasks));
  }
  return portraits.get(id);
}
function showRecipients() {
  const names = state.drivers.map(driverName).filter(Boolean);
  $('audience').textContent = names.length ? 'Profils destinataires · ' + names.join(', ') : 'Sélectionne les pilotes destinataires.';
}
const removedDriverLayers = new Set();
function syncDriverLayers(count) {
  state.layers = state.layers.filter(layer => layer.driver === undefined || layer.driver < count);
  for (let i = 0; i < count; i++) {
    const { x, y, w } = driverBox(i, count);
    const inset = portraitsEnabled() && state.drivers[i].image ? (W < H ? 80 : 103) : 16;
    for (const [key, top, size, weight, color] of [
      ['name', y + 14, W < H ? 29 : 36, 850, '#ffffff'],
      ['nation', y + (W < H ? 54 : 68), W < H ? 17 : 20, 650, '#c9daed']
    ]) {
      const id = 'driver-' + i + '-' + key;
      if (removedDriverLayers.has(id)) continue;
      let layer = state.layers.find(item => item.id === id);
      if (!layer) {
        layer = { ...makeLayer(id, null, x + inset, top, size, weight, color), driver: i, field: key };
        state.layers.push(layer);
      }
      syncLayerPlacement(layer, x + inset, top, size, w - inset - 14);
    }
  }
  if (state.selected && !state.layers.some(layer => layer.id === state.selected)) state.selected = null;
}
function buildDrivers() {
  const count = Number(field('count').value);
  state.drivers.length = Math.min(state.drivers.length, count);
  while (state.drivers.length < count) state.drivers.push({ id: '', nation: '', photo: 0, image: null });
  syncDriverLayers(count);
  const root = $('drivers');
  root.replaceChildren();
  root.classList.toggle('with-portraits', Boolean(portraitsEnabled()));
  state.drivers.forEach((driver, i) => {
    const row = element('div', null, { className: 'driver' });
    const select = element('select', null, { required: true });
    select.append(option('', 'Choisir un pilote'), ...state.roster.map(p => option(p.id, p.name)));
    select.value = driver.id;
    const nation = element('input', null, { required: true, maxLength: 32, placeholder: 'France', value: driver.nation });
    const photo = element('select');
    let request = 0;
    async function updatePhotos() {
      const current = ++request;
      photo.disabled = true;
      photo.replaceChildren(option('', driver.id ? 'Recherche des photos…' : 'Aucun pilote sélectionné'));
      driver.loading = portraitsEnabled() && Boolean(driver.id);
      if (!driver.loading) return;
      const choices = await listPortraits(driver.id);
      if (current !== request || !row.isConnected) return;
      driver.loading = false;
      const available = choices.flatMap((image, index) => image ? [option(index, 'Photo ' + (index + 1))] : []);
      photo.replaceChildren(option(-1, 'Sans portrait'), ...available);
      if (driver.photo !== -1 && !choices[driver.photo]) driver.photo = choices.findIndex(Boolean);
      photo.value = String(driver.photo);
      driver.image = choices[driver.photo] || null;
      photo.disabled = !available.length;
      photo.onchange = () => {
        driver.photo = Number(photo.value);
        driver.image = choices[driver.photo] || null;
        syncDriverLayers(count);
        refreshLayers();
        changed();
      };
      syncDriverLayers(count);
      refreshLayers();
      draw();
    }
    select.onchange = () => {
      driver.id = select.value;
      driver.image = null;
      driver.photo = 0;
      updatePhotos();
      syncDriverLayers(count);
      showRecipients();
      refreshLayers();
      changed();
    };
    nation.oninput = () => { driver.nation = nation.value.trim(); refreshLayers(); changed(); };
    row.append(label('Pilote ' + (i + 1), select), label('Nationalité', nation));
    if (portraitsEnabled()) row.append(label('Portrait', photo));
    root.append(row);
    updatePhotos();
  });
  showRecipients();
}
function modeChanged() {
  const solo = field('mode').value === 'solo';
  field('count').disabled = solo;
  if (solo) field('count').value = '1';
  buildDrivers();
  changed();
}

function refreshLayers() {
  const d = data();
  $('layers').replaceChildren(...state.layers.map(layer => option(layer.id, sourceText(layer, d).trim().slice(0, 45) || (layer.field === 'nation' ? 'Nationalité pilote ' + (layer.driver + 1) : 'Texte vide'))));
  $('layers').value = state.selected || '';
  const selected = state.layers.find(layer => layer.id === state.selected);
  $('layer-fields').hidden = !selected;
  $('remove-layer').disabled = !selected;
  if (!selected) return;
  $('layer-text').value = sourceText(selected, d);
  $('layer-x').value = Math.round(selected.x);
  $('layer-y').value = Math.round(selected.y);
  $('layer-size').value = selected.size;
  $('layer-color').value = !selected.customColor && ['mode','position'].includes(selected.id)
    ? palettes[$('palette').value].accent : selected.color;
  $('reset-text').hidden = selected.text === null || selected.driver === undefined && !['mode','event','details','position'].includes(selected.id);
}
$('layers').onchange = () => { state.selected = $('layers').value; refreshLayers(); draw(); };
$('add-layer').onclick = () => {
  if (state.layers.length >= 30) return status('30 textes maximum par affiche.');
  const layer = makeLayer(crypto.randomUUID(), 'NOUVEAU TEXTE', 200, 385, 44);
  state.layers.push(layer);
  state.selected = layer.id;
  refreshLayers();
  changed();
  $('layer-text').focus();
};
$('remove-layer').onclick = () => {
  if (state.selected?.startsWith('driver-')) removedDriverLayers.add(state.selected);
  state.layers = state.layers.filter(layer => layer.id !== state.selected);
  state.selected = state.layers.at(-1)?.id || null;
  refreshLayers();
  changed();
};
$('reset-text').onclick = () => {
  const layer = state.layers.find(layer => layer.id === state.selected);
  if (!layer) return;
  layer.text = null;
  refreshLayers();
  changed();
};
$('layer-text').oninput = event => {
  const layer = state.layers.find(layer => layer.id === state.selected);
  if (!layer) return;
  layer.text = event.target.value;
  $('layers').selectedOptions[0].textContent = layer.text.trim().slice(0, 45) || 'Texte vide';
  $('reset-text').hidden = layer.driver === undefined && !['mode','event','details','position'].includes(layer.id);
  changed();
};
for (const [key, min] of [['x',0],['y',0],['size',12]]) {
  $('layer-' + key).oninput = event => {
    const layer = state.layers.find(layer => layer.id === state.selected);
    if (layer && event.target.value !== '') { layer[key] = clip(Number(event.target.value), min, key === 'x' ? W - 1 : key === 'y' ? H - 1 : 300); changed(); }
  };
  $('layer-' + key).onchange = refreshLayers;
}
$('layer-color').oninput = event => {
  const layer = state.layers.find(layer => layer.id === state.selected);
  if (layer) { layer.color = event.target.value; layer.customColor = true; changed(); }
};
$('poster-format').onchange = event => setFormat(event.target.value);
$('palette').onchange = () => { refreshLayers(); changed(); };
$('show-portraits').onchange = () => { buildDrivers(); refreshLayers(); changed(); };
for (const key of ['zoom', 'x', 'y']) {
  $('photo-' + key).oninput = event => {
    photoFrame[key] = Number(event.target.value) / 100;
    changed();
  };
}
let backgroundRequest = 0;
$('background').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++backgroundRequest;
  try {
    const image = await fromFile(file, file.name);
    if (request !== backgroundRequest) { image.close?.(); return; }
    state.background?.close?.();
    state.background = image;
    $('photo-source').textContent = 'Photo de course importée';
    $('clear-bg').hidden = false;
    $('photo-framing').hidden = false;
    status('Fond importé.');
    changed();
  } catch (error) {
    if (request === backgroundRequest) status('Import impossible · ' + error.message);
  } finally {
    if (request === backgroundRequest) event.target.value = '';
  }
};
$('clear-bg').onclick = () => {
  backgroundRequest++;
  state.background?.close?.();
  state.background = null;
  $('photo-source').textContent = 'Visuel VCE par défaut · importe ta capture pour le remplacer.';
  $('clear-bg').hidden = true;
  $('photo-framing').hidden = true;
  changed();
};
let drag = null;
function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || drag) return;
  const { x, y } = point(event);
  const layer = state.layers.findLast(item => item.box && x >= item.x - 10 && x <= item.x + item.box.w + 10 && y >= item.y - 10 && y <= item.y + item.box.h + 10);
  if (!layer) return;
  state.selected = layer.id;
  drag = { layer, id: event.pointerId, dx: x - layer.x, dy: y - layer.y };
  canvas.setPointerCapture(event.pointerId);
  refreshLayers();
  draw();
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  const { x, y } = point(event);
  drag.layer.x = clip(Math.round(x - drag.dx), 0, W - 1);
  drag.layer.y = clip(Math.round(y - drag.dy), 0, H - 1);
  $('layer-x').value = drag.layer.x;
  $('layer-y').value = drag.layer.y;
  changed();
});
canvas.addEventListener('lostpointercapture', () => { drag = null; });

form.addEventListener('submit', event => event.preventDefault());
field('mode').onchange = () => { modeChanged(); refreshLayers(); };
field('count').onchange = () => { buildDrivers(); refreshLayers(); changed(); };
for (const key of ['event','circuit','date','number','position']) {
  field(key).oninput = () => { refreshLayers(); changed(); };
}

function exportBlob() {
  draw(false);
  const blob = new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Export PNG impossible.')), 'image/png'));
  draw();
  return blob;
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = element('a', null, { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function validData() {
  if (!form.reportValidity()) return null;
  const ids = state.drivers.map(driver => driver.id);
  if (ids.some(id => !state.roster.some(p => p.id === id))) throw new Error('Choisis les pilotes dans l’effectif.');
  if (new Set(ids).size !== ids.length) throw new Error('Sélectionne un pilote différent à chaque ligne.');
  return { ...data(), ids };
}
let working = false;
async function act(action) {
  if (working) return;
  working = true;
  for (const id of ['send','archive','download']) $(id).disabled = true;
  try { await action(); }
  catch (error) { status(error.message); }
  finally {
    working = false;
    for (const id of ['send','archive','download']) $(id).disabled = false;
  }
}
$('download').onclick = () => act(async () => {
  await defaultPhotoReady;
  if (!validData()) return;
  if (!data().event || !data().position) throw new Error('Renseigne le nom de l’épreuve et la position.');
  const dimensions = W + 'x' + H;
  downloadBlob(await exportBlob(), 'VCE-resultat-' + dimensions + '.png');
  status('PNG exporté en ' + dimensions + '.');
});
async function save(published) {
  await defaultPhotoReady;
  const d = validData();
  if (!d) return;
  if (!d.event || !d.number || state.drivers.some(driver => !driver.nation)) throw new Error('Renseigne les champs obligatoires.');
  if (state.archived?.published) { status('Cette version est déjà envoyée.'); return; }
  if (portraitsEnabled() && state.drivers.some(driver => driver.loading)) throw new Error('Attends le chargement des portraits.');
  const current = state.archived || { id: crypto.randomUUID() };
  state.archived = current;
  status(published ? 'Envoi aux profils sélectionnés…' : 'Archivage de l’affiche…');
  const blob = await exportBlob();
  await window.VCEResultPosters.save({ id: current.id, title: d.event, mode: d.mode, pilot_slugs: d.ids, published }, blob);
  current.published = published;
  if (state.archived === current) {
    status(published ? 'Affiche publiée sur ' + d.ids.length + (d.ids.length === 1 ? ' profil.' : ' profils.') : 'Affiche archivée dans Voir ancien.');
  } else {
    status(published ? 'La version envoyée a été publiée. L’aperçu contient des modifications plus récentes.' : 'Version précédente archivée.');
  }
}
$('archive').onclick = () => act(() => save(false));
$('send').onclick = () => act(() => save(true));

function resetHistory() {
  urlPool.forEach(url => URL.revokeObjectURL(url));
  urlPool.clear();
  $('history-list').replaceChildren();
  state.offset = 0;
}
async function historyCard(item, parent, legacy = false) {
  const card = element('article', null, { className: 'history-card' });
  const img = element('img', null, { alt: item.title || 'Affiche VCE', loading: 'lazy' });
  const info = element('div');
  const when = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '';
  const names = (item.pilot_slugs || []).map(id => state.roster.find(p => p.id === id)?.name || id);
  info.append(element('strong', img.alt), element('small', [legacy ? 'Ancienne publication' : item.published ? 'Envoyée' : 'Archivée', when].filter(Boolean).join(' · ')));
  if (names.length) info.append(element('small', names.join(', ')));
  card.append(img, info);
  parent.append(card);
  try {
    const url = legacy ? item.url : URL.createObjectURL(await window.VCEResultPosters.image(item.id));
    if (!card.isConnected) { if (!legacy) URL.revokeObjectURL(url); return; }
    if (!legacy) urlPool.add(url);
    img.src = url;
    info.append(element('a', 'Voir le PNG', { href: url, target: '_blank', rel: 'noopener' }));
    info.append(element('a', 'Télécharger', { href: url, download: 'VCE-resultat.png' }));
    if (!legacy && !item.published) {
      const publish = element('button', 'Envoyer aux profils', { type: 'button' });
      publish.onclick = async () => {
        publish.disabled = true;
        try {
          await window.VCEResultPosters.publishArchived(item.id);
          loadHistory();
        } catch (error) {
          $('studio-status').textContent = error.message;
          publish.disabled = false;
        }
      };
      info.append(publish);
    }
  } catch {
    img.hidden = true;
    info.append(element('small', 'Image indisponible.'));
  }
}
let historyRequest = 0;
async function loadHistory(more = false) {
  const request = ++historyRequest;
  if (!more) resetHistory();
  const root = $('history-list');
  const legacy = more ? Promise.resolve({}) : window.VCESupabase.read('overlays');
  const [modern, older] = await Promise.allSettled([window.VCEResultPosters.list(null, state.offset), legacy]);
  if (request !== historyRequest || state.view !== 'history') return;
  const rows = modern.status === 'fulfilled' ? modern.value : [];
  const olderItems = Array.isArray(older.value?.items) ? older.value.items : [];
  const validLegacy = olderItems.filter(x => x.kind === 'resultats' && /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/vce-overlays\//.test(x.url || ''));
  rows.forEach(item => historyCard(item, root));
  validLegacy.forEach(item => historyCard(item, root, true));
  state.offset += rows.length;
  if (!rows.length && !validLegacy.length && !more) root.append(element('p', 'Aucune affiche à afficher.'));
  if (rows.length === 24) {
    const next = element('button', 'Charger plus', { type: 'button' });
    next.onclick = () => { next.remove(); loadHistory(true); };
    root.append(next);
  }
  $('studio-status').textContent = [modern.status === 'rejected' ? 'Historique récent indisponible.' : '', older.status === 'rejected' ? 'Archives précédentes indisponibles.' : ''].filter(Boolean).join(' ');
}
function switchTo(view) {
  state.view = view;
  $('history').hidden = view !== 'history';
  $('studio').hidden = view !== 'create';
  $('history-tab').setAttribute('aria-pressed', String(view === 'history'));
  $('create-tab').setAttribute('aria-pressed', String(view === 'create'));
  $('studio-status').textContent = '';
  if (view === 'history') {
    $('studio-status').textContent = 'Chargement des affiches…';
    loadHistory();
  }
  else draw();
}
function prefill() {
  const draftId = new URLSearchParams(location.search).get('draft');
  if (!draftId) return false;
  try {
    const item = JSON.parse(sessionStorage.getItem('vce_team_result_draft') || 'null');
    if (!item || item.id !== draftId || item.status !== 'accepted') return false;
    const values = {
      mode: item.category === 'endurance' ? 'endurance' : 'solo',
      event: item.event_name,
      date: item.race_date,
      circuit: item.track,
      position: item.finishing_position
    };
    for (const [key, value] of Object.entries(values)) field(key).value = value || '';
    state.drivers = [{ id: item.pilot_slug, nation: '', photo: 0, image: null }];
    return true;
  } catch { return false; }
}
async function init() {
  $('history-tab').disabled = true;
  $('create-tab').disabled = true;
  try {
    if (!await window.VCESupabase.isStaff()) throw new Error('Connecte-toi au Staff pour ouvrir le studio.');
    const roster = await window.VCESupabase.read('pilotes');
    state.roster = Array.isArray(roster.items) ? roster.items.filter(p => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id) && typeof p.name === 'string') : [];
    state.manifest = await fetch('data/images/pilotes/index.json').then(r => r.ok ? r.json() : {}).catch(() => ({})) || {};
    const draft = prefill();
    setFormat($('poster-format').value);
    modeChanged();
    refreshLayers();
    defaultPhotoReady = fromPath('data/images/vce-results-gt3.webp').then(image => { exampleBackground = image; draw(); }).catch(() => {});
    $('history-tab').onclick = () => switchTo('history');
    $('create-tab').onclick = () => switchTo('create');
    $('history-tab').disabled = false;
    $('create-tab').disabled = false;
    switchTo(draft ? 'create' : 'history');
    if (draft) status('Proposition acceptée chargée. Complète les données et l’équipage avant envoi.');
  } catch (error) {
    $('studio-status').textContent = error.message;
  }
}
init();

/* Parsing rules for visible HUD values. A failed read stays empty. */
(() => {
  'use strict';

  function readValue(field, input) {
    const text = input.trim();
    if (field === 'track') {
      const name = text.replace(/\s+/g, ' ').slice(0, 100);
      return /\p{L}{2}/u.test(name) ? name : null;
    }
    if (field === 'chrono') {
      const match = text.replace(/\s/g, '').match(/^(\d{1,2})[:.](\d{2})[.,:](\d{1,3})$/);
      if (!match || Number(match[2]) >= 60) return null;
      return Number(match[1]) + ':' + match[2] + '.' + match[3].padEnd(3, '0');
    }
    if (field === 'gear' && /^[NR]$/i.test(text)) return text.toUpperCase();
    if (field === 'speed' && !/^\d{1,3}(?:\s*(?:km\s*\/?\s*h|kph))?$/i.test(text)) return null;
    if (field !== 'speed' && !/^\d{1,3}\s*%?$/.test(text)) return null;
    const value = Number.parseInt(text, 10);
    if (field === 'gear') return value >= 0 && value <= 12 ? (value === 0 ? 'N' : String(value)) : null;
    const max = field === 'speed' ? 600 : 100;
    return value >= 0 && value <= max ? String(value) : null;
  }

  function readBar(image, field, vertical) {
    const {data, width, height} = image;
    const length = vertical ? height : width;
    const thickness = vertical ? width : height;
    let active = 0;
    for (let i = 0; i < length; i++) {
      let matches = 0;
      for (let j = Math.floor(thickness * .2); j < Math.ceil(thickness * .8); j++) {
        const offset = (vertical ? i * width + j : j * width + i) * 4;
        const [r, g, b] = [data[offset], data[offset + 1], data[offset + 2]];
        const main = field === 'throttle' ? g : r;
        const other = field === 'throttle' ? Math.max(r, b) : Math.max(g, b);
        if (main >= 90 && main - other >= 30) matches++;
      }
      if (matches >= Math.ceil(thickness * .25)) active++;
    }
    return String(Math.round(100 * active / length));
  }

  window.VCEVideoHUDData = {readValue, readBar};
})();

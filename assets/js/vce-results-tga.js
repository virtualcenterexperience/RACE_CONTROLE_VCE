/* Decode uncompressed and RLE TGA with indexed, grayscale or true-colour pixels. */
export async function decodeTga(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 18) throw new Error('En-tête TGA incomplet.');
  const header = new DataView(bytes.buffer);
  const type = bytes[2];
  const kind = type >= 9 ? type - 8 : type;
  const width = header.getUint16(12, true);
  const height = header.getUint16(14, true);
  const depth = bytes[16];
  const flags = bytes[17];
  const paletteStart = header.getUint16(3, true);
  const paletteSize = header.getUint16(5, true);
  const paletteDepth = bytes[7];
  const supported = [1, 2, 3, 9, 10, 11].includes(type) &&
    ((kind === 1 && bytes[1] === 1 && paletteSize > 0 && [8,16].includes(depth) && [15,16,24,32].includes(paletteDepth)) ||
     (kind === 2 && bytes[1] === 0 && [15,16,24,32].includes(depth)) ||
     (kind === 3 && bytes[1] === 0 && [8,16].includes(depth)));
  if (!supported || !width || !height || width * height > 25000000 || (flags & 192)) {
    throw new Error('Format TGA non pris en charge.');
  }
  let offset = 18 + bytes[0];
  function take(count) {
    if (offset + count > bytes.length) throw new Error('Fichier TGA incomplet.');
    const value = offset;
    offset += count;
    return value;
  }
  function readColor(bits, gray, alpha) {
    const index = take(Math.ceil(bits / 8));
    if (gray) return [bytes[index], bytes[index], bytes[index], bits === 16 ? bytes[index + 1] : 255];
    if (bits > 16) return [bytes[index + 2], bytes[index + 1], bytes[index], bits === 32 && alpha ? bytes[index + 3] : 255];
    const value = header.getUint16(index, true);
    const channel = shift => Math.round(((value >> shift) & 31) * 255 / 31);
    return [channel(10), channel(5), channel(0), bits === 16 && alpha && !(value & 32768) ? 0 : 255];
  }
  const palette = kind === 1 ? Array.from({ length: paletteSize }, () => readColor(paletteDepth, false, true)) : [];
  function readPixel() {
    if (kind !== 1) return readColor(depth, kind === 3, !!(flags & 15));
    const index = depth === 16 ? header.getUint16(take(2), true) : bytes[take(1)];
    const color = palette[index - paletteStart];
    if (!color) throw new Error('Palette TGA invalide.');
    return color;
  }
  const image = new ImageData(width, height);
  const total = width * height;
  let i = 0;
  while (i < total) {
    const packet = type >= 9 ? bytes[take(1)] : 0;
    const count = (packet & 127) + 1;
    if (i + count > total) throw new Error('Bloc RLE TGA invalide.');
    const repeated = packet & 128 ? readPixel() : null;
    for (let j = 0; j < count; j++, i++) {
      const x = flags & 16 ? width - 1 - i % width : i % width;
      const y = flags & 32 ? Math.floor(i / width) : height - 1 - Math.floor(i / width);
      image.data.set(repeated || readPixel(), 4 * (y * width + x));
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
}

// สร้างไอคอน PNG สำหรับ PWA จาก SVG (ใช้ sharp)
import sharp from 'sharp';
const leaf = (size, pad, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2BC58A"/><stop offset="1" stop-color="#1FA971"/></linearGradient></defs>
  <rect width="${size}" height="${size}" ${rounded ? `rx="${size * 0.28}"` : ''} fill="url(#g)"/>
  <g transform="translate(${size / 2 - 12 * ((size - pad * 2) / 24)} ${size / 2 - 12 * ((size - pad * 2) / 24)}) scale(${(size - pad * 2) / 24})" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </g>
</svg>`;
const out = new URL('../public/', import.meta.url).pathname;
const jobs = [
  ['icon-192.png', 192, 44, true],
  ['icon-512.png', 512, 118, true],
  ['icon-maskable-512.png', 512, 150, false],
  ['apple-touch-icon.png', 180, 42, false],
];
for (const [name, size, pad, rounded] of jobs) {
  await sharp(Buffer.from(leaf(size, pad, rounded))).png().toFile(out + name);
  console.log('wrote', name);
}

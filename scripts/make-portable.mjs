// แปลง dist-portable/index.html ให้โหลดได้จาก file:// (สคริปต์ปกติ ไม่ใช่โมดูล, ไม่มี crossorigin)
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const dir = 'dist-portable';
let html = readFileSync(`${dir}/index.html`, 'utf8');
html = html
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '')
  .replace(/ crossorigin/g, '')
  .replace('</body>', (m) => m); // ไม่แตะ body
const m = readFileSync(`${dir}/index.html`, 'utf8').match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
if (!m) throw new Error('ไม่พบแท็ก script ของแอปใน index.html');
html = html.replace('</body>', `    <script defer src="${m[1]}"></script>\n  </body>`);
writeFileSync(`${dir}/index.html`, html);
copyFileSync('public/favicon.svg', `${dir}/favicon.svg`);
console.log('portable index.html พร้อมใช้งาน; script =', m[1]);

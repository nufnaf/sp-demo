import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'electron/assets');
const mark = await readFile(join(root, 'public/icons/syntropic-mark.png'));
// Embed the original alpha silhouette: no tracing or generated replacement of
// the silhouette. This SVG is also the editable, self-contained icon master.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="tile" x1="0" y1="0" x2="0.65" y2="1"><stop stop-color="#656bd5"/><stop offset=".43" stop-color="#355bad"/><stop offset=".76" stop-color="#257888"/><stop offset="1" stop-color="#43a078"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".6"/><stop offset="1" stop-color="#b9efdd" stop-opacity=".16"/></linearGradient>
  <filter id="white-mark" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="10"/></filter>
</defs>
<rect x="105" y="116" width="814" height="814" rx="183" fill="#132446" opacity=".25" filter="url(#shadow)"/>
<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#tile)" stroke="#3b5f99" stroke-width="1"/>
<rect x="103" y="103" width="818" height="818" rx="182" fill="none" stroke="url(#rim)" stroke-width="4"/>
<image x="162" y="162" width="700" height="700" filter="url(#white-mark)" href="data:image/png;base64,${mark.toString('base64')}"/>
</svg>`;
await mkdir(assets, { recursive: true });
await writeFile(join(assets, 'syntropic-app.svg'), svg);
// Use the same wallpaper locally, before the application service is available.
await sharp(join(root, 'public/design/home/wallpaper.png')).webp({ quality: 90 }).toFile(join(assets, 'startup-wallpaper.webp'));
const png = join(assets, 'syntropic-app.png');
await sharp(Buffer.from(svg)).png().toFile(png);
if (process.platform === 'darwin') {
  const temp = await mkdtemp(join(tmpdir(), 'syntropic-icons-'));
  try {
    const iconset = join(temp, 'Syntropic.iconset');
    await mkdir(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        await sharp(png).resize(size * scale).png().toFile(join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
      }
    }
    await promisify(execFile)('/usr/bin/iconutil', ['-c', 'icns', '-o', join(assets, 'Syntropic.icns'), iconset]);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
console.log('Desktop icon assets generated from the original Syntropic mark.');

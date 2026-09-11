/** Distribute the standalone recruiting brand into the desktop's public assets. */
import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/design/company/', root), { recursive: true });
for (const [source, destination] of [
  ['company-logo.svg', 'public/icons/company-careers-logo.svg'],
  ['brand.css', 'public/design/company/brand.css'],
]) await copyFile(new URL(`apps/recruiting/public/${source}`, root), new URL(destination, root));

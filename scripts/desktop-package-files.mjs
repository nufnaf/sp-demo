import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

function supports(values, target) {
  if (!Array.isArray(values) || values.length === 0) return true;
  if (values.includes(`!${target}`)) return false;
  const allowed = values.filter((value) => !value.startsWith('!'));
  return allowed.length === 0 || allowed.includes(target) || allowed.includes('any');
}

// Some published SDK shrinkwraps contain optional binaries for every platform.
// Respect their own npm os/cpu declarations, including nested dependencies.
export async function pruneUnsupportedPackages(nodeModules, platform, arch) {
  let entries;
  try { entries = await readdir(nodeModules, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const path = join(nodeModules, entry.name);
    if (entry.name.startsWith('@')) {
      await pruneUnsupportedPackages(path, platform, arch);
      continue;
    }
    let pkg;
    try { pkg = JSON.parse(await readFile(join(path, 'package.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (pkg && (!supports(pkg.os, platform) || !supports(pkg.cpu, arch))) {
      await rm(path, { recursive: true, force: true });
    } else {
      await pruneUnsupportedPackages(join(path, 'node_modules'), platform, arch);
    }
  }
}

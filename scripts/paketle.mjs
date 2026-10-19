// Eklentiyi Chrome Web Mağazası'na / Firefox imzalamaya yüklenecek ZIP
// olarak paketler: dist/manga-cevirmen-<sürüm>.zip. Yalnızca commit'lenmiş
// dosyaları alır (git archive); testler, belgeler ve betikler pakete girmez.
//   npm run paketle

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

/** Eklentinin çalışması için gereken her şey (tarayıcı bunları yükler). */
export const PAKET = ['manifest.json', '_locales', 'icons', 'popup', 'offscreen', 'src', 'vendor', 'LICENSE'];

const kok = new URL('..', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('manifest.json', kok), 'utf8'));
const degisiklik = execFileSync('git', ['status', '--porcelain', '--', ...PAKET], { cwd: kok, encoding: 'utf8' }).trim();
if (degisiklik) {
  console.error('Commit edilmemiş değişiklikler var (pakete girmez):\n' + degisiklik);
  process.exit(1);
}

mkdirSync(new URL('dist', kok), { recursive: true });
const hedef = `dist/manga-cevirmen-${version}.zip`;
execFileSync('git', ['archive', '--format=zip', '-o', hedef, 'HEAD', ...PAKET], { cwd: kok });
console.log(`Hazır: ${hedef}`);

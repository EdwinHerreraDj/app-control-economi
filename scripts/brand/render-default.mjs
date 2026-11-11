/**
 * Genera el original por defecto de la identidad (public/brand/source.png,
 * 1024 px) y el favicon SVG. Después: php artisan app:generate-default-icons
 *
 * Uso: node scripts/brand/render-default.mjs
 */
import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSvgs } from '../lib/render-svg.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const publicBrand = join(here, '..', '..', 'public', 'brand');
const svg = readFileSync(join(here, 'default-logo.svg'), 'utf8');

await renderSvgs([{ svg, out: join(publicBrand, 'source.png'), size: 1024 }]);
copyFileSync(join(here, 'default-logo.svg'), join(publicBrand, 'favicon.svg'));
console.log('Original por defecto generado en public/brand');

/**
 * Convierte los SVG de las mascotas en PNG transparentes de 512 × 512 px.
 *
 * Uso: node scripts/mascots/render-png.mjs   (BROWSER_PATH para otro navegador)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSvgs } from '../lib/render-svg.mjs';

const root = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'resources',
    'mascots',
);
const jobs = [];

for (const slug of readdirSync(root)) {
    const svgDir = join(root, slug, 'svg');
    if (!existsSync(svgDir)) continue;

    for (const file of readdirSync(svgDir).filter((f) => f.endsWith('.svg'))) {
        jobs.push({
            svg: readFileSync(join(svgDir, file), 'utf8'),
            out: join(root, slug, file.replace('.svg', '.png')),
            size: 512,
        });
    }
}

await renderSvgs(jobs);
console.log(`${jobs.length} imágenes de mascotas generadas`);

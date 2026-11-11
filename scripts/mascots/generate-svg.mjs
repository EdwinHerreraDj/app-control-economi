/**
 * Generador de las mascotas iniciales (SVG → resources/mascots/<slug>/svg).
 *
 * Cada mascota es el mismo personaje en todos los estados: cuerpo, encuadre
 * y posición idénticos; solo cambian ojos, boca, brazos y algún detalle.
 * Lienzo de 512 × 512 con fondo transparente.
 *
 * Uso: node scripts/mascots/generate-svg.mjs
 * Después: node scripts/mascots/render-png.mjs (convierte a PNG con Edge).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'resources',
    'mascots',
);

export const STATES = [
    'cover',
    'idle',
    'welcome',
    'celebration',
    'attention',
    'support',
    'unknown',
];

const INK = '#1f2b2e';

/* ---------- Piezas comunes ---------- */

function eyes(kind, [lx, rx], y, { size = 15, white = false } = {}) {
    switch (kind) {
        case 'happy': // ^ ^
            return [lx, rx]
                .map(
                    (x) =>
                        `<path d="M${x - 18} ${y + 6} Q${x} ${y - 16} ${x + 18} ${y + 6}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`,
                )
                .join('');
        case 'soft': // mirada tranquila, párpados medio cerrados
            return [lx, rx]
                .map(
                    (x) =>
                        `<path d="M${x - 17} ${y - 2} Q${x} ${y + 14} ${x + 17} ${y - 2}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`,
                )
                .join('');
        case 'up': // pensando: pupilas arriba
            return [lx, rx]
                .map(
                    (x) =>
                        `${white ? `<circle cx="${x}" cy="${y}" r="${size + 22}" fill="#fff"/>` : ''}<ellipse cx="${x + 4}" cy="${y - 9}" rx="${size * 0.85}" ry="${size}" fill="${INK}"/><circle cx="${x + 8}" cy="${y - 15}" r="4.5" fill="#fff"/>`,
                )
                .join('');
        case 'side': // curiosa: mira hacia un lado
            return [lx, rx]
                .map(
                    (x) =>
                        `${white ? `<circle cx="${x}" cy="${y}" r="${size + 22}" fill="#fff"/>` : ''}<ellipse cx="${x + 9}" cy="${y}" rx="${size * 0.85}" ry="${size * 1.1}" fill="${INK}"/><circle cx="${x + 13}" cy="${y - 6}" r="4.5" fill="#fff"/>`,
                )
                .join('');
        default: // abiertos
            return [lx, rx]
                .map(
                    (x) =>
                        `${white ? `<circle cx="${x}" cy="${y}" r="${size + 22}" fill="#fff"/>` : ''}<ellipse cx="${x}" cy="${y}" rx="${size * 0.85}" ry="${size * 1.1}" fill="${INK}"/><circle cx="${x + 5}" cy="${y - 7}" r="4.5" fill="#fff"/>`,
                )
                .join('');
    }
}

function mouth(kind, x, y) {
    switch (kind) {
        case 'big': // sonrisa abierta
            return `<path d="M${x - 26} ${y - 4} Q${x} ${y + 34} ${x + 26} ${y - 4} Z" fill="${INK}"/><path d="M${x - 13} ${y + 13} Q${x} ${y + 24} ${x + 13} ${y + 13}" fill="#f28b82"/>`;
        case 'small':
            return `<path d="M${x - 11} ${y} Q${x} ${y + 9} ${x + 11} ${y}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
        case 'o':
            return `<ellipse cx="${x}" cy="${y + 4}" rx="8" ry="9" fill="${INK}"/>`;
        case 'gentle':
            return `<path d="M${x - 18} ${y} Q${x} ${y + 13} ${x + 18} ${y}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
        default:
            return `<path d="M${x - 20} ${y - 2} Q${x} ${y + 18} ${x + 20} ${y - 2}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
    }
}

const sparkle = (x, y, s, color) =>
    `<path d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z" fill="${color}"/>`;

const heart = (x, y, s, color) =>
    `<path d="M${x} ${y + s * 0.9} C${x - s * 1.4} ${y - s * 0.1} ${x - s * 0.8} ${y - s * 1.1} ${x} ${y - s * 0.35} C${x + s * 0.8} ${y - s * 1.1} ${x + s * 1.4} ${y - s * 0.1} ${x} ${y + s * 0.9} Z" fill="${color}"/>`;

/** Bocadillo pequeño arriba a la derecha (pregunta o puntos suspensivos). */
function bubble(content) {
    const base = `<circle cx="438" cy="96" r="44" fill="#ffffff" stroke="#d6dfe0" stroke-width="5"/><circle cx="398" cy="150" r="10" fill="#ffffff" stroke="#d6dfe0" stroke-width="4"/>`;
    if (content === 'dots') {
        return (
            base +
            [418, 438, 458]
                .map(
                    (x) => `<circle cx="${x}" cy="96" r="6.5" fill="#7b8a8d"/>`,
                )
                .join('')
        );
    }
    return (
        base +
        `<text x="438" y="113" text-anchor="middle" font-family="Arial, sans-serif" font-size="50" font-weight="700" fill="#5b6a6d">?</text>`
    );
}

const confetti = (colors) =>
    [
        sparkle(88, 110, 18, colors[0]),
        sparkle(430, 90, 22, colors[1]),
        sparkle(452, 230, 13, colors[2]),
        sparkle(64, 250, 12, colors[1]),
        `<circle cx="140" cy="62" r="8" fill="${colors[2]}"/>`,
        `<circle cx="378" cy="48" r="7" fill="${colors[0]}"/>`,
        `<rect x="470" y="150" width="14" height="14" rx="3" transform="rotate(25 477 157)" fill="${colors[0]}"/>`,
        `<rect x="36" y="168" width="14" height="14" rx="3" transform="rotate(-20 43 175)" fill="${colors[2]}"/>`,
    ].join('');

const wrap = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${body}</svg>`;

/* ---------- Brote: semilla con un brote ---------- */

function brote(state) {
    const body = '#2aa999';
    const shade = '#1f8a7d';
    const belly = '#c9f0e6';
    const leaf = '#7cc96a';
    const arm = (x, y, angle) =>
        `<ellipse cx="${x}" cy="${y}" rx="26" ry="44" transform="rotate(${angle} ${x} ${y})" fill="${shade}"/>`;

    const arms = {
        down: arm(116, 330, 18) + arm(396, 330, -18),
        wave: arm(116, 330, 18) + arm(410, 226, 32),
        up: arm(104, 212, -28) + arm(408, 212, 28),
        hug: arm(184, 396, 60) + arm(328, 396, -60),
    };

    const faces = {
        cover: ['open', 'default', 'down'],
        idle: ['open', 'default', 'down'],
        welcome: ['open', 'big', 'wave'],
        celebration: ['happy', 'big', 'up'],
        attention: ['side', 'small', 'down'],
        support: ['soft', 'gentle', 'hug'],
        unknown: ['up', 'o', 'down'],
    };
    const [eyeKind, mouthKind, armKind] = faces[state];

    const extras = {
        celebration: confetti(['#f2b84b', '#7cc96a', '#6aa8e8']),
        attention: bubble('question'),
        unknown: bubble('dots'),
        support: heart(256, 384, 28, '#f28b82'),
        welcome: `<path d="M448 170 q14 -10 24 4 M456 196 q16 -4 22 12" fill="none" stroke="#9fb3b6" stroke-width="6" stroke-linecap="round"/>`,
    };

    return wrap(
        [
            `<ellipse cx="256" cy="470" rx="128" ry="16" fill="#1f2b2e" opacity="0.12"/>`,
            // brote
            `<path d="M256 168 C252 140 254 118 262 100" fill="none" stroke="${leaf}" stroke-width="10" stroke-linecap="round"/>`,
            `<path d="M262 104 C226 72 190 86 182 114 C214 126 244 122 262 104 Z" fill="${leaf}"/>`,
            `<path d="M262 104 C290 64 336 66 346 96 C316 118 284 120 262 104 Z" fill="#94d982"/>`,
            // pies
            `<ellipse cx="206" cy="448" rx="38" ry="22" fill="${shade}"/><ellipse cx="306" cy="448" rx="38" ry="22" fill="${shade}"/>`,
            armKind === 'hug' ? '' : arms[armKind],
            // cuerpo
            `<path d="M256 162 C352 162 410 236 410 318 C410 400 344 452 256 452 C168 452 102 400 102 318 C102 236 160 162 256 162 Z" fill="${body}"/>`,
            `<ellipse cx="256" cy="360" rx="104" ry="78" fill="${belly}"/>`,
            // mejillas
            `<ellipse cx="174" cy="320" rx="22" ry="13" fill="#f6a5a0" opacity="0.75"/><ellipse cx="338" cy="320" rx="22" ry="13" fill="#f6a5a0" opacity="0.75"/>`,
            eyes(eyeKind, [206, 306], 282),
            mouth(mouthKind, 256, 326),
            armKind === 'hug' ? arms.hug : '',
            extras[state] ?? '',
        ].join(''),
    );
}

/* ---------- Pita: lechuza tranquila ---------- */

function pita(state) {
    const body = '#d99a4e';
    const shade = '#b97b35';
    const belly = '#f7e3c4';
    const wing = (x, y, angle) =>
        `<path d="M${x} ${y - 62} C${x + 34} ${y - 34} ${x + 34} ${y + 40} ${x} ${y + 62} C${x - 34} ${y + 40} ${x - 34} ${y - 34} ${x} ${y - 62} Z" transform="rotate(${angle} ${x} ${y})" fill="${shade}"/>`;

    const wings = {
        down: wing(118, 336, 14) + wing(394, 336, -14),
        wave: wing(118, 336, 14) + wing(412, 236, 40),
        up: wing(108, 222, -34) + wing(404, 222, 34),
        hug: wing(190, 392, 60) + wing(322, 392, -60),
    };

    const faces = {
        cover: ['open', 'default', 'down'],
        idle: ['open', 'default', 'down'],
        welcome: ['open', 'big', 'wave'],
        celebration: ['happy', 'big', 'up'],
        attention: ['side', 'small', 'down'],
        support: ['soft', 'gentle', 'hug'],
        unknown: ['up', 'o', 'down'],
    };
    const [eyeKind, , wingKind] = faces[state];
    const happyBeak = state === 'welcome' || state === 'celebration';

    const extras = {
        celebration: confetti(['#6aa8e8', '#f2b84b', '#2aa999']),
        attention: bubble('question'),
        unknown: bubble('dots'),
        support: heart(256, 384, 28, '#f28b82'),
        welcome: `<path d="M452 178 q14 -10 24 4 M460 204 q16 -4 22 12" fill="none" stroke="#9fb3b6" stroke-width="6" stroke-linecap="round"/>`,
    };

    // Ojos grandes con disco blanco (rasgo de la lechuza); los cerrados van sobre el disco.
    const eyeDiscs = `<circle cx="204" cy="266" r="50" fill="#fffaf0"/><circle cx="308" cy="266" r="50" fill="#fffaf0"/>`;
    const eyeMarks = ['happy', 'soft'].includes(eyeKind)
        ? eyes(eyeKind, [204, 308], 266)
        : eyes(eyeKind, [204, 308], 266, { size: 19 });

    return wrap(
        [
            `<ellipse cx="256" cy="470" rx="124" ry="16" fill="#1f2b2e" opacity="0.12"/>`,
            // orejas (penachos)
            `<path d="M150 196 L156 120 L214 172 Z" fill="${shade}"/><path d="M362 196 L356 120 L298 172 Z" fill="${shade}"/>`,
            // patas
            `<path d="M206 446 l-14 18 M206 446 l0 22 M206 446 l14 18 M306 446 l-14 18 M306 446 l0 22 M306 446 l14 18" stroke="#e07b39" stroke-width="9" stroke-linecap="round"/>`,
            wingKind === 'hug' ? '' : wings[wingKind],
            // cuerpo
            `<path d="M256 150 C356 150 404 226 404 314 C404 402 344 452 256 452 C168 452 108 402 108 314 C108 226 156 150 256 150 Z" fill="${body}"/>`,
            `<path d="M256 312 C320 312 352 352 352 392 C352 428 312 448 256 448 C200 448 160 428 160 392 C160 352 192 312 256 312 Z" fill="${belly}"/>`,
            // plumas del pecho
            `<path d="M222 372 q10 10 20 0 M270 372 q10 10 20 0 M246 400 q10 10 20 0" fill="none" stroke="#e4c08f" stroke-width="5" stroke-linecap="round"/>`,
            // cejas suaves
            state === 'attention'
                ? `<path d="M168 206 Q200 188 232 200" fill="none" stroke="${shade}" stroke-width="9" stroke-linecap="round"/><path d="M280 196 Q312 180 344 194" fill="none" stroke="${shade}" stroke-width="9" stroke-linecap="round"/>`
                : '',
            eyeDiscs,
            eyeMarks,
            // pico
            happyBeak
                ? `<path d="M238 300 Q256 296 274 300 L256 330 Z" fill="#e07b39"/><path d="M244 314 Q256 322 268 314" fill="none" stroke="#b3561f" stroke-width="4"/>`
                : `<path d="M240 300 Q256 294 272 300 L256 328 Z" fill="#e07b39"/>`,
            wingKind === 'hug' ? wings.hug : '',
            extras[state] ?? '',
        ].join(''),
    );
}

const MASCOTS = { brote, pita };

for (const [slug, draw] of Object.entries(MASCOTS)) {
    const dir = join(root, slug, 'svg');
    mkdirSync(dir, { recursive: true });

    for (const state of STATES) {
        writeFileSync(join(dir, `${state}.svg`), draw(state));
    }

    console.log(`${slug}: ${STATES.length} estados`);
}

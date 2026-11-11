/**
 * Renderiza SVG a PNG transparente con Microsoft Edge o Chrome sin interfaz
 * (Chrome DevTools Protocol, sin dependencias).
 */
import { spawn } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CANDIDATES = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ svg: string, out: string, size: number }[]} jobs
 */
export async function renderSvgs(jobs) {
    const browser = CANDIDATES.find((path) => existsSync(path));

    if (!browser) {
        throw new Error(
            'No se encontró Edge ni Chrome. Indica la ruta en BROWSER_PATH.',
        );
    }

    const port = 9300 + Math.floor(Math.random() * 500);
    const profile = mkdtempSync(join(tmpdir(), 'svg-render-'));
    const child = spawn(
        browser,
        [
            '--headless=new',
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${profile}`,
            '--no-first-run',
            'about:blank',
        ],
        { stdio: 'ignore' },
    );

    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
        try {
            targets = await (
                await fetch(`http://127.0.0.1:${port}/json/list`)
            ).json();
        } catch {
            await sleep(200);
        }
    }

    const ws = new WebSocket(
        targets.find((t) => t.type === 'page').webSocketDebuggerUrl,
    );
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && pending.has(data.id)) {
            pending.get(data.id)(data);
            pending.delete(data.id);
        }
    });
    const send = (method, params = {}) =>
        new Promise((resolve) => {
            const callId = ++id;
            pending.set(callId, resolve);
            ws.send(JSON.stringify({ id: callId, method, params }));
        });

    try {
        await send('Page.enable');
        await send('Emulation.setDefaultBackgroundColorOverride', {
            color: { r: 0, g: 0, b: 0, a: 0 },
        });

        for (const { svg, out, size } of jobs) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: size,
                height: size,
                deviceScaleFactor: 1,
                mobile: false,
            });
            const sized = svg.replace(
                /<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
                `<svg$1 width="${size}" height="${size}"`,
            );
            const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${sized}</body></html>`;
            await send('Page.navigate', {
                url: `data:text/html;base64,${Buffer.from(html).toString('base64')}`,
            });
            await sleep(250);
            const shot = await send('Page.captureScreenshot', {
                format: 'png',
                clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
            });
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
        }
    } finally {
        ws.close();
        child.kill();
        await sleep(300);
        rmSync(profile, { recursive: true, force: true });
    }
}

/*
 * Service worker de la aplicación.
 *
 * El servidor (ServiceWorkerController) antepone VERSION, PRECACHE y MEDIA.
 *
 * Privacidad: solo se guardan recursos estáticos (código, estilos, fuentes,
 * iconos e imágenes de la mascota) y la página sin conexión, que no lleva
 * datos personales. Las respuestas con datos financieros nunca se guardan
 * aquí: el modo sin conexión las lee de IndexedDB, separado por usuario.
 */

const STATIC_CACHE = `static-${VERSION}`;
const MEDIA_CACHE = 'media-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);

            await cache.addAll(
                PRECACHE.map(
                    (url) =>
                        new Request(url, {
                            credentials: 'omit',
                            cache: 'reload',
                        }),
                ),
            );

            // La página sin conexión se pide sin cookies: así nunca lleva
            // datos de la sesión.
            const shell = await fetch(
                new Request(OFFLINE_URL, {
                    credentials: 'omit',
                    cache: 'reload',
                }),
            );

            if (!shell.ok) {
                throw new Error('No se pudo descargar la página sin conexión');
            }

            await cache.put(OFFLINE_URL, shell);

            // Identidad visual: si algo falla no impide la instalación.
            const media = await caches.open(MEDIA_CACHE);
            await Promise.all(
                MEDIA.map((url) => media.add(url).catch(() => undefined)),
            );
        })(),
    );
    // Sin skipWaiting(): la nueva versión espera a que la persona la active
    // para no interrumpir formularios a medias.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();

            await Promise.all(
                keys
                    .filter(
                        (key) =>
                            key.startsWith('static-') && key !== STATIC_CACHE,
                    )
                    .map((key) => caches.delete(key)),
            );

            await self.clients.claim();
        })(),
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isMedia(url) {
    return (
        url.pathname.startsWith('/brand/') ||
        url.pathname.startsWith('/storage/') ||
        url.pathname === '/favicon.ico' ||
        url.pathname === '/manifest.webmanifest'
    );
}

function cacheable(response) {
    return response && response.ok && response.type === 'basic';
}

async function cacheFirst(request) {
    const cached = await caches.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);

    if (cacheable(response)) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
    }

    return response;
}

async function staleWhileRevalidate(event) {
    const cache = await caches.open(MEDIA_CACHE);
    const cached = await cache.match(event.request);

    const network = fetch(event.request)
        .then(async (response) => {
            if (cacheable(response)) {
                await cache.put(event.request, response.clone());
            }

            return response;
        })
        .catch(() => undefined);

    if (cached) {
        event.waitUntil(network);

        return cached;
    }

    return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    // Páginas: siempre de la red. Sin conexión se muestra el modo sin
    // conexión, que lee los datos guardados en el dispositivo.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(
                async () =>
                    (await caches.match(OFFLINE_URL)) || Response.error(),
            ),
        );

        return;
    }

    // Código y estilos compilados: llevan huella en el nombre, no cambian.
    if (url.pathname.startsWith('/build/')) {
        event.respondWith(cacheFirst(request));

        return;
    }

    if (isMedia(url)) {
        event.respondWith(staleWhileRevalidate(event));
    }

    // Todo lo demás (datos, formularios, Inertia) va siempre a la red y no
    // se guarda.
});

// --- CONSTANTES DE CACHÉ ---
const STATIC_CACHE_NAME = 'static-cache-v2';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v2';

// --- APP SHELL ---
// Archivos fundamentales de nuestra aplicación.
const APP_SHELL = [
    './',
    './index.html',
    './calendar.html',
    './form.html',
    './styles.css',
    './main.js',
    './manifest.json',
    './images/icons/192.png',
    './images/icons/512.png'
];

// --- EVENTO: install ---
// Se dispara cuando el SW se instala por primera vez.
// Aquí pre-cacheamos el App Shell.
self.addEventListener('install', event => {
    console.log('[SW] Evento: Instalando...');
    
    // Esperamos a que la promesa de 'caches' se complete
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log(`[SW] Pre-cacheando App Shell en ${STATIC_CACHE_NAME}`);
                // addAll toma un array de URLs, las pide y guarda las respuestas
                return cache.addAll(APP_SHELL);
            })
            .catch(err => {
                console.error('[SW] Error al pre-cachear App Shell:', err);
            })
    );
});

// --- EVENTO: activate ---
// Se dispara cuando el SW se activa (reemplaza a uno antiguo).
// Aquí limpiamos cachés viejas.
self.addEventListener('activate', event => {
    console.log('[SW] Evento: Activando...');
    
    const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Si la caché no está en nuestra "lista blanca", la borramos.
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[SW] Limpiando caché antigua: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


// --- EVENTO: fetch ---
// Se dispara CADA VEZ que la PWA hace una petición de red (fetch).
// Aquí implementamos la estrategia "Cache falling back to Network".
self.addEventListener('fetch', event => {
    
    // 1. INTENTAR: Buscar el recurso en TODAS las cachés (estática y dinámica)
    event.respondWith(
        caches.match(event.request)
            .then(cacheResponse => {
                
                // 2. ÉXITO (Cache Hit): Si se encuentra, lo devolvemos desde la caché.
                if (cacheResponse) {
                    console.log(`[Cache] Sirviendo desde caché: ${event.request.url}`);
                    return cacheResponse;
                }

                // 3. FALLA (Cache Miss): Si no está en caché, vamos a la red.
                console.log(`[Red] Buscando en la red: ${event.request.url}`);
                return fetch(event.request)
                    .then(networkResponse => {
                        
                        // 4. CACHEO DINÁMICO:
                        // Clonamos la respuesta (porque solo se puede leer una vez).
                        const responseToCache = networkResponse.clone();
                        
                        // Abrimos el caché DINÁMICO
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then(cache => {
                                // Guardamos la nueva respuesta de red en el caché dinámico.
                                // La próxima vez, el 'caches.match' del paso 1 la encontrará aquí.
                                cache.put(event.request, responseToCache);
                                console.log(`[Cache] Guardado en caché dinámica: ${event.request.url}`);
                            });

                        // 5. DEVOLVER: Devolvemos la respuesta original de la red al navegador.
                        return networkResponse;
                    })
                    .catch(() => {
                        // 6. FALLA TOTAL: Tanto caché como red fallaron (ej. estamos offline).
                        // Aquí podríamos devolver una página de fallback.
                        console.error(`[Error] Falló la caché y la red para ${event.request.url}`);
                        // Opcional: new Response("<h1>Estás offline</h1>", { headers: { 'Content-Type': 'text/html' } });
                    });
            })
    );
});
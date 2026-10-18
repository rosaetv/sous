// Service worker: guarda la app en el teléfono para que funcione sin internet.
//
// - VERSION la escribe dev/publicar.py con la de js/version.js. Así este archivo cambia en
//   cada versión: el iPhone solo busca actualizaciones cuando este archivo es distinto.
// - Si agregas un archivo nuevo a la app, súmalo a FILES
//   (python3 dev/revisar-sw.py avisa si falta alguno).
// - Tus datos (menús, marcas, recetas, fotos) no van aquí: viven en IndexedDB.

const VERSION = "1.5.1"; // la reemplaza dev/publicar.py
const CACHE = `sous-${VERSION}`;
const PHOTO_CACHE = "sous-fotos"; // fotos de recetas de otros sitios (imagenUrl): no cambia con cada versión

const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/theme.css",
  "css/app.css",
  "fonts/onest.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon.svg",
  "js/app.js",
  "js/backup.js",
  "js/batch-card.js",
  "js/db.js",
  "js/lib/imagen.js",
  "js/logic/batch.js",
  "js/logic/cambios.js",
  "js/logic/fechas.js",
  "js/logic/menu.js",
  "js/logic/resumen.js",
  "js/logic/super.js",
  "js/logic/validar.js",
  "js/meal-card.js",
  "js/pwa.js",
  "js/screens/ajustes.js",
  "js/screens/hoy.js",
  "js/screens/importar.js",
  "js/screens/recetas.js",
  "js/screens/resumen.js",
  "js/screens/semana.js",
  "js/screens/styleguide.js",
  "js/screens/super.js",
  "js/store.js",
  "js/swap-day.js",
  "js/ui.js",
  "js/version.js",
  "vendor/lucide.min.js",
];

// Instalar: descarga y guarda todos los archivos de esta versión.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))))
      // Si lo guardado en esta dirección es de otra app (por ejemplo, se subió otra app por error),
      // la versión nueva se instala sola, sin esperar a que toques "Actualizar".
      .then(() => foreignEntries())
      .then((foreign) => foreign.length && self.skipWaiting()),
  );
});

// Archivos de esta dirección guardados por OTRA app del mismo dominio (ShowUp, Pace…).
// Solo se miran las entradas de esta dirección; lo de las otras apps no se toca.
async function foreignEntries() {
  const found = [];
  for (const key of await caches.keys()) {
    if (key.startsWith("sous-")) continue; // incluye sous-fotos
    const cache = await caches.open(key);
    for (const request of await cache.keys()) {
      if (request.url.startsWith(self.registration.scope)) found.push({ cache, request });
    }
  }
  return found;
}

// Activar: borra las versiones anteriores guardadas.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("sous-") && k !== CACHE && k !== PHOTO_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => foreignEntries())
      .then((foreign) => Promise.all(foreign.map(({ cache, request }) => cache.delete(request))))
      .then(() => self.clients.claim()),
  );
});

// La app pide activar la versión nueva cuando tocas "Actualizar".
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fotos de recetas que vienen de otro sitio (imagenUrl): la primera vez que se ven con internet
  // se guardan, y después se muestran sin conexión.
  if (url.origin !== self.location.origin) {
    if (request.destination !== "image") return;
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Abrir la app: siempre la página guardada.
  if (request.mode === "navigate") {
    event.respondWith(caches.match("index.html", { cacheName: CACHE }).then((cached) => cached || fetch(request)));
    return;
  }

  // Resto de archivos: primero lo guardado de esta versión; si no está, de internet (y se guarda).
  event.respondWith(
    caches.match(request, { ignoreSearch: true, cacheName: CACHE }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        }),
    ),
  );
});

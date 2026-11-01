// Registro del service worker (modo sin internet) y aviso de "versión nueva".

let registration = null;

export function setupPWA() {
  if (!("serviceWorker" in navigator)) return;
  // En la computadora de desarrollo no se usa (para ver los cambios al instante),
  // salvo que la dirección lleve ?sw=1 para probarlo.
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has("sw")) return;

  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      registration = reg;
      // Ya había una versión nueva esperando.
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });

      // Al volver a abrir la app desde la pantalla de inicio, busca versiones nuevas.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
    })
    .catch((error) => {
      // Si el navegador no lo permite, la app funciona igual (solo que sin modo sin internet).
      console.warn("Sin modo sin conexión:", error.message);
    });

  // Cuando la versión nueva toma el control, recarga para usarla.
  // En la primera visita no hay versión anterior: no hace falta recargar.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

function showUpdate(worker) {
  if (document.getElementById("update-bar")) return;
  const bar = document.createElement("div");
  bar.id = "update-bar";
  bar.className = "update-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `
    <span>Hay una versión nueva de Sous.</span>
    <button class="btn btn-primary" type="button">Actualizar</button>`;
  bar.querySelector("button").addEventListener("click", () => worker.postMessage("skipWaiting"));
  document.body.append(bar);
}

// "Buscar actualizaciones" en Ajustes. Devuelve "updating", "latest" u "offline".
export async function checkForUpdates() {
  if (!registration) return "offline";
  try {
    await registration.update();
  } catch {
    return "offline";
  }
  // Si hay una versión esperando (o se está instalando), muestra la barra de "Actualizar".
  const worker = registration.waiting || registration.installing;
  if (worker) {
    if (registration.waiting) showUpdate(registration.waiting);
    else worker.addEventListener("statechange", () => worker.state === "installed" && showUpdate(worker));
    return "updating";
  }
  return "latest";
}

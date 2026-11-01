// Registro del service worker y aviso de "nueva versión disponible".

import { t } from "./i18n.js";

export function setupPWA() {
  if (!("serviceWorker" in navigator)) return;
  // En la computadora de desarrollo no se usa (para ver los cambios al instante),
  // salvo que la dirección lleve ?sw=1 para probarlo.
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has("sw")) return;

  navigator.serviceWorker.register("sw.js").then((registration) => {
    // Ya había una versión nueva esperando.
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        // "installed" con una versión anterior activa = hay actualización.
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });

    // Al volver a abrir la app desde la pantalla de inicio, busca versiones nuevas.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {});
    });
  }).catch((error) => {
    // Si el navegador no lo permite, la app funciona igual (solo que sin modo sin conexión).
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

// Botón "Buscar actualizaciones" de Perfil.
// Devuelve "update", "latest", "offline", "error" o "unsupported".
export async function checkForUpdates() {
  if (!("serviceWorker" in navigator)) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "unsupported"; // en la computadora de desarrollo
  if (registration.waiting) {
    showUpdate(registration.waiting);
    return "update";
  }
  try {
    await registration.update();
  } catch {
    return navigator.onLine ? "error" : "offline";
  }
  const worker = registration.installing || registration.waiting;
  if (!worker) return "latest";
  // Espera a que termine de descargarse la versión nueva.
  await new Promise((resolve) => {
    const check = () => {
      if (worker.state === "installed" || worker.state === "redundant") resolve();
    };
    worker.addEventListener("statechange", check);
    check();
  });
  if (worker.state !== "installed") return "error";
  showUpdate(worker);
  return "update";
}

function showUpdate(worker) {
  if (document.getElementById("update-bar")) return;
  const bar = document.createElement("div");
  bar.id = "update-bar";
  bar.className = "update-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `
    <span>${t("pwa.updateReady")}</span>
    <button class="btn-small" type="button">${t("pwa.update")}</button>`;
  bar.querySelector("button").addEventListener("click", () => worker.postMessage("skipWaiting"));
  document.body.append(bar);
}

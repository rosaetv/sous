// Ajustes: importar, resumen para Claude, respaldo. (Etapas 1 y 7.)

import { icon, toast } from "../ui.js";
import { checkForUpdates } from "../pwa.js";
import { APP_NAME, APP_VERSION } from "../version.js";

export function renderAjustes(view) {
  view.innerHTML = `
    <h1 class="title screen-title">Ajustes</h1>
    <div class="card list">
      <a class="list-item" href="#/importar">
        ${icon("clipboard-paste")}<span class="grow">Importar JSON</span>${icon("chevron-right", "icon chevron")}
      </a>
    </div>
    <h2 class="title section-title">Sobre la app</h2>
    <div class="card list">
      <button class="list-item list-button" data-action="update">
        ${icon("refresh-cw")}<span class="grow">Buscar actualizaciones</span>
      </button>
      <a class="list-item" href="#/styleguide">
        ${icon("palette")}<span class="grow">Guía de estilos</span>${icon("chevron-right", "icon chevron")}
      </a>
    </div>
    <p class="version">${APP_NAME} ${APP_VERSION}</p>`;

  view.onclick = async (event) => {
    if (!event.target.closest("[data-action=update]")) return;
    const result = await checkForUpdates();
    if (result === "latest") toast("Ya tienes la última versión");
    if (result === "offline") toast("Sin conexión: inténtalo cuando tengas internet");
  };
}

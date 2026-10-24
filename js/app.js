// Punto de entrada: decide qué pantalla mostrar según la dirección (#/...).

import { renderHoy } from "./screens/hoy.js";
import { renderSemana } from "./screens/semana.js";
import { renderRecetas } from "./screens/recetas.js";
import { renderSuper } from "./screens/super.js";
import { renderAjustes } from "./screens/ajustes.js";
import { renderStyleguide } from "./screens/styleguide.js";
import { renderImportar } from "./screens/importar.js";
import { renderResumen } from "./screens/resumen.js";
import { renderMealprep } from "./screens/mealprep.js";
import { icon, closeSheets } from "./ui.js";
import { setupPWA } from "./pwa.js";

const view = document.getElementById("view");

// [patrón, pantalla, pestaña activa]
const routes = [
  [/^hoy$/, renderHoy, "hoy"],
  [/^dia\/(\d{4}-\d{2}-\d{2})$/, renderHoy, "hoy"],
  [/^mealprep\/(\d{4}-\d{2}-\d{2})\/(\d+)$/, renderMealprep, "hoy"],
  [/^semana$/, renderSemana, "semana"],
  [/^semana\/(\d{4}-\d{2}-\d{2})$/, renderSemana, "semana"],
  [/^recetas$/, renderRecetas, "recetas"],
  [/^receta\/(.+)$/, renderRecetas, "recetas"], // detalle: etapa 6
  [/^super$/, renderSuper, "super"],
  [/^super\/(\d{4}-\d{2}-\d{2})$/, renderSuper, "super"],
  [/^ajustes$/, renderAjustes, "ajustes"],
  [/^styleguide$/, renderStyleguide, "ajustes"],
  [/^importar$/, renderImportar, "ajustes"],
  [/^resumen$/, renderResumen, "ajustes"],
  [/^resumen\/(\d{4}-\d{2}-\d{2})$/, renderResumen, "ajustes"],
];

// Íconos de la barra inferior (el texto de la pestaña queda debajo).
document.querySelectorAll(".tab").forEach((tab) => {
  tab.insertAdjacentHTML("afterbegin", icon(tab.dataset.icon));
});

async function route() {
  const path = location.hash.replace(/^#\/?/, "") || "hoy";
  let match;
  const found = routes.find(([pattern]) => (match = path.match(pattern))) || routes[0];
  const [, render, tab] = found;

  // Limpia lo que dejó la pantalla anterior.
  view.cleanup?.();
  view.cleanup = null;
  view.onclick = view.oninput = view.onchange = view.onkeydown = null;
  closeSheets();

  document.querySelectorAll(".tab").forEach((t) => {
    if (t.dataset.tab === tab) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });

  try {
    await render(view, ...(match ? match.slice(1) : []));
  } catch (error) {
    console.error(error);
    view.innerHTML = `<section class="card empty"><p>Algo no cargó. Prueba a cerrar y abrir la app.</p></section>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
setupPWA();
route();

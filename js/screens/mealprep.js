// Página del mealprep del domingo: un bloque por tarea, con sus indicaciones.
// Los haces en el orden que quieras: tocar un bloque lo marca como "Haciendo" (resaltado y arriba);
// lo palomeado se pliega y baja al final.

import { esc, icon, emptyState } from "../ui.js";
import { shortDay, rangeLabel } from "../logic/fechas.js";
import { batchKey, pasosDe, progresoBatch, minutosBatch, fechaDeBloque } from "../logic/batch.js";
import { progresoTexto } from "../batch-card.js";
import { allWeeks, checksWithPrefix, setCheck, recipesById } from "../store.js";

export async function renderMealprep(view, inicio, iParam) {
  const i = Number(iParam);
  const semana = (await allWeeks()).find((w) => w.inicio === inicio);
  const b = semana?.batch[i];
  if (!b) {
    view.innerHTML = emptyState({
      iconName: "cooking-pot",
      title: "Este mealprep ya no está",
      text: "Puede que hayas borrado o reemplazado el menú.",
      action: `<a class="btn btn-primary" href="#/hoy">Ir a hoy</a>`,
    });
    return;
  }

  const [checks, recetas] = await Promise.all([checksWithPrefix(`${inicio}|batch|${i}|`), recipesById()]);
  const pasos = pasosDe(b).map((paso, j) => ({ ...paso, j, key: batchKey(inicio, i, j) }));
  const fecha = fechaDeBloque(b, semana);
  const min = minutosBatch(b, recetas);

  // El bloque en el que estás trabajando (por su índice). Se recuerda al ir a una receta y volver.
  const ACTUAL_KEY = `sous-mealprep-actual|${inicio}|${i}`;
  let actual = null;
  try {
    const guardado = localStorage.getItem(ACTUAL_KEY);
    if (guardado !== null && pasos[Number(guardado)] && !checks.has(pasos[Number(guardado)].key)) actual = Number(guardado);
  } catch {
    // sin almacenamiento: empieza sin bloque marcado
  }
  function setActual(j) {
    actual = j;
    try {
      j === null ? localStorage.removeItem(ACTUAL_KEY) : localStorage.setItem(ACTUAL_KEY, String(j));
    } catch {
      // sin almacenamiento: funciona igual, solo no se recuerda
    }
  }

  const pasoHTML = (p) => {
    const on = checks.has(p.key);
    const receta = p.recetaId && recetas.get(p.recetaId);
    const minutos = p.min ?? receta?.tiempoActivoMin;
    const lista = p.numerado ? "ol" : "ul";
    return `
      <li class="prep-step${on ? " is-done" : ""}${p.j === actual ? " is-current" : ""}" data-paso="${p.j}">
        ${p.j === actual ? `<p class="prep-now">Haciendo ahora</p>` : ""}
        <div class="prep-step-head">
          <p class="prep-step-title"><span class="prep-step-name">${esc(p.texto)}</span>${minutos ? ` <span class="small muted">${minutos} min</span>` : ""}</p>
          <button class="prep-check" data-check="${p.key}" aria-pressed="${on}" aria-label="Hecho: ${esc(p.texto)}">
            <span class="dot">${icon("check")}</span>
          </button>
        </div>
        ${
          on
            ? ""
            : `${p.indicaciones ? `<${lista} class="prep-steps-list">${p.indicaciones.map((t) => `<li>${esc(t)}</li>`).join("")}</${lista}>` : ""}
               ${receta ? `<a class="prep-recipe" href="#/receta/${encodeURIComponent(receta.id)}">Ver receta ${icon("chevron-right")}</a>` : ""}`
        }
      </li>`;
  };

  function listHTML() {
    const enCurso = pasos.filter((p) => p.j === actual);
    const pendientes = pasos.filter((p) => p.j !== actual && !checks.has(p.key));
    const hechos = pasos.filter((p) => checks.has(p.key));
    return [...enCurso, ...pendientes, ...hechos].map(pasoHTML).join("");
  }

  function progressHTML() {
    const { hechos, total } = progresoBatch(inicio, i, b, checks);
    return `
      <span class="small muted">${progresoTexto(hechos, total)}</span>
      <div class="batch-bar"><span style="width: ${total ? (hechos / total) * 100 : 0}%"></span></div>`;
  }

  const volverA = fecha ? `#/dia/${fecha}` : "#/hoy";
  view.innerHTML = `
    <div class="prep-top">
      <button class="icon-btn" data-action="back" aria-label="Volver">${icon("chevron-left")}</button>
      <a class="icon-btn" href="${volverA}" aria-label="Cerrar">${icon("x")}</a>
    </div>
    <p class="batch-before prep-before">Para el menú del ${esc(rangeLabel(semana.inicio, semana.fin))}</p>
    <h1 class="prep-title">${icon("cooking-pot", "icon batch-icon")} Mealprep${fecha ? ` · ${esc(shortDay(fecha))}` : ""}</h1>
    <p class="small muted">${[b.cuando, min ? `~${min} min activos` : ""].filter(Boolean).map(esc).join(" · ")}</p>
    <div class="prep-progress">${progressHTML()}</div>
    <p class="small muted prep-hint">Toca el bloque que vas a hacer y sube hasta arriba.</p>
    <ul class="prep-list">${listHTML()}</ul>`;

  // Un toque "consciente" en un bloque: el dedo casi no se movió, no fue largo y la página no se desplazó.
  // Así un toque para detener el scroll no cambia el bloque en curso.
  let toque = null;
  view.onpointerdown = (event) => {
    const step = event.target.closest(".prep-step");
    toque = step && { j: Number(step.dataset.paso), x: event.clientX, y: event.clientY, t: Date.now(), scroll: window.scrollY };
  };
  const toqueConsciente = (event, j) =>
    toque &&
    toque.j === j &&
    Math.hypot(event.clientX - toque.x, event.clientY - toque.y) < 10 &&
    Date.now() - toque.t < 500 &&
    Math.abs(window.scrollY - toque.scroll) < 5;

  view.onclick = async (event) => {
    if (event.target.closest('[data-action="back"]')) {
      if (history.length > 1) history.back();
      else location.hash = volverA;
      return;
    }
    const check = event.target.closest("[data-check]");
    if (!check) {
      // Tocar un bloque pendiente (fuera del check y del enlace a la receta) lo marca como "Haciendo"; otra vez, lo quita.
      const step = event.target.closest(".prep-step");
      if (!step || step.classList.contains("is-done") || event.target.closest("a")) return;
      const j = Number(step.dataset.paso);
      if (!toqueConsciente(event, j)) return;
      clearTimeout(view.reorder);
      setActual(actual === j ? null : j);
      view.querySelector(".prep-list").innerHTML = listHTML();
      if (actual !== null) view.querySelector(".prep-list").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const key = check.dataset.check;
    const on = !checks.has(key);
    on ? checks.add(key) : checks.delete(key);
    if (on && Number(check.closest(".prep-step").dataset.paso) === actual) setActual(null);
    // Se ve al instante; un momento después baja (o sube) a su lugar.
    check.setAttribute("aria-pressed", on);
    check.closest(".prep-step").classList.toggle("is-done", on);
    view.querySelector(".prep-progress").innerHTML = progressHTML();
    clearTimeout(view.reorder);
    view.reorder = setTimeout(() => (view.querySelector(".prep-list").innerHTML = listHTML()), 600);
    await setCheck(key, on);
  };
  view.cleanup = () => {
    clearTimeout(view.reorder);
    view.onpointerdown = null;
  };
}

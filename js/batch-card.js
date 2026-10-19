// Tarjeta del batch (mealprep): título con cuándo, progreso y los pasos para palomear.
// Si un paso enlaza una receta que tienes, tocar el texto la abre; la casilla palomea aparte.
// La usan Semana (arriba, plegable) y Hoy (el día que toca).

import { esc, icon } from "./ui.js";
import { batchKey, pasosDe, progresoBatch } from "./logic/batch.js";
import { setCheck } from "./store.js";

// recetas: Map de id → receta. open: null si no se pliega, true/false si sí.
export function batchCardHTML({ semana, i, checks, recetas, open = null }) {
  const b = semana.batch[i];
  const { hechos, total } = progresoBatch(semana.inicio, i, b, checks);
  const titulo = `${icon("cooking-pot", "icon batch-icon")} Mealprep${b.cuando ? ` · ${esc(b.cuando)}` : ""}`;
  const progreso = progresoTexto(hechos, total);
  const foldable = open !== null;

  const pasos = pasosDe(b)
    .map((paso, j) => {
      const key = batchKey(semana.inicio, i, j);
      const on = checks.has(key);
      const receta = paso.recetaId && recetas.get(paso.recetaId);
      if (!receta) {
        return `
        <li>
          <button class="check-row" data-check="${key}" aria-pressed="${on}">
            <span class="checkbox">${icon("check")}</span>
            <span>${esc(paso.texto)}</span>
          </button>
        </li>`;
      }
      return `
        <li class="batch-step">
          <button class="check-row check-only" data-check="${key}" aria-pressed="${on}" aria-label="Hecho: ${esc(paso.texto)}">
            <span class="checkbox">${icon("check")}</span>
          </button>
          <a class="batch-step-link" href="#/receta/${encodeURIComponent(receta.id)}">
            <span class="batch-step-text">
              <span class="${on ? "is-done" : ""}">${esc(paso.texto)}</span>
              ${receta.tiempoActivoMin != null ? `<span class="small muted">${receta.tiempoActivoMin} min activos</span>` : ""}
            </span>
            ${icon("chevron-right", "icon chevron")}
          </a>
        </li>`;
    })
    .join("");

  return `
    <section class="card batch" data-batch="${i}">
      ${
        foldable
          ? `<button class="batch-head" data-action="batch-toggle" aria-expanded="${open}">
               <span class="batch-head-text">
                 <span class="batch-title">${titulo}</span>
                 <span class="small muted batch-progress">${progreso}</span>
               </span>
               ${icon(open ? "chevron-up" : "chevron-down", "icon chevron")}
             </button>`
          : `<div class="batch-head">
               <span class="batch-head-text">
                 <span class="batch-title">${titulo}</span>
                 <span class="small muted batch-progress">${progreso}</span>
               </span>
             </div>`
      }
      <div class="batch-bar"><span style="width: ${total ? (hechos / total) * 100 : 0}%"></span></div>
      ${!foldable || open ? `<ul class="checklist">${pasos}</ul>` : ""}
    </section>`;
}

function progresoTexto(hechos, total) {
  return `${hechos === total ? "¡Listo! " : ""}${hechos} de ${total} ${total === 1 ? "paso" : "pasos"}`;
}

// Palomea o quita un paso y actualiza la tarjeta en su lugar (sin volver a dibujarla).
// Devuelve true si el clic era de una casilla del batch.
export async function toggleBatchCheck(event, semana, checks) {
  const check = event.target.closest(".batch [data-check]");
  if (!check) return false;
  const key = check.dataset.check;
  const on = !checks.has(key);
  on ? checks.add(key) : checks.delete(key);

  const card = check.closest("[data-batch]");
  const i = Number(card.dataset.batch);
  const { hechos, total } = progresoBatch(semana.inicio, i, semana.batch[i], checks);
  check.setAttribute("aria-pressed", on);
  check.closest("li").querySelector(".batch-step-text > span:first-child")?.classList.toggle("is-done", on);
  card.querySelector(".batch-progress").textContent = progresoTexto(hechos, total);
  card.querySelector(".batch-bar span").style.width = `${(hechos / total) * 100}%`;

  await setCheck(key, on);
  return true;
}

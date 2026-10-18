// Tarjeta de una comida: plato, ingredientes y los tres botones para marcar.
// La usan Hoy y la guía de estilos.

import { esc, icon } from "./ui.js";
import { momentoLabel, formatQty, etiquetaInfo } from "./logic/menu.js";

export const MARKS = [
  { id: "comido", emoji: "✅", label: "Comido" },
  { id: "cambiado", emoji: "🔄", label: "Cambiado" },
  { id: "no", emoji: "❌", label: "No" },
];

export const SWAP_SUGGESTIONS = ["Nuggets de respaldo", "Sándwich de respaldo", "Comí fuera"];

// comida: del menú. mark: la marca guardada (o undefined).
// open: si una comida ya marcada muestra sus ingredientes (marcadas se pliegan para que lo pendiente destaque).
export function mealCardHTML(comida, mark, { hasRecipe = false, open = false } = {}) {
  const estado = mark?.estado || "";
  const folded = estado && !open;

  return `
    <article class="card meal" data-momento="${comida.momento}" ${estado ? `data-state="${estado}"` : ""}>
      <div class="meal-head">
        <span class="meal-moment">${esc(momentoLabel(comida.momento))}</span>
        ${hasRecipe ? `<a class="icon-btn plain" href="#/receta/${encodeURIComponent(comida.recetaId)}" aria-label="Ver receta">${icon("book-open")}</a>` : ""}
      </div>
      <h3 class="title meal-name">${esc(comida.plato)}</h3>
      ${estado === "cambiado" ? `<p class="meal-swap">🔄 Comiste: ${esc(mark.sustituto || "otra cosa")}</p>` : ""}

      ${
        folded
          ? comida.ingredientes.length || comida.nota
            ? `<button class="meal-toggle" data-action="toggle">${icon("chevron-down")} Ver ingredientes</button>`
            : ""
          : `
        ${
          comida.ingredientes.length
            ? `<ul class="meal-ingredients">
                ${comida.ingredientes
                  .map((ing) => `<li><span>${esc(ing.nombre)}</span><span class="qty">${esc(formatQty(ing.cantidad, ing.unidad))}</span></li>`)
                  .join("")}
              </ul>`
            : ""
        }
        ${comida.nota ? `<p class="meal-note">${icon("lightbulb")}<span>${esc(comida.nota)}</span></p>` : ""}
        ${estado ? `<button class="meal-toggle" data-action="toggle">${icon("chevron-up")} Ocultar ingredientes</button>` : ""}`
      }

      <div class="marks">
        ${MARKS.map(
          (m) => `
          <button class="mark" data-mark="${m.id}" aria-pressed="${estado === m.id}">
            <span class="mark-emoji" aria-hidden="true">${m.emoji}</span>${m.label}
          </button>`,
        ).join("")}
      </div>

      ${
        estado
          ? `
        <div class="feedback">
          <button class="chip" data-like="up" aria-pressed="${mark.valoracion === "up"}" aria-label="Me gustó">👍</button>
          <button class="chip" data-like="down" aria-pressed="${mark.valoracion === "down"}" aria-label="No me gustó">👎</button>
          <button class="chip note" data-action="note">${icon("pencil")} ${mark.nota ? "Editar nota" : "Nota"}</button>
        </div>
        ${mark.nota ? `<p class="meal-user-note">“${esc(mark.nota)}”</p>` : ""}`
          : ""
      }
    </article>`;
}

// Etiquetas del día: 🏢 Oficina, 🏋️ Gym…
export function tagsHTML(etiquetas) {
  if (!etiquetas.length) return "";
  return `<div class="tags">${etiquetas
    .map((t) => {
      const info = etiquetaInfo(t);
      return `<span class="tag tag-${info.tone}">${info.emoji} ${esc(info.label)}</span>`;
    })
    .join("")}</div>`;
}

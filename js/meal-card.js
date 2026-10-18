// Tarjeta de una comida: plato, ingredientes y los tres botones para marcar.
// La usan Hoy y la guía de estilos.

import { esc, icon } from "./ui.js";
import { momentoLabel, formatQty, etiquetaInfo } from "./logic/menu.js";
import { diffMeal, swapLabel, sameName } from "./logic/cambios.js";

export const MARKS = [
  { id: "comido", emoji: "✅", label: "Comido" },
  { id: "cambiado", emoji: "🔄", label: "Cambiado" },
  { id: "no", emoji: "❌", label: "No" },
];


// Un ingrediente: nombre a la izquierda; cantidad y, debajo, la referencia casera ("¼ de pieza").
export function ingredientHTML(ing) {
  const qty = formatQty(ing.cantidad, ing.unidad);
  const ref = String(ing.ref || "").trim().replace(/^\((.*)\)$/, "$1");
  return `
    <li>
      <span>${esc(ing.nombre)}</span>
      <span class="qty">${esc(qty || ref)}${qty && ref ? `<span class="qty-ref">${esc(ref)}</span>` : ""}</span>
    </li>`;
}

// Lo que comiste frente al menú: lo quitado tachado, la cantidad nueva con la del menú debajo, lo agregado con "+".
function editedIngredientsHTML(comida, comio) {
  const diff = diffMeal(comida, comio);
  const rows = comida.ingredientes.map((ing) => {
    if (diff.quitados.some((n) => sameName(n, ing.nombre))) {
      return `<li class="is-removed"><span>${esc(ing.nombre)}</span><span class="qty">quitado</span></li>`;
    }
    const c = diff.cambiados.find((x) => sameName(x.nombre, ing.nombre));
    if (c) {
      return `<li class="is-changed"><span>${esc(ing.nombre)}</span><span class="qty">${esc(c.despues || "—")}<span class="qty-ref">menú: ${esc(c.antes || "—")}</span></span></li>`;
    }
    return ingredientHTML(ing);
  });
  const added = diff.agregados.map(
    (a) => `<li class="is-added"><span>+ ${esc(a.nombre)}</span><span class="qty">${esc(a.cantidad || "")}</span></li>`,
  );
  const all = [...rows, ...added];
  return all.length ? `<ul class="meal-ingredients">${all.join("")}</ul>` : "";
}

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
      ${estado === "cambiado" ? `<p class="meal-swap">🔄 ${mark.comio ? "" : "Comiste: "}${esc(swapLabel(comida, mark))}</p>` : ""}

      ${
        folded
          ? comida.ingredientes.length || comida.nota
            ? `<button class="meal-toggle" data-action="toggle">${icon("chevron-down")} Ver ingredientes</button>`
            : ""
          : `
        ${
          estado === "cambiado" && mark.comio
            ? editedIngredientsHTML(comida, mark.comio)
            : comida.ingredientes.length
              ? `<ul class="meal-ingredients">${comida.ingredientes.map(ingredientHTML).join("")}</ul>`
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
          ${estado === "cambiado" ? `<button class="chip note" data-action="edit-swap">${icon("utensils")} Editar</button>` : ""}
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

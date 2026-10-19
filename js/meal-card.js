// Tarjeta de una comida: plato, ingredientes y los tres botones para marcar.
// La usan Hoy y la guía de estilos.

import { esc, icon } from "./ui.js";
import { momentoLabel, formatQty, etiquetaInfo } from "./logic/menu.js";
import { diffMeal, swapLabel, sameName } from "./logic/cambios.js";

// Íconos de Lucide; el color sale del estado (css: .mark-icon).
export const MARKS = [
  { id: "comido", icon: "check", label: "Comido" },
  { id: "cambiado", icon: "pencil-line", label: "Cambiado" },
  { id: "no", icon: "ban", label: "No" },
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

// Lo que comiste frente al menú: lo no comido "a la reserva", la cantidad nueva con la del menú debajo,
// lo agregado con "+" y lo que tomaste de la reserva con su comida de origen.
function editedIngredientsHTML(comida, comio) {
  const diff = diffMeal(comida, comio);
  const rows = comida.ingredientes.map((ing) => {
    if (diff.quitados.some((n) => sameName(n, ing.nombre))) {
      return `<li class="is-removed"><span>${esc(ing.nombre)}</span><span class="qty">a la reserva</span></li>`;
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
  const fromReserva = comio.ingredientes
    .filter((i) => i.de)
    .map(
      (i) =>
        `<li class="is-added"><span>+ ${esc(i.nombre)}</span><span class="qty">${esc(i.cantidad || "")}<span class="qty-ref">de ${esc(momentoLabel(i.de).toLowerCase())}</span></span></li>`,
    );
  const all = [...rows, ...added, ...fromReserva];
  return all.length ? `<ul class="meal-ingredients">${all.join("")}</ul>` : "";
}

// Estado en la esquina: círculo vacío si falta, o el ícono y la palabra si ya la marcaste.
function statusHTML(estado) {
  const m = MARKS.find((x) => x.id === estado);
  if (!m) return `<span class="meal-status" aria-label="Sin marcar"><span class="dot"></span></span>`;
  return `<span class="meal-status is-${m.id}"><span class="dot" data-state="${m.id}">${icon(m.icon)}</span>${m.label}</span>`;
}

// comida: del menú. mark: la marca guardada (o undefined).
// Tocar la tarjeta abre "¿Qué comiste?" (lo maneja la pantalla).
// open: si una comida ya marcada muestra sus ingredientes (marcadas se pliegan para que lo pendiente destaque).
export function mealCardHTML(comida, mark, { hasRecipe = false, open = false } = {}) {
  const estado = mark?.estado || "";
  const folded = estado && !open;
  const label = estado === "cambiado" ? swapLabel(comida, mark) : "";

  return `
    <article class="card meal" data-momento="${comida.momento}" ${estado ? `data-state="${estado}"` : ""} role="button" tabindex="0" aria-label="${esc(momentoLabel(comida.momento))}: ¿qué comiste?">
      <div class="meal-head">
        <span class="meal-moment">${esc(momentoLabel(comida.momento))}</span>
        <span class="meal-head-end">
          ${hasRecipe ? `<a class="icon-btn plain" href="#/receta/${encodeURIComponent(comida.recetaId)}" aria-label="Ver receta">${icon("book-open")}</a>` : ""}
          ${statusHTML(estado)}
        </span>
      </div>
      <h3 class="title meal-name">${esc(comida.plato)}</h3>
      ${estado === "cambiado" && label ? `<p class="meal-swap">${icon("pencil-line")}<span>${mark.comio ? "" : "Comiste: "}${esc(label)}</span></p>` : ""}

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

      ${
        estado
          ? `
        <div class="feedback">
          <button class="chip" data-like="up" aria-pressed="${mark.valoracion === "up"}" aria-label="Me gustó">${icon("thumbs-up")}</button>
          <button class="chip" data-like="down" aria-pressed="${mark.valoracion === "down"}" aria-label="No me gustó">${icon("thumbs-down")}</button>
          <button class="chip note" data-action="note">${icon("pencil")} ${mark.nota ? "Editar nota" : "Nota"}</button>
        </div>
        ${mark.nota ? `<p class="meal-user-note">“${esc(mark.nota)}”</p>` : ""}`
          : ""
      }
    </article>`;
}

// Etiquetas del día: Oficina, Gym… con su ícono.
export function tagsHTML(etiquetas) {
  if (!etiquetas.length) return "";
  return `<div class="tags">${etiquetas
    .map((t) => {
      const info = etiquetaInfo(t);
      return `<span class="tag tag-${info.tone}">${icon(info.icon)} ${esc(info.label)}</span>`;
    })
    .join("")}</div>`;
}

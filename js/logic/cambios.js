// "Cambiado": lo que de verdad comiste, editado a partir del menú (quitar, agregar, cambiar cantidades),
// y la diferencia con el menú, para verla en la tarjeta y mandarla en el resumen para Claude.

import { formatQty } from "./menu.js";

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const sameName = (a, b) => norm(a) === norm(b);

// El menú de una comida como punto de partida para editar: cantidades como texto ("2 piezas").
export function editableFrom(comida) {
  return {
    plato: comida.plato,
    ingredientes: comida.ingredientes.map((i) => ({ nombre: i.nombre, cantidad: formatQty(i.cantidad, i.unidad) })),
  };
}

// Qué cambió respecto al menú. Los ingredientes se comparan por nombre (sin acentos ni mayúsculas).
// Lo que tomaste de la reserva (con `de`) no cuenta aquí: se ve aparte.
export function diffMeal(comida, comio) {
  comio = { ...comio, ingredientes: comio.ingredientes.filter((i) => !i.de) };
  const original = editableFrom(comida);
  const before = new Map(original.ingredientes.map((i) => [norm(i.nombre), i]));
  const after = new Map(comio.ingredientes.map((i) => [norm(i.nombre), i]));

  const quitados = original.ingredientes.filter((i) => !after.has(norm(i.nombre))).map((i) => i.nombre);
  const agregados = comio.ingredientes.filter((i) => !before.has(norm(i.nombre)));
  const cambiados = comio.ingredientes
    .filter((i) => before.has(norm(i.nombre)) && norm(before.get(norm(i.nombre)).cantidad) !== norm(i.cantidad))
    .map((i) => ({ nombre: i.nombre, antes: before.get(norm(i.nombre)).cantidad, despues: i.cantidad }));

  return {
    plato: norm(comio.plato) && norm(comio.plato) !== norm(comida.plato) ? comio.plato.trim() : null,
    quitados,
    agregados,
    cambiados,
  };
}

export function hasChanges(diff) {
  return Boolean(diff.plato || diff.quitados.length || diff.agregados.length || diff.cambiados.length);
}

// "sin Tomate · Huevo: 2 piezas → 3 piezas · + Jamón 40 g"
export function describeDiff(diff) {
  return [
    ...diff.quitados.map((n) => `sin ${n}`),
    ...diff.cambiados.map((c) => `${c.nombre}: ${c.antes || "—"} → ${c.despues || "—"}`),
    ...diff.agregados.map((a) => `+ ${a.nombre}${a.cantidad ? ` ${a.cantidad}` : ""}`),
  ].join(" · ");
}

// Texto corto de lo que comiste en lugar del menú.
// Marcas viejas (antes de poder editar) solo tienen "sustituto".
export function swapLabel(comida, mark) {
  if (!mark?.comio) return mark?.sustituto || "otra cosa";
  const diff = diffMeal(comida, mark.comio);
  const detail = describeDiff(diff);
  if (diff.plato) return detail ? `${diff.plato} (${detail})` : diff.plato;
  return detail || "con cambios";
}

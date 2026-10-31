// Equivalencias: con qué puedes cambiar un ingrediente del menú y en qué cantidad.
// Los grupos vienen de Claude (JSON "equivalencias"); aquí solo se buscan y se ajustan a la porción del menú.

import { formatQty } from "./menu.js";

// Para comparar nombres: sin acentos ni mayúsculas, y cada palabra en singular ("Huevos" = "huevo").
const clave = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .map((w) => (w.length > 3 && /[dlnr]es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w))
    .join(" ");

const mismaUnidad = (a, b) => clave(a) === clave(b);

// Redondeo amable: gramos y mililitros de 5 en 5; lo demás de cuarto en cuarto (½ pieza, 1¼ taza).
function redondear(n, unidad) {
  if (/^(g|gr|gramos?|ml|mililitros?)$/i.test(String(unidad).trim())) return Math.max(5, Math.round(n / 5) * 5);
  return Math.max(0.25, Math.round(n * 4) / 4);
}

// ing: { nombre, cantidad, unidad } del menú. grupos: los importados.
// → null si no tiene equivalencias; si tiene: { grupo, opciones: [{ nombre, cantidad (texto), unidad, n }] }
//   ya ajustadas a la cantidad del menú (si el menú pone 2 mandarinas, las opciones son para 2), sin el propio ingrediente.
export function equivalentesDe(ing, grupos) {
  const k = clave(ing.nombre);
  for (const g of grupos || []) {
    const propio = g.items.find((it) => clave(it.nombre) === k);
    if (!propio) continue;
    const factor =
      typeof ing.cantidad === "number" && typeof propio.cantidad === "number" && propio.cantidad > 0 && mismaUnidad(ing.unidad, propio.unidad)
        ? ing.cantidad / propio.cantidad
        : 1;
    const opciones = g.items
      .filter((it) => it !== propio)
      .map((it) => {
        const n = typeof it.cantidad === "number" ? redondear(it.cantidad * factor, it.unidad) : it.cantidad;
        return { nombre: it.nombre, n, unidad: it.unidad, cantidad: formatQty(n, it.unidad) };
      });
    return { grupo: g.nombre, opciones };
  }
  return null;
}

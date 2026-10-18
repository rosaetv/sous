// Vocabulario fijo de los JSON que genera Claude.

export const MOMENTOS = [
  { id: "desayuno", label: "Desayuno" },
  { id: "colacion-manana", label: "Colación mañana" },
  { id: "comida", label: "Comida" },
  { id: "colacion-tarde", label: "Colación tarde" },
  { id: "cena", label: "Cena" },
];

export const CATEGORIAS = [
  { id: "comida", label: "Comida" },
  { id: "desayuno", label: "Desayuno" },
  { id: "colacion", label: "Colación" },
  { id: "modulo", label: "Módulo" },
  { id: "sazon", label: "Sazón" },
];

export const momentoLabel = (id) => MOMENTOS.find((m) => m.id === id)?.label || id;

// ---------- Etiquetas del día ----------
// El código solo conoce oficina y gym; cualquier otra etiqueta del JSON se muestra tal cual.
const ETIQUETAS = {
  oficina: { emoji: "🏢", label: "Oficina", tone: "blue" },
  gym: { emoji: "🏋️", label: "Gym", tone: "green" },
};

export function etiquetaInfo(tag) {
  return ETIQUETAS[tag] || { emoji: "📌", label: tag.charAt(0).toUpperCase() + tag.slice(1), tone: "peach" };
}

// Notas fijas que tocan hoy: las generales, más las que mencionan una etiqueta de hoy.
// (Una nota que menciona una etiqueta que hoy no tienes, no sale.)
export function notasDeHoy(notasFijas, etiquetasHoy, etiquetasSemana) {
  const lower = (s) => s.toLowerCase();
  return notasFijas.filter((nota) => {
    const mencionadas = etiquetasSemana.filter((tag) => lower(nota).includes(lower(tag)));
    return mencionadas.length === 0 || mencionadas.some((tag) => etiquetasHoy.includes(tag));
  });
}

// ---------- Cantidades ----------
const FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
const NO_PLURAL = new Set(["g", "kg", "mg", "ml", "l", "cl", "dl", "oz", "lb", ""]);

function formatNumber(n) {
  const whole = Math.trunc(n);
  const frac = Math.round((n - whole) * 100) / 100;
  if (FRACTIONS[frac]) return `${whole || ""}${FRACTIONS[frac]}`;
  return n.toLocaleString("es", { maximumFractionDigits: 2 });
}

// 2 + "pieza" → "2 piezas"; 1.5 + "taza" → "1½ tazas"; 100 + "g" → "100 g"
export function formatQty(cantidad, unidad = "") {
  if (cantidad == null || cantidad === "") return unidad;
  if (typeof cantidad !== "number") return [cantidad, unidad].filter(Boolean).join(" ");
  let unit = unidad;
  if (cantidad > 1 && !NO_PLURAL.has(unit.toLowerCase()) && !/s$/i.test(unit)) {
    unit = /[aeiouáéíóú]$/i.test(unit) ? `${unit}s` : `${unit}es`;
  }
  return [formatNumber(cantidad), unit].filter(Boolean).join(" ");
}

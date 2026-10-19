// Vocabulario fijo de los JSON que genera Claude, con los mismos nombres que usa el proyecto Health.
// id: cómo se guarda en el teléfono (no cambiarlo: las marcas ya guardadas lo usan).
// json: el nombre que pedimos a Claude. alias: otras formas que también se aceptan.

export const MOMENTOS = [
  { id: "desayuno", json: "desayuno", label: "Desayuno", alias: [] },
  { id: "colacion-manana", json: "colacion-matutina", label: "Colación matutina", alias: ["colacion-manana", "colacion am"] },
  { id: "comida", json: "comida", label: "Comida", alias: [] },
  { id: "colacion-tarde", json: "colacion-vespertina", label: "Colación vespertina", alias: ["colacion-tarde", "colacion pm", "merienda"] },
  { id: "cena", json: "cena", label: "Cena", alias: [] },
];

export const CATEGORIAS = [
  { id: "comida", label: "Comidas y cenas", alias: ["comidas", "comidas y cenas", "cena", "cenas"] },
  { id: "desayuno", label: "Desayunos", alias: ["desayunos"] },
  { id: "colacion", label: "Colaciones", alias: ["colaciones", "colaciones grab and go", "snack"] },
  { id: "modulo", label: "Módulos", alias: ["modulos", "modulos base"] },
  { id: "sazon", label: "Sazones", alias: ["sazones"] },
];

// Macros en pantalla, abreviados para que quepan (la clave es cómo se guardan).
export const MACROS_PANTALLA = [
  ["kcal", "kcal"],
  ["prot", "prot"],
  ["carb", "carb"],
  ["grasa", "grasa"],
  ["fibra", "fibra"],
];

// Para comparar sin acentos, mayúsculas, guiones ni espacios: "Colación matutina" = "colacion-matutina".
const flat = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

function find(list, value) {
  const v = flat(value);
  if (!v) return null;
  return list.find((x) => [x.id, x.json, x.label, ...x.alias].filter(Boolean).some((n) => flat(n) === v))?.id || null;
}

export const toMomento = (value) => find(MOMENTOS, value);
export const toCategoria = (value) => find(CATEGORIAS, value);

export const momentoLabel = (id) => MOMENTOS.find((m) => m.id === id)?.label || id;

// ---------- Etiquetas del día ----------
// El código solo conoce oficina y gym; cualquier otra etiqueta del JSON se muestra tal cual.
const ETIQUETAS = {
  oficina: { icon: "building-2", label: "Oficina", tone: "blue" },
  gym: { icon: "dumbbell", label: "Gym", tone: "green" },
};

export function etiquetaInfo(tag) {
  return ETIQUETAS[tag] || { icon: "pin", label: tag.charAt(0).toUpperCase() + tag.slice(1), tone: "peach" };
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


// La reserva del día: lo del menú que no comiste (o comiste de menos) en una comida ya marcada,
// para comerlo en otra comida del mismo día. Un día nuevo empieza de cero.
//
// Sale de las marcas, no se guarda aparte:
// - "No" (me la brinqué): toda la comida pasa a la reserva.
// - "Cambiado" con lo que comiste (comio): lo no palomeado pasa entero; si comiste de menos, pasa lo que sobró
//   ("Rice cake 2 piezas", comiste 1 → reserva "Rice cake 1 pieza").
// - Lo que otra comida toma de la reserva va en su comio con `de` (la comida de donde vino).

import { sameName } from "./cambios.js";
import { formatQty, momentoLabel } from "./menu.js";

const FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// "2 piezas" → { n: 2, unidad: "piezas" }; "1½ tazas" → { n: 1.5, … }; "al gusto" → null
export function parseQty(text) {
  const s = String(text ?? "").trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)?\s*([¼½¾⅓⅔])?/);
  if (!m || (!m[1] && !m[2])) return null;
  const n = (m[1] ? Number(m[1].replace(",", ".")) : 0) + (m[2] ? FRACTIONS[m[2]] : 0);
  return { n, unidad: s.slice(m[0].length).trim() };
}

// "piezas" → "pieza", "unidades" → "unidad", "g" → "g"
function singular(unidad) {
  if (/[dlnr]es$/i.test(unidad)) return unidad.slice(0, -2);
  if (/s$/i.test(unidad) && unidad.length > 2) return unidad.slice(0, -1);
  return unidad;
}

const sameUnit = (a, b) => !a || !b || norm(singular(a)) === norm(singular(b));

// Lo que queda de "total" después de comer "comido". null si no queda nada o no se puede calcular.
export function remainder(total, comido) {
  const a = parseQty(total);
  const b = parseQty(comido);
  if (!a || !b || !sameUnit(a.unidad, b.unidad)) return null;
  const rest = Math.round((a.n - b.n) * 100) / 100;
  return rest > 0 ? formatQty(rest, singular(a.unidad)) : null;
}

// Lo que sobró de una comida ya marcada: [{ nombre, cantidad, de }]
function sobrantes(comida, mark) {
  if (!mark || mark.estado === "comido") return [];
  const menu = comida.ingredientes.map((i) => ({ nombre: i.nombre, cantidad: formatQty(i.cantidad, i.unidad) }));
  if (mark.estado === "no") return menu.map((i) => ({ ...i, de: comida.momento }));
  if (!mark.comio) return []; // marcas viejas: solo decían qué comiste en su lugar
  return menu.flatMap((i) => {
    const comido = mark.comio.ingredientes.find((x) => !x.de && sameName(x.nombre, i.nombre));
    if (!comido) return [{ ...i, de: comida.momento }];
    const rest = remainder(i.cantidad, comido.cantidad);
    return rest ? [{ nombre: i.nombre, cantidad: rest, de: comida.momento }] : [];
  });
}

// La reserva del día: lo que sigue disponible (pendientes) y lo que ya se comió en otra comida (usados).
export function reservaDelDia(comidas, marks) {
  const tomados = comidas.flatMap((c) =>
    (marks[c.momento]?.comio?.ingredientes || []).filter((x) => x.de).map((x) => ({ ...x, a: c.momento })),
  );
  const pendientes = [];
  const usados = [];
  for (const s of comidas.flatMap((c) => sobrantes(c, marks[c.momento]))) {
    let rest = s.cantidad;
    for (const t of tomados.filter((x) => x.de === s.de && sameName(x.nombre, s.nombre))) {
      usados.push({ ...s, cantidad: t.cantidad, a: t.a });
      rest = rest ? remainder(rest, t.cantidad) : null;
    }
    if (rest) pendientes.push({ ...s, cantidad: rest });
  }
  return { pendientes, usados };
}

// Para el resumen: "Mandarina 1 pieza (de snack matutino) → la comí en la cena".
export function describeReserva(item) {
  const where = `${item.nombre}${item.cantidad ? ` ${item.cantidad}` : ""} (de ${momentoLabel(item.de).toLowerCase()})`;
  return item.a ? `${where} → la comí en ${momentoLabel(item.a).toLowerCase()}` : `${where} → no la comí`;
}

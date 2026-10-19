// Comer por partes y la reserva del día.
//
// - Palomear un ingrediente de una comida = esa comida ya se tuvo; lo que no se palomea queda en la reserva del día.
// - Desde la reserva, un ingrediente se puede agregar a otra comida del mismo día: se cuenta como comido ahí.
// - Lo palomeado no se puede despalomear. La reserva es solo de ese día: un día nuevo empieza de cero.
//
// En la marca de la comida: partes = nombres de los ingredientes que comiste.
// Lo movido se guarda aparte, por día: [{ nombre, de, a }] (de y a son momentos del día).

import { sameName } from "./cambios.js";
import { momentoLabel } from "./menu.js";

// Cada ingrediente de una comida por partes, con su estado: "comido", "movido" (a otra comida) o "reserva".
// null si la comida no se marcó por partes.
export function partsOf(comida, mark, movidos = []) {
  if (!mark?.partes || mark.estado === "cambiado") return null;
  return comida.ingredientes.map((ing) => {
    if (mark.partes.some((n) => sameName(n, ing.nombre))) return { ...ing, estado: "comido" };
    const mov = movidos.find((m) => m.de === comida.momento && sameName(m.nombre, ing.nombre));
    if (mov) return { ...ing, estado: "movido", a: mov.a };
    return { ...ing, estado: "reserva" };
  });
}

// Lo que sigue en la reserva del día (de todas las comidas marcadas por partes).
export function reservaDelDia(comidas, marks, movidos = []) {
  return comidas.flatMap((c) =>
    (partsOf(c, marks[c.momento], movidos) || []).filter((p) => p.estado === "reserva").map((p) => ({ ...p, de: c.momento })),
  );
}

// Lo que llegó de la reserva a esta comida (ya comido).
export function agregadosA(momento, comidas, movidos = []) {
  return movidos
    .filter((m) => m.a === momento)
    .map((m) => {
      const origen = comidas.find((c) => c.momento === m.de);
      const ing = origen?.ingredientes.find((i) => sameName(i.nombre, m.nombre));
      return { ...(ing || { nombre: m.nombre }), de: m.de };
    });
}

// Para el resumen: "sin Mandarina (la comí en la colación vespertina)" o "sin Mandarina (no la comí)".
export function describePartes(comida, mark, movidos = []) {
  const parts = partsOf(comida, mark, movidos);
  if (!parts) return "";
  return parts
    .filter((p) => p.estado !== "comido")
    .map((p) => `sin ${p.nombre} (${p.estado === "movido" ? `la comí en ${momentoLabel(p.a).toLowerCase()}` : "no la comí"})`)
    .join(" · ");
}

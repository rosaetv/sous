// Resumen de una semana en Markdown, para pegarlo en el chat de Claude y que el siguiente menú lo tome en cuenta.

import { shortDay, rangeLabel } from "./fechas.js";
import { momentoLabel } from "./menu.js";
import { itemState } from "./super.js";
import { swapLabel } from "./cambios.js";
import { reservaDelDia, describeReserva } from "./reserva.js";

// semana: la semana importada (con intercambios). plans: dayPlan de cada día.
// marks: lista de marcas de la semana. lista + listChecks (Map id → valor): la lista del súper, si hay.
// borradas: recetas que borraste del recetario de la app esa semana ([{ id, nombre }]).
export function buildSummary({ semana, plans, marks, lista = null, listChecks = new Map(), borradas = [] }) {
  const byKey = new Map(marks.map((m) => [`${m.fecha}|${m.momento}`, m]));
  const lines = [`## Resumen semana ${rangeLabel(semana.inicio, semana.fin)}`, ""];

  // ---------- Cumplimiento ----------
  let total = 0;
  const count = { comido: 0, cambiado: 0, no: 0 };
  const cambios = [];
  const entries = []; // comidas marcadas, en orden, para 👍 / 👎 / notas
  for (const plan of plans) {
    for (const comida of plan.comidas) {
      total++;
      const mark = byKey.get(`${plan.fecha}|${comida.momento}`);
      if (!mark) continue;
      count[mark.estado]++;
      const plato = mark.plato || comida.plato;
      const where = `${shortDay(plan.fecha)} · ${momentoLabel(comida.momento)} · ${plato}`;
      const nota = mark.nota ? ` — "${mark.nota}"` : "";
      if (mark.estado === "cambiado") cambios.push(`- ${where} → 🔄 ${swapLabel(comida, mark)}${nota}`);
      if (mark.estado === "no") cambios.push(`- ${where} → ❌ No${nota}`);
      // Lo que valoras es lo que comiste: si cambiaste el plato, el nuevo.
      const nombre = mark.estado === "cambiado" ? mark.comio?.plato || mark.sustituto || "Otra cosa" : plato;
      entries.push({ ...mark, nombre, enCambios: mark.estado !== "comido" });
    }
  }
  const sinMarcar = total - count.comido - count.cambiado - count.no;
  const pct = total ? Math.round((count.comido / total) * 100) : 0;
  const rest = [plural(count.cambiado, "cambiada", "cambiadas"), plural(count.no, "no comida", "no comidas"), plural(sinMarcar, "sin marcar", "sin marcar")]
    .filter(Boolean)
    .join(", ");
  lines.push(`Cumplimiento: ${count.comido} de ${total} comidas como el menú (${pct} %).${rest ? ` ${rest}.` : ""}`);

  section(lines, "Cambios y no comidas", cambios);

  // ---------- Intercambios de día ----------
  const swaps = [];
  const map = semana.intercambios || {};
  for (const [fecha, origen] of Object.entries(map).sort()) {
    if (map[origen] === fecha) {
      if (fecha < origen) swaps.push(`- ${shortDay(fecha)} ↔ ${shortDay(origen)}`);
    } else {
      swaps.push(`- El ${shortDay(fecha)} comí el menú del ${shortDay(origen)}`);
    }
  }
  section(lines, "Intercambios de día", swaps);

  // ---------- Reserva del día ----------
  // Lo que no comiste o te sobró en una comida: si te lo comiste en otra, o no.
  // (De una comida que te brincaste solo sale lo que sí comiste después; el resto ya dice "❌ No".)
  const reserva = plans.flatMap((plan) => {
    const dayMarks = Object.fromEntries(marks.filter((m) => m.fecha === plan.fecha).map((m) => [m.momento, m]));
    const { pendientes, usados } = reservaDelDia(plan.comidas, dayMarks);
    const sinComer = pendientes.filter((p) => dayMarks[p.de]?.estado !== "no");
    return [...usados, ...sinComer].map((item) => `- ${shortDay(plan.fecha)} · ${describeReserva(item)}`);
  });
  section(lines, "Reserva del día", reserva);

  // ---------- Recetas que borré (para quitarlas también de recetario.md) ----------
  section(lines, "Recetas que borré del recetario", borradas.map((b) => `- ${b.nombre} (${b.id})`));

  // ---------- 👍 / 👎 ----------
  section(lines, "👍 Me gustó", grouped(entries.filter((e) => e.valoracion === "up")));
  section(lines, "👎 No me gustó", grouped(entries.filter((e) => e.valoracion === "down")));

  // Notas sueltas (de comidas sin 👍/👎 que no salieron ya en cambios)
  section(
    lines,
    "Notas",
    entries.filter((e) => e.nota && !e.valoracion && !e.enCambios).map((e) => `- ${e.nombre} — "${e.nota}"`),
  );

  // ---------- Súper ----------
  if (lista) {
    const faltas = lista.items.flatMap((item) => {
      const { estado, llevo } = itemState(listChecks.get(item.id));
      if (estado === "nohabia") return [`- ${item.nombre} (no había)`];
      if (estado === "parcial") return [`- ${item.nombre} (llevé ${llevo || "una parte"}${item.cantidad ? ` de ${item.cantidad}` : ""})`];
      return [];
    });
    section(lines, "En el súper faltó", faltas);
  }

  return lines.join("\n").trim() + "\n";
}

function plural(n, one, many) {
  return n ? `${n} ${n === 1 ? one : many}` : "";
}

function section(lines, title, items) {
  if (!items.length) return;
  lines.push("", `### ${title}`, ...items);
}

// "Wok de pollo (2 veces)" y sus notas: "Lentejas exprés — "muy fácil""
function grouped(entries) {
  const groups = new Map();
  for (const e of entries) {
    const g = groups.get(e.nombre) || { n: 0, notas: [] };
    g.n++;
    if (e.nota) g.notas.push(`"${e.nota}"`);
    groups.set(e.nombre, g);
  }
  return [...groups].map(([name, g]) => `- ${name}${g.n > 1 ? ` (${g.n} veces)` : ""}${g.notas.length ? ` — ${g.notas.join("; ")}` : ""}`);
}

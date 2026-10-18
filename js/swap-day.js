// Intercambiar el menú de un día con el de otro día de la semana (el día completo).
// Lo usan Hoy y Semana.

import { esc, icon, openSheet, askSheet, toast } from "./ui.js";
import { shortDay } from "./logic/fechas.js";
import { etiquetaInfo } from "./logic/menu.js";
import { dayPlan, marksFor, swapDays } from "./store.js";

// Días con los que se puede intercambiar: los que faltan esta semana (los pasados ya se comieron).
export function swapTargets(semana, fecha, today) {
  return semana.dias
    .map((d) => d.fecha)
    .filter((f) => f !== fecha && f >= today)
    .map((f) => ({ fecha: f, plan: dayPlan(semana, f) }))
    .filter((o) => o.plan);
}

// ¿El menú de otro día estaba pensado para un tipo de día que este no es? (oficina, gym)
// Solo avisa en ese sentido: al revés saldría en casi todos los días y dejaría de servir.
function mismatch(etiquetasDia, etiquetasMenu) {
  const tag = ["oficina", "gym"].find((t) => etiquetasMenu.includes(t) && !etiquetasDia.includes(t));
  return tag ? `Era para día de ${etiquetaInfo(tag).label.toLowerCase()}` : "";
}

// Abre la lista de días, pide confirmación si hay marcas e intercambia.
// Devuelve true si se intercambió.
export function chooseAndSwap({ semana, fecha, today }) {
  const plan = dayPlan(semana, fecha);
  const isToday = fecha === today;
  const options = swapTargets(semana, fecha, today);

  return new Promise((resolve) => {
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Qué menú comes ${isToday ? "hoy" : `el ${esc(shortDay(fecha))}`}?</h2>
      <p class="muted" style="margin-top: 4px">Se intercambia el día completo. Puedes deshacerlo.</p>
      <div class="day-options">
        ${options
          .map(({ fecha: f, plan: p }) => {
            const main = p.comidas.find((c) => c.momento === "comida") || p.comidas[0];
            const warn = mismatch(plan.etiquetas, p.etiquetasOrigen);
            return `
            <button class="day-option" data-day="${f}">
              <span class="day-option-date">${esc(shortDay(f))}</span>
              <span class="day-option-text">
                <span>${esc(main?.plato || "")}</span>
                ${warn ? `<span class="day-option-warn">${icon("info")} ${esc(warn)}</span>` : ""}
              </span>
              ${icon("chevron-right", "icon chevron")}
            </button>`;
          })
          .join("")}
      </div>`,
      { label: "Elegir otro menú", onClose: () => resolve(false) },
    );

    sheet.addEventListener("click", async (e) => {
      const other = e.target.closest("[data-day]")?.dataset.day;
      if (!other) return;
      close();
      const [marksA, marksB] = await Promise.all([marksFor(fecha), marksFor(other)]);
      if (Object.keys(marksA).length || Object.keys(marksB).length) {
        const answer = await askSheet({
          title: "Ya marcaste comidas de estos días",
          text: "Las marcas se quedan en su día; solo cambia el menú.",
          actions: [
            { id: "swap", label: "Intercambiar", style: "primary" },
            { id: "cancel", label: "Cancelar", style: "ghost" },
          ],
        });
        if (answer !== "swap") return resolve(false);
      }
      await swapDays(semana.inicio, fecha, other);
      toast(`Listo: ${isToday ? "hoy" : `el ${shortDay(fecha)}`} comes el menú del ${shortDay(other)}`);
      resolve(true);
    });
  });
}

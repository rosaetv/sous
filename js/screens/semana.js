// Semana: los 7 días plegables con el estado de cada comida y macros. El mealprep va dentro de su día
// (el que nombra "cuando"), después de la cena. Si no nombra un día, va al final de la semana.
// Semanas anteriores (#/semana/2026-10-12): se pueden abrir sus días para marcar y dar feedback;
// lo único que no se puede es intercambiar días que ya pasaron.

import { esc, icon, emptyState, toast } from "../ui.js";
import { todayISO, shortDay, rangeLabel } from "../logic/fechas.js";
import { momentoLabel, etiquetaInfo, MACROS_PANTALLA } from "../logic/menu.js";
import { allWeeks, defaultWeek, dayPlan, marksBetween, checksWithPrefix, swapDays, recipesById } from "../store.js";
import { swapTargets, chooseAndSwap } from "../swap-day.js";
import { swapLabel } from "../logic/cambios.js";
import { batchCardHTML, toggleBatchCheck } from "../batch-card.js";
import { progresoBatch, fechaDelBatch } from "../logic/batch.js";

const STATE_ICON = { comido: "check", cambiado: "pencil-line", no: "ban" };
const MACROS = MACROS_PANTALLA;

function dot(estado) {
  return `<span class="dot" data-state="${estado || ""}">${estado ? icon(STATE_ICON[estado]) : ""}</span>`;
}

function macrosGrid(macros) {
  if (!macros) return "";
  const cells = MACROS.filter(([key]) => macros[key] != null);
  if (!cells.length) return "";
  return `
    <div class="macros">
      ${cells
        .map(([key, label]) => `<div class="macro"><span class="macro-value">${macros[key].toLocaleString("es")}${key === "kcal" ? "" : " g"}</span><span class="macro-label">${label}</span></div>`)
        .join("")}
    </div>`;
}

export async function renderSemana(view, inicioParam) {
  const today = todayISO();
  const semanas = await allWeeks();
  const semana = inicioParam ? semanas.find((s) => s.inicio === inicioParam) : defaultWeek(semanas, today);

  if (!semana) {
    view.innerHTML = `
      <h1 class="screen-title">Semana</h1>
      ${emptyState({
        iconName: "calendar-days",
        title: "Aún no hay menú",
        text: "Pega el menú que te dio Claude y aquí verás los 7 días, los macros y el batch.",
        action: `<a class="btn btn-primary" href="#/importar">${icon("clipboard-paste")} Importar menú</a>`,
      })}`;
    return;
  }

  const index = semanas.indexOf(semana);
  const prev = semanas[index - 1];
  const next = semanas[index + 1];
  const isPastWeek = semana.fin < today;
  const isCurrent = semana.inicio <= today && semana.fin >= today;

  const marks = await marksBetween(semana.inicio, semana.fin);
  const byDay = {};
  marks.forEach((m) => ((byDay[m.fecha] ||= {})[m.momento] = m));
  const [batchChecks, recetas] = await Promise.all([checksWithPrefix(`${semana.inicio}|batch|`), recipesById()]);
  // El batch se abre solo si le faltan pasos.
  const batchOpen = new Set(
    semana.batch.map((b, i) => i).filter((i) => {
      const { hechos, total } = progresoBatch(semana.inicio, i, semana.batch[i], batchChecks);
      return hechos < total;
    }),
  );

  // Abierto por defecto: hoy (o el primer día si no es esta semana).
  const open = new Set([isCurrent ? today : semana.dias[0]?.fecha]);

  const all = semana.dias.map((d) => dayPlan(semana, d.fecha)).filter(Boolean);
  const totals = { comido: 0, cambiado: 0, no: 0 };
  let meals = 0;
  all.forEach((plan) =>
    plan.comidas.forEach((c) => {
      meals++;
      const estado = byDay[plan.fecha]?.[c.momento]?.estado;
      if (estado) totals[estado]++;
    }),
  );
  const marked = totals.comido + totals.cambiado + totals.no;

  function dayHTML(plan) {
    const dayMarks = byDay[plan.fecha] || {};
    const isOpen = open.has(plan.fecha);
    const isPast = plan.fecha < today;
    const canSwap = !isPast && swapTargets(semana, plan.fecha, today).length > 0;
    const swapped = plan.origen !== plan.fecha;

    return `
      <article class="card day ${plan.fecha === today ? "is-today" : ""}" data-fecha="${plan.fecha}">
        <button class="day-head" data-action="toggle" aria-expanded="${isOpen}">
          <span class="day-head-text">
            <span class="day-name">${esc(shortDay(plan.fecha))}${plan.fecha === today ? ` <span class="today-badge">Hoy</span>` : ""}</span>
            <span class="day-meta">
              ${plan.etiquetas.map((t) => `<span title="${esc(etiquetaInfo(t).label)}">${icon(etiquetaInfo(t).icon)}</span>`).join("")}
              ${batchDay.includes(plan.fecha) ? `<span title="Mealprep">${icon("cooking-pot")}</span>` : ""}
              ${swapped ? `<span class="day-swapped">${icon("arrow-left-right")} menú del ${esc(shortDay(plan.origen))}</span>` : ""}
            </span>
          </span>
          <span class="dots">${plan.comidas.map((c) => dot(dayMarks[c.momento]?.estado)).join("")}</span>
          ${icon(isOpen ? "chevron-up" : "chevron-down", "icon chevron")}
        </button>
        ${
          isOpen
            ? `
          <div class="day-body">
            <ul class="day-meals">
              ${plan.comidas
                .map((c) => {
                  const m = dayMarks[c.momento];
                  return `
                  <li>
                    ${dot(m?.estado)}
                    <span class="day-meal-text">
                      <span class="day-meal-moment">${esc(momentoLabel(c.momento))}${c.hora ? ` · ${esc(c.hora)}` : ""}</span>
                      <span class="${m?.estado === "no" ? "muted" : ""}">${esc(c.plato)}</span>
                      ${m?.estado === "cambiado" ? `<span class="day-meal-swap">→ ${esc(swapLabel(c, m))}</span>` : ""}
                    </span>
                  </li>`;
                })
                .join("")}
            </ul>
            ${batchCards(plan.fecha)}
            ${macrosGrid(plan.macros)}
            ${`
              <div class="day-actions">
                <a class="btn btn-secondary" href="#/dia/${plan.fecha}">${plan.fecha === today ? "Abrir hoy" : isPast ? "Abrir para marcar" : "Abrir día"}</a>
                ${
                  swapped && !isPast
                    ? `<button class="btn btn-secondary" data-action="undo-swap">${icon("undo-2")} Deshacer</button>`
                    : canSwap
                      ? `<button class="btn btn-secondary" data-action="swap">${icon("arrow-left-right")} Intercambiar</button>`
                      : ""
                }
              </div>`}
          </div>`
            : ""
        }
      </article>`;
  }

  // Qué mealprep va después de cada día (null = sin día reconocible: al final).
  const batchDay = semana.batch.map((b) => fechaDelBatch(b.cuando, semana.inicio, semana.fin));
  const batchCards = (fecha) =>
    semana.batch
      .map((_, i) => i)
      .filter((i) => batchDay[i] === fecha)
      .map((i) => batchCardHTML({ semana, i, checks: batchChecks, recetas, open: batchOpen.has(i) }))
      .join("");

  function render() {
    view.innerHTML = `
      <h1 class="screen-title screen-title-with-sub">Semana</h1>
      <div class="week-nav">
        <p class="week-range">
          <span>${esc(rangeLabel(semana.inicio, semana.fin))}</span>
          <span class="small muted">${isPastWeek ? "Semana pasada" : isCurrent ? "Esta semana" : "Próxima semana"}</span>
        </p>
        ${prev ? `<a class="icon-btn" href="#/semana/${prev.inicio}" aria-label="Semana anterior">${icon("chevron-left")}</a>` : `<span class="icon-btn is-off" aria-hidden="true">${icon("chevron-left")}</span>`}
        ${next ? `<a class="icon-btn" href="#/semana/${next.inicio}" aria-label="Semana siguiente">${icon("chevron-right")}</a>` : `<span class="icon-btn is-off" aria-hidden="true">${icon("chevron-right")}</span>`}
      </div>

      <div class="card week-summary">
        <div class="week-bar">
          ${[["comido", totals.comido], ["cambiado", totals.cambiado], ["no", totals.no], ["", meals - marked]]
            .filter(([, n]) => n > 0)
            .map(([estado, n]) => `<span data-state="${estado}" style="flex: ${n}"></span>`)
            .join("")}
        </div>
        <p class="small muted">${marked} de ${meals} comidas marcadas</p>
        <p class="week-counts"><span class="meta-tag is-eaten">${icon("check")} ${totals.comido}</span><span class="meta-tag is-swapped">${icon("pencil-line")} ${totals.cambiado}</span><span class="meta-tag is-skipped">${icon("ban")} ${totals.no}</span></p>
      </div>

      <div class="stack days">${all.map(dayHTML).join("")}${batchCards(null)}</div>
      <a class="btn btn-ghost btn-block week-summary-link" href="#/resumen/${semana.inicio}">${icon("message-square-text")} Resumen para Claude</a>`;
  }

  render();

  view.onclick = async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const fecha = event.target.closest(".day")?.dataset.fecha;

    if (action === "toggle" && fecha) {
      open.has(fecha) ? open.delete(fecha) : open.add(fecha);
      render();
      return;
    }

    if (action === "swap" && fecha) {
      if (await chooseAndSwap({ semana, fecha, today })) renderSemana(view, inicioParam);
      return;
    }

    if (action === "undo-swap" && fecha) {
      await swapDays(semana.inicio, fecha, dayPlan(semana, fecha).origen);
      toast("Volviste al menú original");
      renderSemana(view, inicioParam);
      return;
    }

    if (action === "batch-toggle") {
      const i = Number(event.target.closest("[data-batch]").dataset.batch);
      batchOpen.has(i) ? batchOpen.delete(i) : batchOpen.add(i);
      render();
      return;
    }

    await toggleBatchCheck(event, semana, batchChecks);
  };
}

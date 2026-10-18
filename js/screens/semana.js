// Semana: los 7 días plegables con el estado de cada comida, macros y el batch como checklist.
// Semanas anteriores (#/semana/2026-10-12): se pueden abrir sus días para marcar y dar feedback;
// lo único que no se puede es intercambiar días que ya pasaron.

import { esc, icon, emptyState, toast } from "../ui.js";
import { todayISO, shortDay, rangeLabel } from "../logic/fechas.js";
import { momentoLabel, etiquetaInfo } from "../logic/menu.js";
import { allWeeks, defaultWeek, dayPlan, marksBetween, checksWithPrefix, setCheck, swapDays } from "../store.js";
import { swapTargets, chooseAndSwap } from "../swap-day.js";

const STATE_ICON = { comido: "check", cambiado: "refresh-cw", no: "x" };
const MACROS = [
  ["kcal", "kcal"],
  ["prot", "prot"],
  ["carb", "carb"],
  ["grasa", "grasa"],
  ["fibra", "fibra"],
];

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
        emoji: "🗓️",
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
  const batchChecks = await checksWithPrefix(`${semana.inicio}|batch|`);

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
              ${plan.etiquetas.map((t) => `<span title="${esc(etiquetaInfo(t).label)}">${etiquetaInfo(t).emoji}</span>`).join("")}
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
                      <span class="day-meal-moment">${esc(momentoLabel(c.momento))}</span>
                      <span class="${m?.estado === "no" ? "muted" : ""}">${esc(c.plato)}</span>
                      ${m?.estado === "cambiado" ? `<span class="day-meal-swap">→ ${esc(m.sustituto || "otra cosa")}</span>` : ""}
                    </span>
                  </li>`;
                })
                .join("")}
            </ul>
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

  function batchHTML() {
    if (!semana.batch.length) return "";
    return `
      <h2 class="title section-title">Batch</h2>
      <div class="stack">
        ${semana.batch
          .map(
            (b, i) => `
          <section class="card batch">
            ${b.cuando ? `<p class="batch-when">${icon("clock")} ${esc(b.cuando)}</p>` : ""}
            <ul class="checklist">
              ${b.pasos
                .map((paso, j) => {
                  const key = `${semana.inicio}|batch|${i}|${j}`;
                  const on = batchChecks.has(key);
                  return `
                  <li>
                    <button class="check-row" data-check="${key}" aria-pressed="${on}">
                      <span class="checkbox">${icon("check")}</span>
                      <span>${esc(paso)}</span>
                    </button>
                  </li>`;
                })
                .join("")}
            </ul>
          </section>`,
          )
          .join("")}
      </div>`;
  }

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
        <p class="small muted">${marked} de ${meals} comidas marcadas · ✅ ${totals.comido} · 🔄 ${totals.cambiado} · ❌ ${totals.no}</p>
      </div>

      <div class="stack days">${all.map(dayHTML).join("")}</div>
      ${batchHTML()}
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

    const check = event.target.closest("[data-check]");
    if (check) {
      const key = check.dataset.check;
      const on = !batchChecks.has(key);
      on ? batchChecks.add(key) : batchChecks.delete(key);
      check.setAttribute("aria-pressed", on);
      await setCheck(key, on);
    }
  };
}

// Hoy: las comidas del día para marcar. También sirve para cualquier otro día (#/dia/2026-10-20).

import { esc, icon, emptyState, openSheet, toast } from "../ui.js";
import { todayISO, fromISO, shortDay, addDays } from "../logic/fechas.js";
import { notasDeHoy } from "../logic/menu.js";
import { mealCardHTML, tagsHTML, SWAP_SUGGESTIONS } from "../meal-card.js";
import { weekFor, dayPlan, marksFor, setMark, clearMark, updateMark, swapDays, recipeIds } from "../store.js";
import { swapTargets, chooseAndSwap } from "../swap-day.js";

function longDate(fecha) {
  const text = fromISO(fecha).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  return text[0].toUpperCase() + text.slice(1); // "Domingo, 18 de octubre"
}

// Título arriba (igual en todas las pantallas), la fecha debajo y flechas para ir al día anterior o siguiente
// (para marcar o dar feedback de ayer, o ver mañana).
function header(fecha, isToday) {
  const today = todayISO();
  const href = (f) => (f === today ? "#/hoy" : `#/dia/${f}`);
  return `
    <h1 class="screen-title screen-title-with-sub">${isToday ? "Hoy" : esc(longDate(fecha).split(",")[0])}</h1>
    <div class="week-nav day-nav">
      <p class="day-nav-date">${esc(longDate(fecha))}${isToday ? "" : ` · <a href="#/hoy">Ir a hoy</a>`}</p>
      <a class="icon-btn" href="${href(addDays(fecha, -1))}" aria-label="Día anterior">${icon("chevron-left")}</a>
      <a class="icon-btn" href="${href(addDays(fecha, 1))}" aria-label="Día siguiente">${icon("chevron-right")}</a>
    </div>`;
}

function progressHTML(comidas, marks) {
  const done = comidas.filter((c) => marks[c.momento]).length;
  return `
    <div class="card progress">
      <div class="progress-bar">${comidas.map((c) => `<span data-state="${marks[c.momento]?.estado || ""}"></span>`).join("")}</div>
      <p class="small muted">${done === comidas.length ? "¡Listo! " : ""}${done} de ${comidas.length} comidas marcadas</p>
    </div>`;
}

function macrosLine(macros) {
  if (!macros) return "";
  const parts = [
    macros.kcal != null && `${macros.kcal.toLocaleString("es")} kcal`,
    macros.prot != null && `${macros.prot} g proteína`,
    macros.fibra != null && `${macros.fibra} g fibra`,
  ].filter(Boolean);
  return parts.length ? `<p class="small muted day-macros">${parts.join(" · ")}</p>` : "";
}

export async function renderHoy(view, fechaParam) {
  const today = todayISO();
  const fecha = fechaParam || today;
  const isToday = fecha === today;

  const semana = await weekFor(fecha);
  const plan = dayPlan(semana, fecha);

  if (!plan) {
    view.innerHTML = `
      ${header(fecha, isToday)}
      ${emptyState({
        emoji: "🍽️",
        title: semana ? "Este día no tiene menú" : isToday ? "Aún no hay menú para hoy" : "No hay menú para este día",
        text: "Pega el menú que te dio Claude y aquí verás tus comidas.",
        action: `<a class="btn btn-primary" href="#/importar">${icon("clipboard-paste")} Importar menú</a>`,
      })}`;
    return;
  }

  const [marks, recetas] = await Promise.all([marksFor(fecha), recipeIds()]);
  const open = new Set(); // comidas marcadas con los ingredientes abiertos
  const etiquetasSemana = [...new Set(semana.dias.flatMap((d) => d.etiquetas))];
  const notas = notasDeHoy(semana.notasFijas, plan.etiquetas, etiquetasSemana);

  const swapOptions = swapTargets(semana, fecha, today);

  const card = (comida) =>
    mealCardHTML(comida, marks[comida.momento], { hasRecipe: comida.recetaId && recetas.has(comida.recetaId), open: open.has(comida.momento) });

  view.innerHTML = `
    ${header(fecha, isToday)}
    ${
      plan.origen !== fecha
        ? `<p class="swap-banner">${icon("arrow-left-right")}<span>Comes el menú del ${esc(shortDay(plan.origen))}</span>
             <button class="link-btn" data-action="undo-swap">Deshacer</button></p>`
        : ""
    }
    ${tagsHTML(plan.etiquetas)}
    ${notas.length ? `<ul class="day-notes">${notas.map((n) => `<li>${icon("pin")}<span>${esc(n)}</span></li>`).join("")}</ul>` : ""}
    <div class="day-progress">${progressHTML(plan.comidas, marks)}</div>
    ${macrosLine(plan.macros)}
    <div class="stack meals">${plan.comidas.map(card).join("")}</div>
    ${
      swapOptions.length
        ? `<button class="btn btn-ghost btn-block swap-day" data-action="swap-day">${icon("arrow-left-right")} Comer otro menú ${isToday ? "hoy" : "este día"}</button>`
        : ""
    }`;

  // Vuelve a dibujar una tarjeta (y el progreso) sin recargar la pantalla.
  function refresh(momento, { animate = false } = {}) {
    const comida = plan.comidas.find((c) => c.momento === momento);
    const old = view.querySelector(`.meal[data-momento="${momento}"]`);
    old.outerHTML = card(comida);
    view.querySelector(".day-progress").innerHTML = progressHTML(plan.comidas, marks);
    if (animate && marks[momento]) {
      view.querySelector(`.meal[data-momento="${momento}"] [data-mark="${marks[momento].estado}"]`)?.classList.add("just-marked");
    }
  }

  async function mark(comida, estado, sustituto = "") {
    // Se ve al instante; se guarda justo después.
    marks[comida.momento] = { ...marks[comida.momento], estado, sustituto };
    open.delete(comida.momento);
    refresh(comida.momento, { animate: true });
    marks[comida.momento] = await setMark(fecha, comida, { estado, sustituto });
  }

  function askWhatYouAte(comida) {
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Qué comiste?</h2>
      <p class="muted" style="margin-top: 4px">En lugar de ${esc(comida.plato)}</p>
      <div class="chips" style="margin-top: 20px">
        ${SWAP_SUGGESTIONS.map((s) => `<button class="chip" data-suggestion="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>
      <form class="stack" style="margin-top: 16px; gap: 8px">
        <input class="field" name="what" placeholder="O escríbelo aquí" autocomplete="off" enterkeyhint="done" />
        <button class="btn btn-primary btn-block">Guardar</button>
      </form>`,
      { label: "Qué comiste" },
    );
    const save = (text) => {
      close();
      mark(comida, "cambiado", text.trim());
    };
    sheet.addEventListener("click", (e) => {
      const s = e.target.closest("[data-suggestion]")?.dataset.suggestion;
      if (s) save(s); // una sugerencia guarda con un solo toque
    });
    sheet.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      save(e.target.what.value);
    });
  }

  function askNote(comida) {
    const current = marks[comida.momento]?.nota || "";
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">Nota</h2>
      <p class="muted" style="margin-top: 4px">${esc(comida.plato)}</p>
      <form class="stack" style="margin-top: 20px; gap: 8px">
        <input class="field" name="note" value="${esc(current)}" placeholder="Por ejemplo: muy fácil" autocomplete="off" maxlength="140" enterkeyhint="done" />
        <button class="btn btn-primary btn-block">Guardar</button>
      </form>`,
      { label: "Nota" },
    );
    sheet.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      close();
      marks[comida.momento] = await updateMark(fecha, comida.momento, { nota: e.target.note.value.trim() });
      refresh(comida.momento);
    });
  }

  async function chooseDay() {
    if (await chooseAndSwap({ semana, fecha, today })) renderHoy(view, fechaParam);
  }

  view.onclick = async (event) => {
    const cardEl = event.target.closest(".meal");
    const comida = cardEl && plan.comidas.find((c) => c.momento === cardEl.dataset.momento);
    const markBtn = event.target.closest("[data-mark]");
    const likeBtn = event.target.closest("[data-like]");
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (comida && markBtn) {
      const estado = markBtn.dataset.mark;
      if (marks[comida.momento]?.estado === estado) {
        // Tocar el botón ya elegido lo desmarca.
        delete marks[comida.momento];
        refresh(comida.momento);
        await clearMark(fecha, comida.momento);
      } else if (estado === "cambiado") {
        askWhatYouAte(comida);
      } else {
        mark(comida, estado);
      }
      return;
    }

    if (comida && likeBtn) {
      const value = likeBtn.dataset.like;
      const valoracion = marks[comida.momento].valoracion === value ? null : value;
      marks[comida.momento] = await updateMark(fecha, comida.momento, { valoracion });
      refresh(comida.momento);
      return;
    }

    if (comida && action === "note") return askNote(comida);

    if (comida && action === "toggle") {
      open.has(comida.momento) ? open.delete(comida.momento) : open.add(comida.momento);
      refresh(comida.momento);
      return;
    }

    if (action === "swap-day") return chooseDay();

    if (action === "undo-swap") {
      await swapDays(semana.inicio, fecha, plan.origen);
      toast("Volviste al menú original");
      renderHoy(view, fechaParam);
    }
  };
}

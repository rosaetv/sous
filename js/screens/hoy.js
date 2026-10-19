// Hoy: las comidas del día para marcar. También sirve para cualquier otro día (#/dia/2026-10-20).

import { esc, icon, emptyState, openSheet, toast } from "../ui.js";
import { todayISO, fromISO, shortDay, addDays } from "../logic/fechas.js";
import { notasDeHoy, momentoLabel } from "../logic/menu.js";
import { partsOf, reservaDelDia, agregadosA } from "../logic/reserva.js";
import { mealCardHTML, tagsHTML } from "../meal-card.js";
import { editableFrom, diffMeal, hasChanges } from "../logic/cambios.js";
import { weekFor, dayPlan, marksFor, setMark, clearMark, updateMark, swapDays, recipeIds, recipesById, checksWithPrefix } from "../store.js";
import { checkParte, checkAllPartes, movidosDe, moverDeReserva } from "../store.js";
import { swapTargets, chooseAndSwap } from "../swap-day.js";
import { batchCardHTML, toggleBatchCheck } from "../batch-card.js";
import { fechaDelBatch, progresoBatch } from "../logic/batch.js";

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

// Notas fijas plegadas por defecto: una línea ("3 notas para hoy") que se abre al tocarla.
// Se recuerda si la dejaste abierta (solo en este teléfono).
const NOTES_KEY = "sous-notas-abiertas";
function notesOpen() {
  try {
    return localStorage.getItem(NOTES_KEY) === "1";
  } catch {
    return false;
  }
}

function notesHTML(notas) {
  const open = notesOpen();
  return `
    <button class="notes-toggle" data-action="notes" aria-expanded="${open}">
      ${icon("pin")}<span class="grow">${notas.length === 1 ? "1 nota para hoy" : `${notas.length} notas para hoy`}</span>
      ${icon(open ? "chevron-up" : "chevron-down", "icon chevron")}
    </button>
    ${open ? `<ul class="day-notes">${notas.map((n) => `<li><span>${esc(n)}</span></li>`).join("")}</ul>` : ""}`;
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
  let movidos = await movidosDe(fecha); // lo que pasó de la reserva a otra comida (solo este día)
  const open = new Set(); // comidas marcadas con los ingredientes abiertos
  const partesOpen = new Set(); // comidas con "Por partes" abierto (se quedan arriba mientras palomeas)
  let reservaOpen = false;
  const etiquetasSemana = [...new Set(semana.dias.flatMap((d) => d.etiquetas))];
  const notas = notasDeHoy(semana.notasFijas, plan.etiquetas, etiquetasSemana);

  const swapOptions = swapTargets(semana, fecha, today);

  // El mealprep que toca este día (si "cuando" nombra el día de la semana), después de la cena.
  const batchHoy = semana.batch.map((b, i) => i).filter((i) => fechaDelBatch(semana.batch[i].cuando, semana.inicio, semana.fin) === fecha);
  const [batchChecks, recetasMap] = batchHoy.length
    ? await Promise.all([checksWithPrefix(`${semana.inicio}|batch|`), recipesById()])
    : [new Set(), new Map()];

  const card = (comida) =>
    mealCardHTML(comida, marks[comida.momento], {
      hasRecipe: comida.recetaId && recetas.has(comida.recetaId),
      open: open.has(comida.momento),
      parts: partsOf(comida, marks[comida.momento], movidos),
      agregados: agregadosA(comida.momento, plan.comidas, movidos),
      partesOpen: partesOpen.has(comida.momento),
    });

  // Reserva del día, plegada en una línea: lo que no comiste de una comida por partes.
  function reservaHTML() {
    const items = reservaDelDia(plan.comidas, marks, movidos);
    if (!items.length) return "";
    return `
      <section class="reserva-box">
        <button class="notes-toggle" data-action="reserva" aria-expanded="${reservaOpen}">
          <span aria-hidden="true">🧺</span><span class="grow">${items.length === 1 ? "1 cosa en la reserva" : `${items.length} cosas en la reserva`}</span>
          ${icon(reservaOpen ? "chevron-up" : "chevron-down", "icon chevron")}
        </button>
        ${
          reservaOpen
            ? `<ul class="reserva-list">${items
                .map(
                  (it, i) => `
              <li>
                <span class="grow"><span>${esc(it.nombre)}</span><span class="small muted">del ${esc(momentoLabel(it.de).toLowerCase())}</span></span>
                <button class="btn btn-secondary" data-reserva="${i}">${icon("plus")} Agregar a…</button>
              </li>`,
                )
                .join("")}</ul>`
            : ""
        }
      </section>`;
  }
  const refreshReserva = () => (view.querySelector(".reserva-slot").innerHTML = reservaHTML());

  // Agregar algo de la reserva a otra comida del día (cuenta como comido ahí).
  function addFromReserva(item) {
    const destinos = plan.comidas.filter((c) => c.momento !== item.de);
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Con qué comida?</h2>
      <p class="muted" style="margin-top: 4px">${esc(item.nombre)} se cuenta como comido ahí.</p>
      <div class="day-options">
        ${[...destinos.filter((c) => !marks[c.momento]), ...destinos.filter((c) => marks[c.momento])]
          .map(
            (c) => `
          <button class="day-option" data-destino="${c.momento}">
            <span class="day-option-text"><span>${esc(momentoLabel(c.momento))}</span><span class="small muted">${esc(c.plato)}</span></span>
            ${icon("chevron-right", "icon chevron")}
          </button>`,
          )
          .join("")}
      </div>`,
      { label: "Agregar de la reserva" },
    );
    sheet.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-destino]")?.dataset.destino;
      if (!a) return;
      close();
      movidos = await moverDeReserva(fecha, { nombre: item.nombre, de: item.de, a });
      refreshReserva();
      refresh(item.de);
      refresh(a);
      toast(`${item.nombre} → ${momentoLabel(a).toLowerCase()}`);
    });
  }

  // Lo pendiente primero (comidas en orden y luego el mealprep); lo ya marcado baja al final, en el mismo orden.
  function listHTML() {
    const batchCard = (i) => batchCardHTML({ semana, i, checks: batchChecks, recetas: recetasMap });
    const batchDone = (i) => {
      const { hechos, total } = progresoBatch(semana.inicio, i, semana.batch[i], batchChecks);
      return hechos === total;
    };
    // Mientras palomeas por partes, la comida se queda arriba aunque ya cuente como comida.
    const isDone = (c) => marks[c.momento] && !partesOpen.has(c.momento);
    const pending = [...plan.comidas.filter((c) => !isDone(c)).map(card), ...batchHoy.filter((i) => !batchDone(i)).map(batchCard)];
    const done = [...plan.comidas.filter(isDone).map(card), ...batchHoy.filter(batchDone).map(batchCard)];
    return `
      ${pending.length ? `<div class="stack meals">${pending.join("")}</div>` : ""}
      ${done.length ? `${pending.length ? `<p class="done-label">Ya marcado</p>` : ""}<div class="stack meals">${done.join("")}</div>` : ""}`;
  }

  // Al marcar, la tarjeta se queda un momento (para ver la animación) y luego baja con lo ya marcado.
  function scheduleReorder() {
    clearTimeout(view.reorder);
    view.reorder = setTimeout(() => {
      const list = view.querySelector(".day-list");
      if (list) list.innerHTML = listHTML();
    }, 700);
  }
  view.cleanup = () => clearTimeout(view.reorder);

  view.innerHTML = `
    ${header(fecha, isToday)}
    ${
      plan.origen !== fecha
        ? `<p class="swap-banner">${icon("arrow-left-right")}<span>Comes el menú del ${esc(shortDay(plan.origen))}</span>
             <button class="link-btn" data-action="undo-swap">Deshacer</button></p>`
        : ""
    }
    ${tagsHTML(plan.etiquetas)}
    ${notas.length ? `<section class="day-notes-box">${notesHTML(notas)}</section>` : ""}
    <div class="day-progress">${progressHTML(plan.comidas, marks)}</div>
    ${macrosLine(plan.macros)}
    <div class="reserva-slot">${reservaHTML()}</div>
    <div class="day-list">${listHTML()}</div>
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

  async function mark(comida, estado, { sustituto = "", comio = null } = {}) {
    // Se ve al instante; se guarda justo después.
    marks[comida.momento] = { ...marks[comida.momento], estado, sustituto, comio };
    open.delete(comida.momento);
    refresh(comida.momento, { animate: true });
    scheduleReorder();
    marks[comida.momento] = await setMark(fecha, comida, { estado, sustituto, comio });
  }

  // "Cambiado": el menú de esa comida, editable. Quitas, agregas o cambias cantidades y guardas.
  function editWhatYouAte(comida) {
    const start = marks[comida.momento]?.comio || editableFrom(comida);
    const row = (ing = { nombre: "", cantidad: "" }) => `
      <li class="edit-row">
        <input class="field" name="nombre" value="${esc(ing.nombre)}" placeholder="Ingrediente" autocomplete="off" enterkeyhint="next" />
        <input class="field qty-input" name="cantidad" value="${esc(ing.cantidad)}" placeholder="Cantidad" autocomplete="off" enterkeyhint="done" />
        <button type="button" class="icon-btn plain" data-remove aria-label="Quitar">${icon("x")}</button>
      </li>`;

    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Qué comiste?</h2>
      <p class="muted" style="margin-top: 4px">Cambia lo que haga falta; lo demás queda como en el menú.</p>
      <form class="swap-editor">
        <label class="field-label" for="swap-plato">Plato</label>
        <input class="field" id="swap-plato" name="plato" value="${esc(start.plato)}" autocomplete="off" />
        <p class="field-label">Ingredientes</p>
        <ul class="edit-rows">${start.ingredientes.map(row).join("")}</ul>
        <button type="button" class="btn btn-ghost add-row" data-add>${icon("plus")} Agregar ingrediente</button>
        <button class="btn btn-primary btn-block">Guardar</button>
      </form>`,
      { label: "Qué comiste" },
    );
    const form = sheet.querySelector("form");
    const list = sheet.querySelector(".edit-rows");

    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove]")) e.target.closest(".edit-row").remove();
      if (e.target.closest("[data-add]")) {
        list.insertAdjacentHTML("beforeend", row());
        list.lastElementChild.querySelector("input").focus();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const comio = {
        plato: form.plato.value.trim() || comida.plato,
        ingredientes: [...list.querySelectorAll(".edit-row")]
          .map((li) => ({ nombre: li.querySelector("[name=nombre]").value.trim(), cantidad: li.querySelector("[name=cantidad]").value.trim() }))
          .filter((i) => i.nombre),
      };
      close();
      if (!hasChanges(diffMeal(comida, comio))) {
        // Sin cambios: fue tal cual el menú.
        mark(comida, "comido");
        toast("Sin cambios: lo marqué como comido");
        return;
      }
      mark(comida, "cambiado", { sustituto: comio.plato, comio });
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
    if (await toggleBatchCheck(event, semana, batchChecks)) return scheduleReorder();
    const cardEl = event.target.closest(".meal");
    const comida = cardEl && plan.comidas.find((c) => c.momento === cardEl.dataset.momento);
    const markBtn = event.target.closest("[data-mark]");
    const likeBtn = event.target.closest("[data-like]");
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (comida && markBtn) {
      const estado = markBtn.dataset.mark;
      if (estado === "comido" && marks[comida.momento]?.partes) {
        // Comida por partes: "Comido" = me comí todo lo que quedaba. Lo palomeado no se despalomea.
        marks[comida.momento] = await checkAllPartes(fecha, comida, movidos);
        refresh(comida.momento, { animate: true });
        refreshReserva();
        return;
      }
      if (marks[comida.momento]?.estado === estado) {
        // Tocar el botón ya elegido lo desmarca.
        delete marks[comida.momento];
        refresh(comida.momento);
        scheduleReorder(); // vuelve a su lugar entre lo pendiente
        await clearMark(fecha, comida.momento);
      } else if (estado === "cambiado") {
        editWhatYouAte(comida);
      } else {
        mark(comida, estado);
      }
      return;
    }

    if (comida && action === "partes") {
      const wasOpen = partesOpen.has(comida.momento);
      wasOpen ? partesOpen.delete(comida.momento) : partesOpen.add(comida.momento);
      refresh(comida.momento);
      if (wasOpen) scheduleReorder(); // al cerrar, si ya cuenta como comida, baja con lo marcado
      return;
    }

    const parte = event.target.closest("[data-parte]");
    if (comida && parte) {
      marks[comida.momento] = await checkParte(fecha, comida, parte.dataset.parte);
      refresh(comida.momento);
      refreshReserva();
      return;
    }

    if (action === "reserva") {
      reservaOpen = !reservaOpen;
      refreshReserva();
      return;
    }

    const fromReserva = event.target.closest("[data-reserva]");
    if (fromReserva) {
      addFromReserva(reservaDelDia(plan.comidas, marks, movidos)[Number(fromReserva.dataset.reserva)]);
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
    if (comida && action === "edit-swap") return editWhatYouAte(comida);

    if (comida && action === "toggle") {
      open.has(comida.momento) ? open.delete(comida.momento) : open.add(comida.momento);
      refresh(comida.momento);
      return;
    }

    if (action === "notes") {
      try {
        localStorage.setItem(NOTES_KEY, notesOpen() ? "0" : "1");
      } catch {
        // sin almacenamiento: se abre igual, solo no se recuerda
      }
      view.querySelector(".day-notes-box").innerHTML = notesHTML(notas);
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

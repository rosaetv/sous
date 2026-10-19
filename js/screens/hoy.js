// Hoy: las comidas del día para marcar. También sirve para cualquier otro día (#/dia/2026-10-20).

import { esc, icon, emptyState, openSheet, toast } from "../ui.js";
import { todayISO, fromISO, shortDay, addDays } from "../logic/fechas.js";
import { notasDeHoy, momentoLabel } from "../logic/menu.js";
import { mealCardHTML, tagsHTML } from "../meal-card.js";
import { editableFrom, diffMeal, hasChanges, sameName } from "../logic/cambios.js";
import { reservaDelDia } from "../logic/reserva.js";
import { weekFor, dayPlan, marksFor, setMark, updateMark, swapDays, recipeIds, recipesById, checksWithPrefix } from "../store.js";
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
    macros.prot != null && `${macros.prot} g prot`,
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
        iconName: "utensils",
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

  // El mealprep que toca este día (si "cuando" nombra el día de la semana), después de la cena.
  const batchHoy = semana.batch.map((b, i) => i).filter((i) => fechaDelBatch(semana.batch[i].cuando, semana.inicio, semana.fin) === fecha);
  const [batchChecks, recetasMap] = batchHoy.length
    ? await Promise.all([checksWithPrefix(`${semana.inicio}|batch|`), recipesById()])
    : [new Set(), new Map()];

  const card = (comida) =>
    mealCardHTML(comida, marks[comida.momento], { hasRecipe: comida.recetaId && recetas.has(comida.recetaId), open: open.has(comida.momento) });

  // Lo pendiente primero (comidas en orden y luego el mealprep); lo ya marcado baja al final, en el mismo orden.
  function listHTML() {
    const batchCard = (i) => batchCardHTML({ semana, i, checks: batchChecks, recetas: recetasMap });
    const batchDone = (i) => {
      const { hechos, total } = progresoBatch(semana.inicio, i, semana.batch[i], batchChecks);
      return hechos === total;
    };
    const pending = [...plan.comidas.filter((c) => !marks[c.momento]).map(card), ...batchHoy.filter((i) => !batchDone(i)).map(batchCard)];
    const done = [...plan.comidas.filter((c) => marks[c.momento]).map(card), ...batchHoy.filter(batchDone).map(batchCard)];
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
      view.querySelector(`.meal[data-momento="${momento}"] .meal-status`)?.classList.add("just-marked");
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

  // "¿Qué comiste?": el menú de esa comida con una casilla por ingrediente.
  // - Palomear = lo comiste; su cantidad se vuelve editable (si comiste de menos, lo que sobró pasa a la reserva).
  // - Lo no palomeado pasa a la reserva del día. Lo ya guardado como comido no se despalomea.
  // - "De la reserva": lo que sobró de otras comidas de hoy; palomearlo = lo comiste con esta.
  // - "Comí todo" palomea todo; "Me la brinqué" la marca como No (todo a la reserva).
  function editWhatYouAte(comida) {
    const prev = marks[comida.momento];
    const comio = prev?.estado === "cambiado" ? prev.comio : null;
    const yaComido = (nombre) => prev?.estado === "comido" || comio?.ingredientes.some((x) => !x.de && sameName(x.nombre, nombre));

    const menuRows = editableFrom(comida).ingredientes.map((i) => {
      const saved = comio?.ingredientes.find((x) => !x.de && sameName(x.nombre, i.nombre));
      const on = Boolean(yaComido(i.nombre));
      return { kind: "menu", nombre: i.nombre, base: i.cantidad, cantidad: saved?.cantidad ?? i.cantidad, on, locked: on };
    });
    const extraRows = comio ? diffMeal(comida, comio).agregados.map((x) => ({ kind: "extra", ...x, base: x.cantidad, on: true, locked: true })) : [];
    const tomadas = (comio?.ingredientes || []).filter((x) => x.de).map((x) => ({ kind: "reserva", ...x, base: x.cantidad, on: true, locked: true }));
    const disponibles = reservaDelDia(plan.comidas, marks)
      .pendientes.filter((r) => r.de !== comida.momento)
      .map((r) => ({ kind: "reserva", nombre: r.nombre, de: r.de, base: r.cantidad, cantidad: r.cantidad, on: false, locked: false }));
    const reservaRows = [...tomadas, ...disponibles];

    const row = (r) => `
      <li class="eat-row" data-kind="${r.kind}" data-nombre="${esc(r.nombre)}" data-de="${r.de || ""}" data-base="${esc(r.base || "")}">
        <button type="button" class="eat-check" aria-pressed="${r.on}" ${r.locked ? "disabled" : ""} aria-label="Lo comí">
          <span class="checkbox">${icon("check")}</span>
        </button>
        ${
          r.kind === "extra" && !r.nombre
            ? `<input class="field eat-name-input" name="nombre" placeholder="Ingrediente" autocomplete="off" enterkeyhint="next" />`
            : `<span class="eat-name">${esc(r.nombre)}${r.de ? `<span class="small muted">de ${esc(momentoLabel(r.de).toLowerCase())}</span>` : ""}</span>`
        }
        <input class="field qty-input" name="cantidad" value="${esc(r.cantidad || "")}" placeholder="Cantidad" autocomplete="off" enterkeyhint="done" ${r.on ? "" : "disabled"} />
      </li>`;

    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Qué comiste?</h2>
      <p class="muted" style="margin-top: 4px">${esc(comida.plato)}</p>
      <div class="eat-quick">
        <button type="button" class="btn btn-secondary" data-all>${icon("check-check")} Comí todo</button>
        <button type="button" class="btn btn-secondary" data-skip>${icon("ban")} Me la brinqué</button>
      </div>
      <form class="swap-editor">
        <p class="field-label">Del menú · palomea lo que comiste</p>
        <ul class="eat-rows" data-list="menu">${[...menuRows, ...extraRows].map(row).join("")}</ul>
        <button type="button" class="btn btn-ghost add-row" data-add>${icon("plus")} Agregar ingrediente</button>
        ${
          reservaRows.length
            ? `<p class="field-label">${icon("package")} De la reserva de hoy</p>
               <ul class="eat-rows">${reservaRows.map(row).join("")}</ul>`
            : ""
        }
        <p class="small muted">Lo que no palomees, o lo que te sobre, queda en la reserva de hoy para otra comida.</p>
        <label class="field-label" for="swap-plato">Plato (cámbialo si comiste otra cosa)</label>
        <input class="field" id="swap-plato" name="plato" value="${esc(comio?.plato || comida.plato)}" autocomplete="off" />
        <button class="btn btn-primary btn-block">Guardar</button>
      </form>`,
      { label: "Qué comiste" },
    );
    const form = sheet.querySelector("form");

    const setOn = (li, on) => {
      const btn = li.querySelector(".eat-check");
      if (btn.disabled) return;
      btn.setAttribute("aria-pressed", on);
      const qty = li.querySelector("[name=cantidad]");
      qty.disabled = !on;
      if (!on) qty.value = li.dataset.base;
    };

    sheet.addEventListener("click", (e) => {
      const check = e.target.closest(".eat-check");
      if (check) {
        const li = check.closest(".eat-row");
        setOn(li, check.getAttribute("aria-pressed") !== "true");
        if (check.getAttribute("aria-pressed") === "true") li.querySelector("[name=cantidad]").focus();
        return;
      }
      if (e.target.closest("[data-all]")) {
        // Comí todo, tal cual el menú: se guarda al momento.
        close();
        mark(comida, "comido");
        return;
      }
      if (e.target.closest("[data-skip]")) {
        close();
        mark(comida, "no");
        return;
      }
      if (e.target.closest("[data-add]")) {
        const list = sheet.querySelector('[data-list="menu"]');
        list.insertAdjacentHTML("beforeend", row({ kind: "extra", nombre: "", cantidad: "", base: "", on: true, locked: false }));
        list.lastElementChild.querySelector("[name=nombre]").focus();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const eaten = [...sheet.querySelectorAll(".eat-row")]
        .filter((li) => li.querySelector(".eat-check").getAttribute("aria-pressed") === "true")
        .map((li) => ({
          kind: li.dataset.kind,
          nombre: li.querySelector("[name=nombre]")?.value.trim() ?? li.dataset.nombre,
          cantidad: li.querySelector("[name=cantidad]").value.trim(),
          de: li.dataset.de || undefined,
        }))
        .filter((i) => i.nombre);
      const nuevo = {
        plato: form.plato.value.trim() || comida.plato,
        ingredientes: eaten.map(({ kind, de, ...i }) => (kind === "reserva" ? { ...i, de } : i)),
      };
      close();
      if (!eaten.length) {
        mark(comida, "no"); // nada palomeado: no la comiste (todo queda en la reserva)
        return;
      }
      const conReserva = eaten.some((i) => i.kind === "reserva");
      if (!conReserva && !hasChanges(diffMeal(comida, nuevo))) {
        mark(comida, "comido"); // tal cual el menú
        return;
      }
      mark(comida, "cambiado", { sustituto: nuevo.plato, comio: nuevo });
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

  view.onkeydown = (event) => {
    const cardEl = event.target.classList?.contains("meal") && event.target;
    if (cardEl && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      editWhatYouAte(plan.comidas.find((c) => c.momento === cardEl.dataset.momento));
    }
  };

  view.onclick = async (event) => {
    if (await toggleBatchCheck(event, semana, batchChecks)) return scheduleReorder();
    const cardEl = event.target.closest(".meal");
    const comida = cardEl && plan.comidas.find((c) => c.momento === cardEl.dataset.momento);
    const likeBtn = event.target.closest("[data-like]");
    const action = event.target.closest("[data-action]")?.dataset.action;

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

    // Tocar la tarjeta (fuera de sus botones y enlaces) abre "¿Qué comiste?".
    if (comida && !event.target.closest("a, button, input")) return editWhatYouAte(comida);

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

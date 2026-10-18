// Hoy: las comidas del día para marcar. También sirve para cualquier otro día (#/dia/2026-10-20).

import { esc, icon, emptyState, openSheet, askSheet, toast } from "../ui.js";
import { todayISO, fromISO, shortDay } from "../logic/fechas.js";
import { etiquetaInfo, notasDeHoy } from "../logic/menu.js";
import { mealCardHTML, SWAP_SUGGESTIONS } from "../meal-card.js";
import { weekFor, dayPlan, marksFor, setMark, clearMark, updateMark, swapDays, recipeIds } from "../store.js";

function longDate(fecha) {
  const text = fromISO(fecha).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  return text[0].toUpperCase() + text.slice(1); // "Domingo, 18 de octubre"
}

// Título arriba (igual en todas las pantallas) y la fecha debajo.
function header(fecha, isToday) {
  return `
    <h1 class="screen-title screen-title-with-sub">${isToday ? "Hoy" : esc(longDate(fecha).split(",")[0])}</h1>
    <p class="screen-sub">${esc(longDate(fecha))}${isToday ? "" : ` · <a href="#/hoy">Ir a hoy</a>`}</p>`;
}

function tagsHTML(etiquetas) {
  if (!etiquetas.length) return "";
  return `<div class="tags">${etiquetas
    .map((t) => {
      const info = etiquetaInfo(t);
      return `<span class="tag tag-${info.tone}">${info.emoji} ${esc(info.label)}</span>`;
    })
    .join("")}</div>`;
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

// ¿El menú de otro día estaba pensado para un tipo de día que hoy no es? (oficina, gym)
// Solo avisa en ese sentido: al revés saldría en casi todos los días y dejaría de servir.
function mismatch(etiquetasHoy, etiquetasMenu) {
  const tag = ["oficina", "gym"].find((t) => etiquetasMenu.includes(t) && !etiquetasHoy.includes(t));
  return tag ? `Era para día de ${etiquetaInfo(tag).label.toLowerCase()}` : "";
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

  // Días a los que se puede cambiar: los que faltan esta semana (los pasados ya se comieron).
  const swapOptions = semana.dias
    .map((d) => d.fecha)
    .filter((f) => f !== fecha && f >= today)
    .map((f) => ({ fecha: f, plan: dayPlan(semana, f) }))
    .filter((o) => o.plan);

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
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">¿Qué menú comes ${isToday ? "hoy" : "este día"}?</h2>
      <p class="muted" style="margin-top: 4px">Se intercambia el día completo. Puedes deshacerlo.</p>
      <div class="day-options">
        ${swapOptions
          .map(({ fecha: f, plan: p }) => {
            const main = p.comidas.find((c) => c.momento === "comida") || p.comidas[0];
            const warn = mismatch(plan.etiquetas, p.etiquetasOrigen); // para qué tipo de día era ese menú
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
      { label: "Elegir otro menú" },
    );
    sheet.addEventListener("click", async (e) => {
      const other = e.target.closest("[data-day]")?.dataset.day;
      if (!other) return;
      close();
      const otherMarks = await marksFor(other);
      if (Object.keys(marks).length || Object.keys(otherMarks).length) {
        const answer = await askSheet({
          title: "Ya marcaste comidas de estos días",
          text: "Las marcas se quedan en su día; solo cambia el menú.",
          actions: [
            { id: "swap", label: "Intercambiar", style: "primary" },
            { id: "cancel", label: "Cancelar", style: "ghost" },
          ],
        });
        if (answer !== "swap") return;
      }
      await swapDays(semana.inicio, fecha, other);
      toast(`Listo: ${isToday ? "hoy" : shortDay(fecha)} comes el menú del ${shortDay(other)}`);
      renderHoy(view, fechaParam);
    });
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

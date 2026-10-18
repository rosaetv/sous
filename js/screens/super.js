// Súper: la lista agrupada por sección, con palomitas grandes para usarla con una mano.
// Casilla = lo compraste todo. Tocar el nombre = Todo / Una parte / No había.

import { esc, icon, emptyState, askSheet, openSheet } from "../ui.js";
import { rangeLabel, addDays } from "../logic/fechas.js";
import { groupList, supersOf } from "../logic/super.js";
import { allLists, defaultList, checksMap, setCheck, clearChecks, formatMoney } from "../store.js";

let superFilter = ""; // se recuerda mientras la app está abierta

const BOX_ICON = { todo: "check", parcial: "minus", nohabia: "x" };

export async function renderSuper(view, inicioParam) {
  const listas = await allLists();
  const lista = inicioParam ? listas.find((l) => l.semanaInicio === inicioParam) : defaultList(listas);

  if (!lista) {
    view.innerHTML = `
      <h1 class="screen-title">Súper</h1>
      ${emptyState({
        emoji: "🧺",
        title: "Aún no hay lista del súper",
        text: "Pega la lista que te dio Claude y aquí la verás por sección, para palomear mientras compras.",
        action: `<a class="btn btn-primary" href="#/importar">${icon("clipboard-paste")} Importar lista</a>`,
      })}`;
    return;
  }

  const index = listas.indexOf(lista);
  const prev = listas[index - 1];
  const next = listas[index + 1];
  const prefix = `${lista.semanaInicio}|super|`;
  const states = new Map([...(await checksMap(prefix))].map(([k, v]) => [k.slice(prefix.length), v]));
  const supers = supersOf(lista.items);
  if (!supers.includes(superFilter)) superFilter = "";
  let maybeOpen = false;

  function meta(item) {
    const showSuper = !superFilter && supers.length > 1 ? item.super : "";
    if (item.estado === "parcial") {
      return `<span class="item-meta is-partial">Llevas ${esc(item.llevo || "una parte")}${item.cantidad ? ` · pedía ${esc(item.cantidad)}` : ""}</span>`;
    }
    if (item.estado === "nohabia") return `<span class="item-meta">No había</span>`;
    const parts = [item.cantidad, showSuper].filter(Boolean);
    return parts.length ? `<span class="item-meta">${parts.map(esc).join(" · ")}</span>` : "";
  }

  const row = (item) => `
    <li class="item-row" data-state="${item.estado}">
      <button class="item-box" data-toggle="${esc(item.id)}" aria-label="${esc(item.nombre)}: ${item.estado === "todo" ? "comprado" : "marcar comprado"}">
        <span class="checkbox">${item.estado ? icon(BOX_ICON[item.estado]) : ""}</span>
      </button>
      <button class="item-text" data-detail="${esc(item.id)}">
        <span class="item-name">${esc(item.nombre)}</span>
        ${meta(item)}
      </button>
    </li>`;

  function render() {
    const { sections, maybe, counts } = groupList(lista.items, states, superFilter);
    const allDone = counts.total > 0 && counts.done === counts.total;
    const pending = counts.total - counts.done - counts.partial;

    view.innerHTML = `
      <h1 class="screen-title screen-title-with-sub">Súper</h1>
      <div class="week-nav">
        <p class="week-range">
          <span>${esc(rangeLabel(lista.semanaInicio, addDays(lista.semanaInicio, 6)))}</span>
          <span class="small muted">${lista.totalEstimado != null ? `Total estimado ${esc(formatMoney(lista.totalEstimado))}` : "Lista de la semana"}</span>
        </p>
        ${prev ? `<a class="icon-btn" href="#/super/${prev.semanaInicio}" aria-label="Lista anterior">${icon("chevron-left")}</a>` : ""}
        ${next ? `<a class="icon-btn" href="#/super/${next.semanaInicio}" aria-label="Lista siguiente">${icon("chevron-right")}</a>` : ""}
      </div>

      ${
        supers.length > 1
          ? `<div class="chips super-filter">
              <button class="chip" data-super="" aria-pressed="${!superFilter}">Todos</button>
              ${supers.map((s) => `<button class="chip" data-super="${esc(s)}" aria-pressed="${superFilter === s}">${esc(s)}</button>`).join("")}
            </div>`
          : ""
      }

      <div class="card progress">
        <div class="week-bar">
          ${counts.done ? `<span data-state="comido" style="flex: ${counts.done}"></span>` : ""}
          ${counts.partial ? `<span data-state="cambiado" style="flex: ${counts.partial}"></span>` : ""}
          ${pending ? `<span style="flex: ${pending}"></span>` : ""}
        </div>
        <p class="small muted">${allDone ? "¡Todo listo! " : ""}${counts.done} de ${counts.total} listos${counts.partial ? ` · ${counts.partial} a medias` : ""}</p>
      </div>

      ${
        maybe.length
          ? `<section class="card maybe">
              <button class="maybe-head" data-action="maybe" aria-expanded="${maybeOpen}">
                <span class="grow">Probablemente ya tengo <span class="muted">(${maybe.filter((i) => !i.estado).length})</span></span>
                ${icon(maybeOpen ? "chevron-up" : "chevron-down", "icon chevron")}
              </button>
              ${maybeOpen ? `<p class="small muted maybe-help">Revisa en casa. Palomea lo que ya tienes o lo que compraste.</p><ul class="checklist">${maybe.map(row).join("")}</ul>` : ""}
            </section>`
          : ""
      }

      <div class="stack super-sections">
        ${sections
          .map(
            (s) => `
          <section class="card super-section ${s.done ? "is-done" : ""}">
            <h2 class="section-name">${esc(s.seccion)}${s.done ? ` ${icon("check")}` : ""}</h2>
            <ul class="checklist">${s.items.map(row).join("")}</ul>
          </section>`,
          )
          .join("")}
      </div>

      ${states.size ? `<button class="btn btn-ghost btn-block uncheck-all" data-action="uncheck-all">${icon("rotate-ccw")} Desmarcar todo</button>` : ""}`;
  }

  // Guarda el estado; se ve al instante y la lista se reordena un momento después.
  function save(id, value, { reorderNow = false } = {}) {
    value ? states.set(id, value) : states.delete(id);
    setCheck(prefix + id, value);
    clearTimeout(view.reorder);
    if (reorderNow) return render();
    const li = view.querySelector(`[data-toggle="${CSS.escape(id)}"]`)?.closest(".item-row");
    if (li) {
      const estado = value === true ? "todo" : value?.estado || "";
      li.dataset.state = estado;
      li.querySelector(".checkbox").innerHTML = estado ? icon(BOX_ICON[estado]) : "";
    }
    view.reorder = setTimeout(render, 450);
  }

  function openDetail(item) {
    const current = states.get(item.id);
    const estado = current === true ? "todo" : current?.estado || "";
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">${esc(item.nombre)}</h2>
      ${item.cantidad ? `<p class="muted" style="margin-top: 4px">Pedía: ${esc(item.cantidad)}</p>` : ""}
      <div class="stack item-options">
        <button class="btn btn-secondary btn-block option" data-choice="todo" aria-pressed="${estado === "todo"}">✅ Todo</button>
        <button class="btn btn-secondary btn-block option" data-choice="parcial" aria-pressed="${estado === "parcial"}">◐ Una parte</button>
        <form class="partial-form stack" ${estado === "parcial" ? "" : "hidden"}>
          <input class="field" name="llevo" value="${esc(current?.llevo || "")}" placeholder="¿Cuánto llevas? Por ejemplo: 2 latas" autocomplete="off" enterkeyhint="done" />
          <button class="btn btn-primary btn-block">Guardar</button>
        </form>
        <button class="btn btn-secondary btn-block option" data-choice="nohabia" aria-pressed="${estado === "nohabia"}">✕ No había</button>
        ${estado ? `<button class="btn btn-ghost btn-block" data-choice="">Quitar marca</button>` : ""}
      </div>`,
      { label: item.nombre },
    );
    const form = sheet.querySelector(".partial-form");
    sheet.addEventListener("click", (e) => {
      const choice = e.target.closest("[data-choice]")?.dataset.choice;
      if (choice === undefined) return;
      if (choice === "parcial") {
        sheet.querySelectorAll(".option").forEach((b) => b.setAttribute("aria-pressed", b.dataset.choice === "parcial"));
        form.hidden = false;
        form.llevo.focus();
        return;
      }
      close();
      save(item.id, choice === "todo" ? true : choice ? { estado: choice } : null, { reorderNow: true });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      close();
      save(item.id, { estado: "parcial", llevo: form.llevo.value.trim() }, { reorderNow: true });
    });
  }

  render();

  view.onclick = async (event) => {
    const toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      const id = toggle.dataset.toggle;
      const current = states.get(id);
      const estado = current === true ? "todo" : current?.estado || "";
      // Casilla: pendiente o a medias → comprado; comprado o no había → pendiente.
      save(id, estado === "" || estado === "parcial" ? true : null);
      return;
    }

    const detail = event.target.closest("[data-detail]");
    if (detail) {
      openDetail(lista.items.find((i) => i.id === detail.dataset.detail));
      return;
    }

    const superBtn = event.target.closest("[data-super]");
    if (superBtn) {
      superFilter = superBtn.dataset.super;
      render();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "maybe") {
      maybeOpen = !maybeOpen;
      render();
    }
    if (action === "uncheck-all") {
      const answer = await askSheet({
        title: "¿Desmarcar todo?",
        text: "Toda la lista vuelve a quedar pendiente.",
        actions: [
          { id: "yes", label: "Desmarcar todo", style: "primary" },
          { id: "no", label: "Cancelar", style: "ghost" },
        ],
      });
      if (answer !== "yes") return;
      states.clear();
      await clearChecks(prefix);
      render();
    }
  };
  view.cleanup = () => clearTimeout(view.reorder);
}

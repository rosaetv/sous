// Piezas de interfaz reutilizables.

import { MUSCLES, EQUIPMENT, DAY_TEMPLATES } from "./data/catalog.js";
import { t, tIn } from "./i18n.js";

export function esc(text = "") {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevron: svg('<path d="M9 5l7 7-7 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'),
  swap: svg('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5z"/>'),
  starFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5z"/></svg>',
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'),
  play: svg('<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  thumbDown: svg('<path d="M7 14V4M7 14l3.5 6.5a1.8 1.8 0 0 0 3.3-1.2L13 15h5.2a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17 4H7M7 14H4.5A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4H7"/>'),
  drop: svg('<path d="M12 3.5c3 4 6 7.4 6 10.8a6 6 0 0 1-12 0c0-3.4 3-6.8 6-10.8z"/>'),
  dropFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3 4 6 7.4 6 10.8a6 6 0 0 1-12 0c0-3.4 3-6.8 6-10.8z"/></svg>',
  thumbDownFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 14V4M7 14l3.5 6.5a1.8 1.8 0 0 0 3.3-1.2L13 15h5.2a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17 4H7M7 14H4.5A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4H7"/></svg>',
};

// Encabezado de las pestañas principales: misma altura y posición en todas.
export function pageHeader({ eyebrow, title, action = "" }) {
  return `
    <div class="page-head">
      <p class="eyebrow">${eyebrow}</p>
      <div class="page-title-row">
        <h1 class="screen-title">${title}</h1>
        ${action}
      </div>
    </div>`;
}

export function header({ title, back, action = "" }) {
  return `
    <header class="topbar">
      ${back ? `<a class="icon-btn" href="${back}" aria-label="${t("common.back")}">${icons.back}</a>` : "<span></span>"}
      <span class="topbar-title">${esc(title || "")}</span>
      ${action || "<span></span>"}
    </header>
  `;
}

/**
 * Nombre de un día del plan en el idioma actual.
 * Acepta { template, suffix, name }; los planes antiguos solo tienen "name"
 * en español, así que se reconoce el tipo de día a partir de ese nombre.
 */
export function dayLabel({ template, suffix = "", name = "" }) {
  if (!template) ({ template, suffix } = resolveDayName(name));
  if (!template || !DAY_TEMPLATES[template]) return name;
  return suffix ? `${DAY_TEMPLATES[template].name} ${suffix}` : DAY_TEMPLATES[template].name;
}

function resolveDayName(name) {
  for (const key of Object.keys(DAY_TEMPLATES)) {
    for (const language of ["es", "en"]) {
      const base = tIn(language, `day.${key}`);
      if (name === base) return { template: key, suffix: "" };
      if (name.startsWith(`${base} `)) return { template: key, suffix: name.slice(base.length + 1) };
    }
  }
  return {};
}

// Nombre del día de un entrenamiento guardado.
export const workoutDayLabel = (w) => dayLabel({ template: w.dayTemplate, suffix: w.daySuffix, name: w.dayName });

export const muscleName = (key) => MUSCLES[key] || key;
export const equipmentName = (key) => EQUIPMENT[key] || key;

export function muscleTags(exercise) {
  return [
    ...exercise.primary.map((m) => `<span class="tag tag-accent">${muscleName(m)}</span>`),
    ...exercise.secondary.map((m) => `<span class="tag">${muscleName(m)}</span>`),
  ].join("");
}

export function formatRest(seconds) {
  if (seconds < 120) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min}:${String(sec).padStart(2, "0")} min` : `${min} min`;
}

// "3 × 10 · Descanso 90 s". reps: la meta de repeticiones (un solo número).
// showRest: false dentro de una superserie (el descanso se muestra en la pareja).
export function formatDose(item, exercise, reps, showRest = true) {
  const unit = exercise?.timed ? " s" : "";
  const dose = `${item.sets} × ${reps}${unit}`;
  return showRest ? `${dose} · ${t("dose.rest", { time: formatRest(item.rest) })}` : dose;
}

// Título del cierre del día (core y tobillo): ejercicios cortos que también se pueden hacer en casa.
export const closingHeader = () => `
  <h2 class="section-title closing-title">${t("closing.title")}</h2>
  <p class="muted small-note closing-note">${t("closing.note")}</p>`;

// ---------- Panel inferior (bottom sheet) ----------

export function openSheet({ title, body, onMount }) {
  const root = document.createElement("div");
  root.className = "sheet-backdrop";
  root.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-header">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-sheet-close aria-label="${t("common.close")}">${icons.close}</button>
      </div>
      <div class="sheet-body">${body}</div>
    </div>
  `;
  const close = () => {
    root.classList.remove("open");
    setTimeout(() => root.remove(), 200);
  };
  root.addEventListener("click", (event) => {
    if (event.target === root || event.target.closest("[data-sheet-close]")) close();
  });
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add("open"));
  onMount?.(root.querySelector(".sheet"), close);
  return close;
}

export function confirmSheet({ title, text, confirmLabel, danger }) {
  return new Promise((resolve) => {
    let answered = false;
    const close = openSheet({
      title,
      body: `
        <p class="sheet-text">${esc(text)}</p>
        <div class="stack">
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${esc(confirmLabel)}</button>
          <button class="btn btn-secondary" data-sheet-close>${t("common.cancel")}</button>
        </div>
      `,
      onMount: (sheet) => {
        sheet.querySelector("[data-confirm]").addEventListener("click", () => {
          answered = true;
          close();
          resolve(true);
        });
      },
    });
    // Si se cierra sin confirmar.
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".sheet-backdrop")) {
        observer.disconnect();
        if (!answered) resolve(false);
      }
    });
    observer.observe(document.body, { childList: true });
  });
}

// ---------- Aviso breve ----------

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

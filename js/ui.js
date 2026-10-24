// Piezas de interfaz reutilizables.

export function esc(text = "") {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Ícono de Lucide por su nombre en lucide.dev (por ejemplo "sun", "chef-hat").
export function icon(name, className = "icon") {
  const pascal = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  // Formato de Lucide: [[etiqueta, atributos], ...] (versiones nuevas)
  // o ["svg", atributos, [[etiqueta, atributos], ...]] (versiones viejas).
  const node = window.lucide?.icons?.[pascal];
  if (!node) return "";
  const children = (Array.isArray(node[0]) ? node : node[2])
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}

// ---------- Hojas que suben desde abajo ----------
// Mientras hay una abierta, el fondo no se mueve (en iPhone, overflow: hidden no basta:
// se fija el body en su posición y al cerrar se vuelve al mismo scroll).
let lockedY = null;

function lockScroll() {
  if (lockedY !== null) return;
  lockedY = window.scrollY;
  Object.assign(document.body.style, { position: "fixed", top: `-${lockedY}px`, left: "0", right: "0" });
}

function unlockScroll() {
  if (lockedY === null || document.querySelector(".sheet-backdrop")) return;
  const y = lockedY;
  lockedY = null;
  Object.assign(document.body.style, { position: "", top: "", left: "", right: "" });
  window.scrollTo(0, y);
}

// Cierra todas las hojas (al cambiar de pantalla).
export function closeSheets() {
  document.querySelectorAll(".sheet-backdrop").forEach((s) => s.remove());
  unlockScroll();
}

// Arrastrar hacia abajo para cerrar, como en iOS: desde el asa o cuando la hoja está arriba del todo.
function enableDragToClose(sheet, dismiss) {
  let startY = null;
  let lastY = 0;
  let lastT = 0;
  let speed = 0;

  sheet.addEventListener(
    "touchstart",
    (e) => {
      const onHandle = e.target.closest(".sheet-handle");
      if (!onHandle && sheet.scrollTop > 0) return; // con contenido scrolleado, primero se scrollea
      if (e.target.closest("input, textarea")) return;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      speed = 0;
    },
    { passive: true },
  );

  sheet.addEventListener(
    "touchmove",
    (e) => {
      if (startY === null) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (dy <= 0) {
        sheet.style.transform = "";
        return; // hacia arriba: scroll normal de la hoja
      }
      e.preventDefault();
      speed = (y - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = y;
      lastT = e.timeStamp;
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy}px)`;
    },
    { passive: false },
  );

  sheet.addEventListener("touchend", () => {
    if (startY === null) return;
    const dy = lastY - startY;
    startY = null;
    sheet.style.transition = "";
    // Se cierra si bajó bastante o si fue un gesto rápido hacia abajo.
    if (dy > Math.min(140, sheet.offsetHeight * 0.3) || speed > 0.6) dismiss();
    else sheet.style.transform = "";
  });
}

// Hoja que sube desde abajo. Devuelve el elemento y una función para cerrarla.
// onClose se llama si la cierras tocando fuera o arrastrándola hacia abajo.
export function openSheet(html, { label = "", onClose } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="sheet-handle"></div>
      ${html}
    </div>`;
  const sheet = backdrop.firstElementChild;

  const close = () => {
    backdrop.remove();
    unlockScroll();
  };
  // Cerrar sin elegir nada: la hoja baja y el fondo se desvanece.
  const dismiss = () => {
    sheet.style.transform = "translateY(100%)";
    backdrop.classList.add("is-closing");
    setTimeout(close, 220);
    onClose?.();
  };

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) dismiss();
  });
  // El fondo oscuro no deja scrollear lo de atrás.
  backdrop.addEventListener("touchmove", (event) => event.target === backdrop && event.preventDefault(), { passive: false });
  enableDragToClose(sheet, dismiss);

  lockScroll();
  document.body.append(backdrop);
  return { sheet, close };
}

// iconName: un ícono de Lucide (grande, en verde).
export function emptyState({ iconName, title, text, action = "" }) {
  return `
    <section class="card empty">
      <span class="empty-icon">${icon(iconName)}</span>
      <h2 class="title">${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${action}
    </section>`;
}

// Aviso breve abajo ("Guardado"). Desaparece solo.
export function toast(text) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

// Hoja con una pregunta y botones. Devuelve el id del botón elegido (o null si la cierras).
export function askSheet({ title, text = "", actions, label = title }) {
  return new Promise((resolve) => {
    const { sheet, close } = openSheet(
      `
      <h2 class="title sheet-title">${esc(title)}</h2>
      ${text ? `<p class="muted" style="margin-top: 8px">${esc(text)}</p>` : ""}
      <div class="stack" style="margin-top: 24px; gap: 8px">
        ${actions.map((a) => `<button class="btn btn-${a.style || "secondary"} btn-block" data-answer="${a.id}">${esc(a.label)}</button>`).join("")}
      </div>`,
      { label, onClose: () => resolve(null) },
    );
    sheet.addEventListener("click", (event) => {
      const answer = event.target.closest("[data-answer]")?.dataset.answer;
      if (!answer) return;
      close();
      resolve(answer);
    });
  });
}

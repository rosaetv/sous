// Piezas de interfaz reutilizables.

export function esc(text = "") {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Ícono de Lucide por su nombre en lucide.dev (por ejemplo "sun", "chef-hat").
export function icon(name, className = "icon") {
  const pascal = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  // Formato de Lucide: ["svg", atributos, [[etiqueta, atributos], ...]]
  const node = window.lucide?.icons?.[pascal];
  if (!node) return "";
  const children = node[2]
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}

// Hoja que sube desde abajo. Devuelve el elemento y una función para cerrarla.
// onClose se llama si la cierras tocando fuera.
export function openSheet(html, { label = "", onClose } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="sheet-handle"></div>
      ${html}
    </div>`;
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    close();
    onClose?.();
  });
  document.body.append(backdrop);
  return { sheet: backdrop.firstElementChild, close };
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

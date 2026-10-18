// Importar: pegas el JSON de Claude (menú, lista del súper o recetario) y se guarda.
// Mientras pegas, la app ya te dice qué detectó o qué falta; nada se guarda hasta tocar "Importar".

import { esc, icon, askSheet, toast } from "../ui.js";
import { leer } from "../logic/validar.js";
import { rangeLabel } from "../logic/fechas.js";
import { previewImport, applyImport } from "../store.js";

const MAX_ERRORS = 5;

function describe(result) {
  const d = result.datos;
  if (result.tipo === "menu") return { emoji: "🗓️", text: `Menú semanal · ${rangeLabel(d.inicio, d.fin)} · ${d.dias.length} días` };
  if (result.tipo === "lista") return { emoji: "🧺", text: `Lista del súper · ${d.items.length} artículos` };
  return { emoji: "📖", text: `Recetario · ${d.recetas.length} recetas` };
}

function statusHTML(result) {
  if (!result) return "";
  if (!result.ok) {
    const shown = result.errores.slice(0, MAX_ERRORS);
    const more = result.errores.length - shown.length;
    return `
      <section class="card import-errors" role="alert">
        <p class="title">Hay que corregir esto</p>
        <ul>
          ${shown.map((e) => `<li>${esc(e)}</li>`).join("")}
          ${more > 0 ? `<li class="muted">y ${more} más</li>` : ""}
        </ul>
        <p class="small muted">No se guardó nada. Pídele a Claude que lo corrija y vuelve a pegarlo.</p>
        <button class="btn btn-secondary btn-block" data-action="copy-errors">${icon("copy")} Copiar errores para Claude</button>
      </section>`;
  }
  const { emoji, text } = describe(result);
  return `
    <section class="card import-ok">
      <span class="import-emoji" aria-hidden="true">${emoji}</span>
      <div>
        <p class="title">${esc(text)}</p>
        <p class="small muted">Listo para importar</p>
      </div>
    </section>
    ${result.avisos.map((a) => `<p class="import-warning">${icon("info")}<span>${esc(a)}</span></p>`).join("")}`;
}

function successHTML(summary) {
  return `
    <section class="card empty import-done">
      <span class="empty-emoji" aria-hidden="true">✅</span>
      <h2 class="title">${esc(summary.title)}</h2>
      <p>${esc(summary.detail)}</p>
      <a class="btn btn-primary btn-block" href="${summary.go.href}">${esc(summary.go.label)}</a>
      <button class="btn btn-ghost btn-block" data-action="again">Importar otro</button>
    </section>`;
}

export function renderImportar(view) {
  let result = null;
  let timer;

  view.innerHTML = `
    <button class="icon-btn" data-action="back" aria-label="Volver">${icon("chevron-left")}</button>
    <h1 class="screen-title" style="margin-top: 16px">Importar</h1>
    <div class="import-body stack">
      <p class="muted">Pega el JSON que te dio Claude: menú, lista del súper o recetario.</p>
      <button class="btn btn-primary btn-block" data-action="paste">${icon("clipboard-paste")} Pegar del portapapeles</button>
      <label class="sr-only" for="json">JSON</label>
      <textarea class="field" id="json" placeholder="O pégalo aquí" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <div class="import-status stack" aria-live="polite"></div>
      <button class="btn btn-primary btn-block" data-action="import" disabled>Importar</button>
    </div>`;

  const textarea = view.querySelector("#json");
  const status = view.querySelector(".import-status");
  const importBtn = view.querySelector("[data-action=import]");

  const check = () => {
    result = textarea.value.trim() ? leer(textarea.value) : null;
    status.innerHTML = statusHTML(result);
    importBtn.disabled = !result?.ok;
    importBtn.hidden = result?.ok === false; // con errores, solo se ve qué corregir
  };

  view.oninput = (event) => {
    if (event.target !== textarea) return;
    clearTimeout(timer);
    timer = setTimeout(check, 250);
  };

  view.onclick = async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "back") {
      if (history.length > 1) history.back();
      else location.hash = "#/hoy";
    }

    if (action === "paste") {
      try {
        textarea.value = await navigator.clipboard.readText();
        check();
      } catch {
        toast("No pude leer el portapapeles. Mantén presionado el campo y elige Pegar.");
        textarea.focus();
      }
    }

    if (action === "copy-errors") {
      const text = `Al importar el JSON en mi app salieron estos errores. Corrígelo y dame el JSON completo otra vez:\n${result.errores.map((e) => `- ${e}`).join("\n")}`;
      try {
        await navigator.clipboard.writeText(text);
        toast("Copiado. Pégalo en el chat de Claude.");
      } catch {
        toast("No pude copiar. Intenta de nuevo.");
      }
    }

    if (action === "import" && result?.ok) {
      const preview = await previewImport(result);
      if (preview.needsConfirm) {
        const answer = await askSheet({
          title: `Ya tienes el menú del ${preview.replaces.join(" y ")}`,
          text:
            preview.marked === 1
              ? "Se reemplaza el menú. La comida que ya marcaste se conserva."
              : preview.marked
                ? `Se reemplaza el menú. Las ${preview.marked} comidas que ya marcaste se conservan.`
                : "Se reemplaza por el menú nuevo.",
          actions: [
            { id: "replace", label: "Reemplazar menú", style: "primary" },
            { id: "cancel", label: "Cancelar", style: "ghost" },
          ],
        });
        if (answer !== "replace") return;
      }
      try {
        const summary = await applyImport(result);
        view.querySelector(".import-body").outerHTML = successHTML(summary);
      } catch (error) {
        console.error(error);
        toast("No se pudo guardar. Intenta de nuevo.");
      }
    }

    if (action === "again") renderImportar(view);
  };
}

// Ajustes: importar, resumen para Claude, respaldo, borrar una semana y la versión de la app.

import { esc, icon, toast, askSheet, openSheet } from "../ui.js";
import { checkForUpdates } from "../pwa.js";
import { exportBackup, readBackup, describeBackup, restoreBackup, lastBackup } from "../backup.js";
import { allWeeks, deleteWeek, counts } from "../store.js";
import { rangeLabel, todayISO, fromISO } from "../logic/fechas.js";
import { APP_NAME, APP_VERSION } from "../version.js";

const REMIND_AFTER_DAYS = 30;

const item = (iconName, label, attrs, chevron = true) => `
  ${attrs.startsWith("href") ? `<a class="list-item" ${attrs}>` : `<button class="list-item list-button" ${attrs}>`}
    ${icon(iconName)}<span class="grow">${label}</span>${chevron ? icon("chevron-right", "icon chevron") : ""}
  ${attrs.startsWith("href") ? "</a>" : "</button>"}`;

function daysSince(iso) {
  return Math.floor((fromISO(todayISO()) - fromISO(iso.slice(0, 10))) / 86400000);
}

function backupStatus(last, hasData) {
  if (!last) return hasData ? { text: "Aún no tienes respaldo. Tus datos solo están en este teléfono.", warn: true } : null;
  const days = daysSince(last);
  const when = days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
  return { text: `Último respaldo: ${when}.`, warn: days >= REMIND_AFTER_DAYS };
}

export async function renderAjustes(view) {
  const [last, data] = await Promise.all([lastBackup(), counts()]);
  const status = backupStatus(last, data.semanas + data.recetas > 0);

  view.innerHTML = `
    <h1 class="screen-title">Ajustes</h1>
    <div class="card list">
      ${item("clipboard-paste", "Importar JSON", 'href="#/importar"')}
      ${item("message-square-text", "Copiar resumen para Claude", 'href="#/resumen"')}
    </div>

    <h2 class="title section-title">Respaldo</h2>
    ${status ? `<p class="backup-status ${status.warn ? "is-warn" : ""}">${icon(status.warn ? "info" : "shield-check")}<span>${esc(status.text)}</span></p>` : ""}
    <div class="card list">
      ${item("download", "Guardar respaldo", 'data-action="export"', false)}
      <label class="list-item list-button">
        ${icon("upload")}<span class="grow">Restaurar un respaldo</span>
        <input type="file" accept="application/json,.json" class="sr-only" data-restore />
      </label>
    </div>
    <p class="small muted list-help">Un archivo con todo, incluidas las fotos. Guárdalo en Archivos o iCloud.</p>

    <h2 class="title section-title">Datos</h2>
    <div class="card list">
      ${item("trash-2", "Borrar una semana", 'data-action="delete-week"')}
    </div>

    <h2 class="title section-title">Sobre la app</h2>
    <div class="card list">
      ${item("refresh-cw", "Buscar actualizaciones", 'data-action="update"', false)}
      ${item("palette", "Guía de estilos", 'href="#/styleguide"')}
    </div>
    <p class="version">${APP_NAME} ${APP_VERSION}</p>`;

  view.onclick = async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "update") {
      const result = await checkForUpdates();
      if (result === "latest") toast("Ya tienes la última versión");
      if (result === "offline") toast("Sin conexión: inténtalo cuando tengas internet");
    }

    if (action === "export") {
      try {
        if (await exportBackup()) {
          toast("Respaldo guardado");
          renderAjustes(view);
        }
      } catch (error) {
        console.error(error);
        toast("No se pudo guardar el respaldo. Intenta de nuevo.");
      }
    }

    if (action === "delete-week") chooseWeekToDelete(view);
  };

  view.onchange = async (event) => {
    const input = event.target.closest("[data-restore]");
    const file = input?.files?.[0];
    if (!file) return;
    input.value = ""; // para poder elegir el mismo archivo otra vez
    try {
      const json = await readBackup(file);
      const info = describeBackup(json);
      const fecha = fromISO(info.creado.slice(0, 10)).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
      const answer = await askSheet({
        title: "¿Restaurar este respaldo?",
        text: `Es del ${fecha}: ${info.semanas} semanas, ${info.recetas} recetas y ${info.fotos} fotos. Todo lo que hay ahora en la app se reemplaza.`,
        actions: [
          { id: "yes", label: "Restaurar", style: "primary" },
          { id: "no", label: "Cancelar", style: "ghost" },
        ],
      });
      if (answer !== "yes") return;
      await restoreBackup(json);
      toast("Respaldo restaurado");
      renderAjustes(view);
    } catch (error) {
      console.error(error);
      toast(error.message || "No se pudo restaurar.");
    }
  };
}

async function chooseWeekToDelete(view) {
  const semanas = (await allWeeks()).reverse(); // la más reciente primero
  if (!semanas.length) return toast("No hay semanas guardadas");

  const { sheet, close } = openSheet(
    `
    <h2 class="title sheet-title">Borrar una semana</h2>
    <p class="muted" style="margin-top: 4px">Se borran su menú, lo que marcaste, el batch y la lista del súper. Las recetas y fotos no se tocan.</p>
    <div class="day-options">
      ${semanas
        .map(
          (s) => `
        <button class="day-option" data-week="${s.inicio}">
          <span class="day-option-text"><span>${esc(rangeLabel(s.inicio, s.fin))}</span></span>
          ${icon("trash-2", "icon chevron")}
        </button>`,
        )
        .join("")}
    </div>`,
    { label: "Borrar una semana" },
  );

  sheet.addEventListener("click", async (event) => {
    const inicio = event.target.closest("[data-week]")?.dataset.week;
    if (!inicio) return;
    close();
    const semana = semanas.find((s) => s.inicio === inicio);
    const answer = await askSheet({
      title: `¿Borrar la semana del ${rangeLabel(semana.inicio, semana.fin)}?`,
      text: "No se puede deshacer. Si quieres conservarla, guarda antes un respaldo.",
      actions: [
        { id: "yes", label: "Borrar semana", style: "primary" },
        { id: "no", label: "Cancelar", style: "ghost" },
      ],
    });
    if (answer !== "yes") return;
    await deleteWeek(inicio);
    toast("Semana borrada");
    renderAjustes(view);
  });
}

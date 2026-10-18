// Resumen para Claude: el Markdown de una semana, listo para copiar y pegar en el chat del menú siguiente.

import { esc, icon, emptyState, toast } from "../ui.js";
import { todayISO, rangeLabel } from "../logic/fechas.js";
import { buildSummary } from "../logic/resumen.js";
import { allWeeks, defaultWeek, summaryData } from "../store.js";

export async function renderResumen(view, inicioParam) {
  const today = todayISO();
  const semanas = await allWeeks();
  const semana = inicioParam ? semanas.find((s) => s.inicio === inicioParam) : defaultWeek(semanas, today);

  const back = `<a class="icon-btn" href="#/ajustes" aria-label="Volver">${icon("chevron-left")}</a>`;
  if (!semana) {
    view.innerHTML = `
      ${back}
      <h1 class="screen-title" style="margin-top: 16px">Resumen</h1>
      ${emptyState({ emoji: "📝", title: "Aún no hay semanas", text: "Cuando importes un menú y marques tus comidas, aquí estará su resumen." })}`;
    return;
  }

  const index = semanas.indexOf(semana);
  const prev = semanas[index - 1];
  const next = semanas[index + 1];
  const text = buildSummary(await summaryData(semana));

  view.innerHTML = `
    ${back}
    <h1 class="screen-title screen-title-with-sub" style="margin-top: 16px">Resumen para Claude</h1>
    <p class="screen-sub">Cópialo y pégalo en el chat donde pides el menú siguiente.</p>
    <div class="week-nav">
      <p class="week-range">
        <span>${esc(rangeLabel(semana.inicio, semana.fin))}</span>
        <span class="small muted">${semana.inicio <= today && semana.fin >= today ? "Esta semana" : semana.fin < today ? "Semana pasada" : "Próxima semana"}</span>
      </p>
      ${prev ? `<a class="icon-btn" href="#/resumen/${prev.inicio}" aria-label="Semana anterior">${icon("chevron-left")}</a>` : ""}
      ${next ? `<a class="icon-btn" href="#/resumen/${next.inicio}" aria-label="Semana siguiente">${icon("chevron-right")}</a>` : ""}
    </div>
    <button class="btn btn-primary btn-block" data-action="copy">${icon("copy")} Copiar resumen</button>
    <pre class="card summary">${esc(text)}</pre>`;

  view.onclick = async (event) => {
    if (!event.target.closest("[data-action=copy]")) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado. Pégalo en el chat de Claude.");
    } catch {
      toast("No pude copiar. Intenta de nuevo.");
    }
  };
}

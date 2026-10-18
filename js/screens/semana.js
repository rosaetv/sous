// Semana: los 7 días, macros y batch. (Etapa 4.)

import { emptyState } from "../ui.js";

export function renderSemana(view) {
  view.innerHTML = `
    <h1 class="title screen-title">Semana</h1>
    ${emptyState({ emoji: "🗓️", title: "Tu semana aparecerá aquí", text: "Los 7 días, los macros y los pasos del batch." })}`;
}

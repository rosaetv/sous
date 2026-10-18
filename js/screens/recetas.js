// Recetas: cuadrícula con fotos, filtros y detalle. (Etapa 6.)

import { emptyState } from "../ui.js";

export function renderRecetas(view) {
  view.innerHTML = `
    <h1 class="title screen-title">Recetas</h1>
    ${emptyState({ emoji: "🥑", title: "Tu recetario aparecerá aquí", text: "Con fotos, macros y pasos." })}`;
}

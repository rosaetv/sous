// Súper: lista agrupada por sección. (Etapa 5.)

import { emptyState } from "../ui.js";

export function renderSuper(view) {
  view.innerHTML = `
    <h1 class="title screen-title">Súper</h1>
    ${emptyState({ emoji: "🧺", title: "Tu lista del súper aparecerá aquí", text: "Agrupada por sección, para palomear mientras compras." })}`;
}

// Guía de estilos: todas las piezas visuales juntas para revisarlas.
// Los valores vienen de css/theme.css. Los platos de ejemplo son inventados.

import { esc, icon } from "../ui.js";
import { mealCardHTML } from "../meal-card.js";

// Comidas de ejemplo en sus tres estados.
const SAMPLE = {
  comida: {
    momento: "comida",
    plato: "Ensalada de garbanzos con atún",
    recetaId: null,
    ingredientes: [
      { nombre: "Garbanzos cocidos", cantidad: 120, unidad: "g" },
      { nombre: "Atún", cantidad: 1, unidad: "lata" },
      { nombre: "Tomate", cantidad: 2, unidad: "pieza" },
    ],
    nota: "Lleva limón y un poco de comino",
  },
  desayuno: {
    momento: "desayuno",
    plato: "Avena con plátano y nueces",
    ingredientes: [{ nombre: "Avena", cantidad: 40, unidad: "g" }],
    nota: "",
  },
  cena: { momento: "cena", plato: "Tortilla de verduras", ingredientes: [{ nombre: "Huevo", cantidad: 2, unidad: "pieza" }], nota: "" },
};

const RECIPES = [
  { cat: "comida", emoji: "🥗", name: "Ensalada de garbanzos", kcal: 420, prot: 32, min: 5, tupper: true },
  { cat: "desayuno", emoji: "🥣", name: "Avena con plátano", kcal: 350, prot: 14, min: 3 },
  { cat: "colacion", emoji: "🍎", name: "Manzana con crema de cacahuate", kcal: 210, prot: 7, min: 1 },
  { cat: "modulo", emoji: "🍚", name: "Arroz para la semana", kcal: 180, prot: 4, min: 10, tupper: true },
  { cat: "sazon", emoji: "🌶️", name: "Salsa de chile y limón", kcal: 20, prot: 0, min: 5 },
];

function recipeCard(r) {
  const tags = [`⏱️ ${r.min} min`, r.tupper ? "🥡" : ""].filter(Boolean).join(" · ");
  return `
    <a class="card recipe" href="#/styleguide">
      <div class="recipe-photo" data-cat="${r.cat}"><span class="recipe-emoji" aria-hidden="true">${r.emoji}</span></div>
      <div class="recipe-body">
        <p class="title recipe-name">${esc(r.name)}</p>
        <p class="recipe-meta">${r.kcal} kcal · ${r.prot} g prot</p>
        <p class="recipe-meta">${tags}</p>
      </div>
    </a>`;
}

export function renderStyleguide(view) {
  view.innerHTML = `
    <a class="icon-btn" href="#/ajustes" aria-label="Volver">${icon("chevron-left")}</a>
    <h1 class="title screen-title" style="margin-top: 16px">Guía de estilos</h1>

    <h2 class="title section-title">Tipografía</h2>
    <div class="card stack">
      <p class="title" style="font-size: var(--font-size-xxl)">Hoy</p>
      <p class="title" style="font-size: var(--font-size-xl)">Semana del 19 oct</p>
      <p class="title" style="font-size: var(--font-size-lg)">Ensalada de garbanzos</p>
      <p>Onest para todo: texto normal a 17 px, fácil de leer.</p>
      <p class="small muted">Texto secundario, 15 px</p>
      <p class="eyebrow">Fechas y ayudas</p>
    </div>

    <h2 class="title section-title">Colores</h2>
    <div class="swatches">
      <div class="swatch" style="background: var(--color-primary); color: var(--color-on-primary)">Principal</div>
      <div class="swatch" style="background: var(--color-accent); color: var(--color-text)">Acento</div>
      <div class="swatch" style="background: var(--color-bg); color: var(--color-text); box-shadow: inset 0 0 0 1px var(--color-border)">Fondo</div>
      <div class="swatch" style="background: var(--eaten-bg); color: var(--eaten-ink)">✅ Comido</div>
      <div class="swatch" style="background: var(--swapped-bg); color: var(--swapped-ink)">🔄 Cambiado</div>
      <div class="swatch" style="background: var(--skipped-bg); color: var(--skipped-ink)">❌ No</div>
    </div>

    <h2 class="title section-title">Etiquetas del día</h2>
    <div class="tags">
      <span class="tag tag-blue">🏢 Oficina</span>
      <span class="tag tag-green">🏋️ Gym</span>
      <span class="tag tag-peach">🏷️ Otra etiqueta</span>
    </div>

    <h2 class="title section-title">Progreso del día</h2>
    <div class="card progress">
      <div class="progress-bar"><span data-state="comido"></span><span data-state="cambiado"></span><span data-state="no"></span><span></span><span></span></div>
      <p class="small muted">3 de 5 comidas marcadas</p>
    </div>

    <h2 class="title section-title">Comidas</h2>
    <p class="small muted" style="margin: -8px 0 16px">Para marcarlas de verdad, usa Hoy.</p>
    <div class="stack">
      ${mealCardHTML(SAMPLE.comida, undefined)}
      ${mealCardHTML(SAMPLE.desayuno, { estado: "comido", valoracion: "up", nota: "Muy fácil" })}
      ${mealCardHTML(SAMPLE.cena, { estado: "cambiado", sustituto: "Nuggets de respaldo" })}
    </div>

    <h2 class="title section-title">Recetas sin foto</h2>
    <div class="recipe-grid">${RECIPES.map(recipeCard).join("")}</div>

    <h2 class="title section-title">Botones</h2>
    <div class="stack">
      <button class="btn btn-primary btn-block">${icon("clipboard-paste")} Pegar del portapapeles</button>
      <button class="btn btn-secondary btn-block">${icon("download")} Exportar respaldo</button>
      <button class="btn btn-ghost btn-block">Desmarcar todo</button>
      <div class="chips">
        <button class="chip" aria-pressed="true">Todas</button>
        <button class="chip" aria-pressed="false">Comida</button>
        <button class="chip" aria-pressed="false">Desayuno</button>
        <button class="chip" aria-pressed="false">Colación</button>
      </div>
    </div>

    <h2 class="title section-title">Campo de texto</h2>
    <textarea class="field" placeholder='Pega aquí el JSON que te dio Claude'></textarea>
  `;

}

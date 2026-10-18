// Recetas: cuadrícula con fotos, filtros por categoría y buscador; detalle con "Poner foto".
// Las fotos viven solo en el teléfono (IndexedDB), nunca en el código.

import { esc, icon, emptyState, toast, askSheet } from "../ui.js";
import { CATEGORIAS, formatQty } from "../logic/menu.js";
import { resizeToJpeg } from "../lib/imagen.js";
import { allRecipes, getRecipe, allPhotos, getPhoto, savePhoto, deletePhoto, cacheRecipeImage, recipeHistory } from "../store.js";
import { shortDay } from "../logic/fechas.js";

// Emoji cuando la receta no trae uno.
const CAT_EMOJI = { comida: "🍲", desayuno: "🍳", colacion: "🍎", modulo: "🧩", sazon: "🧂" };

let filtro = ""; // categoría elegida (se recuerda mientras la app está abierta)
let busqueda = "";

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function matchesSearch(receta, query) {
  const q = normalize(query).trim();
  if (!q) return true;
  const haystack = normalize([receta.nombre, ...receta.ingredientes.map((i) => i.nombre)].join(" "));
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

function tagsLine(r) {
  return [
    r.tiempoActivoMin != null && `⏱️ ${r.tiempoActivoMin} min`,
    r.tupper && "🥡 tupper",
    r.hierro && "🩸 hierro",
  ]
    .filter(Boolean)
    .join(" · ");
}

function macrosLine(r) {
  if (!r.macros) return "";
  return [r.macros.kcal != null && `${r.macros.kcal} kcal`, r.macros.prot != null && `${r.macros.prot} g prot`].filter(Boolean).join(" · ");
}

// URLs temporales de las fotos guardadas; se liberan al salir de la pantalla.
function photoUrls() {
  const urls = [];
  return {
    of(photo) {
      if (!photo?.blob) return "";
      const url = URL.createObjectURL(photo.blob);
      urls.push(url);
      return url;
    },
    release: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

// Foto (guardada, o imagenUrl si aún no se guardó) o el degradado con emoji.
function photoHTML(r, src, className) {
  const url = (src || r.imagenUrl || "").replace(/["'()\\\s]/g, encodeURIComponent); // seguro dentro de url("…")
  return `
    <div class="recipe-photo ${className}" data-cat="${r.categoria}" ${url ? `style="background-image: url(&quot;${esc(url)}&quot;)"` : ""}>
      ${url ? "" : `<span class="recipe-emoji" aria-hidden="true">${esc(r.emoji || CAT_EMOJI[r.categoria] || "🍽️")}</span>`}
    </div>`;
}

export async function renderRecetas(view, id) {
  if (id) return renderDetalle(view, decodeURIComponent(id));

  const [recetas, fotos] = await Promise.all([allRecipes(), allPhotos()]);

  if (!recetas.length) {
    view.innerHTML = `
      <h1 class="screen-title">Recetas</h1>
      ${emptyState({
        emoji: "🥑",
        title: "Aún no hay recetario",
        text: "Pega el recetario que te dio Claude. Después podrás ponerle tus fotos.",
        action: `<a class="btn btn-primary" href="#/importar">${icon("clipboard-paste")} Importar recetario</a>`,
      })}`;
    return;
  }

  const urls = photoUrls();
  view.cleanup = urls.release;
  const categorias = CATEGORIAS.filter((c) => recetas.some((r) => r.categoria === c.id));
  if (!categorias.some((c) => c.id === filtro)) filtro = "";

  view.innerHTML = `
    <h1 class="screen-title">Recetas</h1>
    <label class="search">
      ${icon("search")}
      <span class="sr-only">Buscar</span>
      <input class="field" type="search" placeholder="Buscar receta o ingrediente" value="${esc(busqueda)}" autocomplete="off" enterkeyhint="search" />
    </label>
    ${
      categorias.length > 1
        ? `<div class="chips recipe-filter">
            <button class="chip" data-cat="" aria-pressed="${!filtro}">Todas</button>
            ${categorias.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${filtro === c.id}">${esc(c.label)}</button>`).join("")}
          </div>`
        : ""
    }
    <div class="recipe-grid"></div>`;

  const grid = view.querySelector(".recipe-grid");
  const photoSrc = new Map(); // se crea una URL por foto una sola vez

  function renderGrid() {
    const visible = recetas.filter((r) => (!filtro || r.categoria === filtro) && matchesSearch(r, busqueda));
    grid.innerHTML = visible.length
      ? visible
          .map((r) => {
            if (!photoSrc.has(r.id)) photoSrc.set(r.id, urls.of(fotos.get(r.id)));
            return `
            <a class="card recipe" href="#/receta/${encodeURIComponent(r.id)}">
              ${photoHTML(r, photoSrc.get(r.id), "")}
              <div class="recipe-body">
                <p class="title recipe-name">${esc(r.nombre)}</p>
                ${macrosLine(r) ? `<p class="recipe-meta">${macrosLine(r)}</p>` : ""}
                ${tagsLine(r) ? `<p class="recipe-meta">${tagsLine(r)}</p>` : ""}
              </div>
            </a>`;
          })
          .join("")
      : `<p class="muted no-results">No encontré recetas con “${esc(busqueda)}”.</p>`;
  }
  renderGrid();

  view.oninput = (event) => {
    if (event.target.type !== "search") return;
    busqueda = event.target.value;
    renderGrid();
  };
  view.onclick = (event) => {
    const chip = event.target.closest("[data-cat]");
    if (!chip || !chip.classList.contains("chip")) return;
    filtro = chip.dataset.cat;
    view.querySelectorAll(".recipe-filter .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.cat === filtro));
    renderGrid();
  };

  // En segundo plano: guarda en el teléfono las fotos de imagenUrl que falten (para verlas sin conexión).
  for (const r of recetas) {
    if (r.imagenUrl && !fotos.has(r.id)) cacheRecipeImage(r);
  }
}

// Lo que has dicho de esta receta (sale de lo que marcas en Hoy).
function historyHTML(h) {
  if (!h.comida && !h.cambiada && !h.notas.length) return "";
  const resumen = [
    h.comida && `Comida ${h.comida === 1 ? "1 vez" : `${h.comida} veces`}`,
    h.cambiada && `${h.cambiada} ${h.cambiada === 1 ? "vez cambiada o no comida" : "veces cambiada o no comida"}`,
    h.up && `👍 ${h.up}`,
    h.down && `👎 ${h.down}`,
  ].filter(Boolean);
  return `
    <h2 class="title section-title">Tu historial</h2>
    <div class="card recipe-history">
      <p>${resumen.join(" · ")}</p>
      ${
        h.notas.length
          ? `<ul>${h.notas
              .slice(0, 5)
              .map((n) => `<li><span class="muted">${esc(shortDay(n.fecha))}</span> ${n.valoracion === "up" ? "👍 " : n.valoracion === "down" ? "👎 " : ""}“${esc(n.nota)}”</li>`)
              .join("")}</ul>`
          : ""
      }
    </div>`;
}

async function renderDetalle(view, id) {
  const receta = await getRecipe(id);
  if (!receta) {
    view.innerHTML = `
      <a class="icon-btn" href="#/recetas" aria-label="Volver">${icon("chevron-left")}</a>
      ${emptyState({ emoji: "🔎", title: "No encontré esta receta", text: "Puede que no esté en el recetario que importaste." })}`;
    return;
  }

  const urls = photoUrls();
  view.cleanup = urls.release;
  const r = receta;

  async function render() {
    const [foto, hist] = await Promise.all([getPhoto(r.id), recipeHistory(r.id)]);
    const mine = foto?.origen === "usuario";
    const hasPhoto = Boolean(foto || r.imagenUrl);

    view.innerHTML = `
      <div class="recipe-hero">
        ${photoHTML(r, urls.of(foto), "hero-photo")}
        <button class="icon-btn hero-back" data-action="back" aria-label="Volver">${icon("chevron-left")}</button>
        <label class="icon-btn hero-camera" aria-label="${hasPhoto ? "Cambiar foto" : "Poner foto"}">
          ${icon("camera")}
          <input type="file" accept="image/*" class="sr-only" data-photo-input />
        </label>
      </div>

      <h1 class="title recipe-title">${esc(r.nombre)}</h1>
      <p class="muted recipe-sub">${esc(CATEGORIAS.find((c) => c.id === r.categoria)?.label || "")}${tagsLine(r) ? ` · ${tagsLine(r)}` : ""}</p>

      ${
        r.macros
          ? `<div class="macros recipe-macros">
              ${[["kcal", "kcal"], ["prot", "prot"], ["carb", "carb"], ["grasa", "grasa"], ["fibra", "fibra"]]
                .filter(([k]) => r.macros[k] != null)
                .map(([k, label]) => `<div class="macro"><span class="macro-value">${r.macros[k]}${k === "kcal" ? "" : " g"}</span><span class="macro-label">${label}</span></div>`)
                .join("")}
            </div>`
          : ""
      }

      ${r.aparato.length ? `<p class="recipe-info">${icon("cooking-pot")} ${esc(r.aparato.join(", "))}${r.batch ? " · se puede hacer en batch" : ""}</p>` : r.batch ? `<p class="recipe-info">${icon("cooking-pot")} Se puede hacer en batch</p>` : ""}

      ${
        r.ingredientes.length
          ? `<h2 class="title section-title">Ingredientes</h2>
             <ul class="card meal-ingredients recipe-ingredients">
               ${r.ingredientes.map((i) => `<li><span>${esc(i.nombre)}</span><span class="qty">${esc(formatQty(i.cantidad, i.unidad))}</span></li>`).join("")}
             </ul>`
          : ""
      }

      ${
        r.pasos.length
          ? `<h2 class="title section-title">Pasos</h2>
             <ol class="steps">${r.pasos.map((p, n) => `<li><span class="step-n">${n + 1}</span><span>${esc(p)}</span></li>`).join("")}</ol>`
          : ""
      }

      ${historyHTML(hist)}

      ${/^https?:\/\//.test(r.fuente) ? `<a class="btn btn-secondary btn-block recipe-source" href="${esc(r.fuente)}" target="_blank" rel="noopener">${icon("external-link")} Ver fuente</a>` : r.fuente ? `<p class="small muted recipe-source">Fuente: ${esc(r.fuente)}</p>` : ""}

      <div class="stack recipe-photo-actions">
        <label class="btn btn-secondary btn-block">
          ${icon("camera")} ${hasPhoto ? "Cambiar foto" : "Poner foto"}
          <input type="file" accept="image/*" class="sr-only" data-photo-input />
        </label>
        ${mine ? `<button class="btn btn-ghost btn-block" data-action="remove-photo">Quitar mi foto</button>` : ""}
      </div>`;
  }

  await render();

  view.onchange = async (event) => {
    const input = event.target.closest("[data-photo-input]");
    const file = input?.files?.[0];
    if (!file) return;
    try {
      toast("Guardando foto…");
      const blob = await resizeToJpeg(file);
      await savePhoto(r.id, blob, "usuario");
      urls.release();
      await render();
      toast("Foto guardada");
    } catch (error) {
      console.error(error);
      toast("No pude usar esa foto. Prueba con otra.");
    }
  };

  view.onclick = async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "back") {
      if (history.length > 1) history.back();
      else location.hash = "#/recetas";
    }
    if (action === "remove-photo") {
      const answer = await askSheet({
        title: "¿Quitar tu foto?",
        text: r.imagenUrl ? "Volverá a verse la foto del recetario." : "La receta volverá a mostrarse con su color y emoji.",
        actions: [
          { id: "yes", label: "Quitar foto", style: "primary" },
          { id: "no", label: "Cancelar", style: "ghost" },
        ],
      });
      if (answer !== "yes") return;
      await deletePhoto(r.id);
      urls.release();
      await render();
      if (r.imagenUrl) cacheRecipeImage(r).then((saved) => saved && render());
    }
  };
}

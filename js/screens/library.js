// Pestaña Ejercicios: biblioteca con buscador y filtros.

import { getAllExercises, getFavorites, toggleFavoriteExercise } from "../store.js";
import { MUSCLE_GROUPS } from "../data/catalog.js";
import { esc, icons, equipmentName, muscleName, pageHeader } from "../ui.js";
import { t } from "../i18n.js";

// Se recuerda el filtro mientras la app está abierta.
let query = "";
let filter = "all";

// Filtros: los de músculos usan el nombre "group.<clave>"; el resto "library.filter.<clave>".
const FILTERS = ["all", "favorites", ...Object.keys(MUSCLE_GROUPS), "mine", "disliked"];
const filterLabel = (f) => (MUSCLE_GROUPS[f] ? t(`group.${f}`) : t(`library.filter.${f}`));

export async function renderLibrary(view) {
  const exercises = await getAllExercises();
  let favorites = await getFavorites();

  view.innerHTML = `
    ${pageHeader({
      eyebrow: t("library.count", { n: exercises.length }),
      title: t("tab.ejercicios"),
      action: `<a class="icon-btn icon-btn-filled" href="#/ejercicio/nuevo" aria-label="${t("library.add")}">${icons.plus}</a>`,
    })}
    <label class="search">
      ${icons.search}
      <input class="input" type="search" placeholder="${t("library.search")}" value="${esc(query)}" />
    </label>
    <div class="filter-row">
      ${FILTERS.map((f) => `<button class="pill" data-filter="${f}" aria-pressed="${f === filter}">${filterLabel(f)}</button>`).join("")}
    </div>
    <div class="list" id="exercise-list"></div>
  `;

  const listEl = view.querySelector("#exercise-list");

  const drawList = () => {
    const q = normalize(query);
    const matches = exercises
      .filter((e) => {
        if (filter === "favorites") return favorites.exercises.includes(e.id);
        if (filter === "mine") return e.custom;
        if (filter === "disliked") return favorites.disliked.includes(e.id);
        if (filter !== "all") return e.primary.some((m) => MUSCLE_GROUPS[filter].includes(m));
        return true;
      })
      .filter((e) => !q || normalize([e.name, ...e.primary.map(muscleName), ...e.secondary.map(muscleName), equipmentName(e.equipment)].join(" ")).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    listEl.innerHTML = matches.length
      ? matches
          .map((e) => {
            const fav = favorites.exercises.includes(e.id);
            return `
          <div class="list-row">
            <a class="list-row-text" href="#/ejercicio/${e.id}">
              <strong>${esc(e.name)}</strong>
              <small>${favorites.disliked.includes(e.id) ? `${t("exercise.dislikedShort")} · ` : ""}${e.primary.map(muscleName).join(", ")} · ${equipmentName(e.equipment)}</small>
            </a>
            <button class="icon-btn star ${fav ? "on" : ""}" data-star="${e.id}" aria-label="${t("exercise.favorite")}" aria-pressed="${fav}">
              ${fav ? icons.starFilled : icons.star}
            </button>
          </div>`;
          })
          .join("")
      : `<p class="empty">${["favorites", "mine", "disliked"].includes(filter) ? t(`library.empty.${filter}`) : t("library.empty.none")}</p>`;
  };

  drawList();

  view.oninput = (event) => {
    if (event.target.type === "search") {
      query = event.target.value;
      drawList();
    }
  };

  view.onclick = async (event) => {
    const pill = event.target.closest("[data-filter]");
    if (pill) {
      filter = pill.dataset.filter;
      view.querySelectorAll("[data-filter]").forEach((p) => p.setAttribute("aria-pressed", p === pill));
      drawList();
      return;
    }
    const star = event.target.closest("[data-star]");
    if (star) {
      await toggleFavoriteExercise(star.dataset.star);
      favorites = await getFavorites();
      drawList();
    }
  };
}

const normalize = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

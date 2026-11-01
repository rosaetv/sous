// Formulario para agregar o editar un ejercicio propio.

import { getExercise, saveCustomExercise } from "../store.js";
import { MUSCLES, EQUIPMENT, PATTERNS } from "../data/catalog.js";
import { esc, header, toast } from "../ui.js";
import { t } from "../i18n.js";

export async function renderExerciseForm(view, id) {
  const existing = id ? await getExercise(id) : null;
  const data = existing
    ? { ...existing }
    : { name: "", equipment: "", pattern: "other", primary: [], secondary: [], description: "" };

  const pills = (group, options, selected, multi) =>
    Object.entries(options)
      .map(
        ([key, label]) =>
          `<button type="button" class="pill" data-group="${group}" data-value="${key}" data-multi="${multi}"
            aria-pressed="${multi ? selected.includes(key) : selected === key}">${label}</button>`
      )
      .join("");

  view.innerHTML = `
    ${header({ title: existing ? t("exercise.edit") : t("form.newTitle"), back: existing ? `#/ejercicio/${id}` : "#/ejercicios" })}
    <form class="form" novalidate>
      <label class="field">
        <span>${t("form.name")}</span>
        <input class="input" name="name" value="${esc(data.name)}" placeholder="${t("form.namePlaceholder")}" autocomplete="off" />
      </label>

      <div class="field">
        <span>${t("form.equipment")}</span>
        <div class="pill-wrap">${pills("equipment", EQUIPMENT, data.equipment, false)}</div>
      </div>

      <div class="field">
        <span>${t("exercise.primary")}</span>
        <div class="pill-wrap">${pills("primary", MUSCLES, data.primary, true)}</div>
      </div>

      <div class="field">
        <span>${t("exercise.secondary")} <small>${t("form.optional")}</small></span>
        <div class="pill-wrap">${pills("secondary", MUSCLES, data.secondary, true)}</div>
      </div>

      <label class="field">
        <span>${t("form.pattern")} <small>${t("form.patternHint")}</small></span>
        <select class="input" name="pattern">
          ${Object.entries(PATTERNS)
            .map(([key, label]) => `<option value="${key}" ${data.pattern === key ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>${t("exercise.howTo")} <small>${t("form.optional")}</small></span>
        <textarea class="input textarea" name="description" rows="4" placeholder="${t("form.descriptionPlaceholder")}">${esc(data.description)}</textarea>
      </label>

      <p class="form-error" role="alert"></p>
      <button class="btn btn-primary" type="submit">${t("form.save")}</button>
    </form>
  `;

  const form = view.querySelector("form");

  view.onclick = (event) => {
    const pill = event.target.closest("[data-group]");
    if (!pill) return;
    const { group, value, multi } = pill.dataset;
    if (multi === "true") {
      const set = new Set(data[group]);
      set.has(value) ? set.delete(value) : set.add(value);
      data[group] = [...set];
      pill.setAttribute("aria-pressed", set.has(value));
    } else {
      data[group] = value;
      view.querySelectorAll(`[data-group="${group}"]`).forEach((p) => p.setAttribute("aria-pressed", p === pill));
    }
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    data.name = form.elements.name.value.trim();
    data.pattern = form.elements.pattern.value;
    data.description = form.elements.description.value.trim();
    data.secondary = data.secondary.filter((m) => !data.primary.includes(m));

    const error = !data.name
      ? t("form.errorName")
      : !data.equipment
      ? t("form.errorEquipment")
      : !data.primary.length
      ? t("form.errorMuscle")
      : "";
    form.querySelector(".form-error").textContent = error;
    if (error) return;

    if (!data.id) data.id = `propio-${Date.now().toString(36)}`;
    await saveCustomExercise(data);
    toast(existing ? t("form.saved") : t("form.added"));
    location.replace(`#/ejercicio/${data.id}`);
  };
}

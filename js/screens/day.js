// Rutina de un día. Se usa para la vista previa del plan nuevo y para el plan guardado.

import { getPlan, savePlan, getDraft, saveDraft, deleteDraft, getAllExercises, getNotes, setNote, getFavorites, getLastPerformance } from "../store.js";
import { suggestNext, targetReps } from "../progression.js";
import { GOALS } from "../data/catalog.js";
import { findAlternatives, makeItem, stressesCare } from "../generator.js";
import { makeDraft } from "./wizard.js";
import { startWorkout } from "./session.js";
import { esc, icons, header, closingHeader, muscleTags, formatDose, formatRest, openSheet, confirmSheet, toast, equipmentName, muscleName, dayLabel } from "../ui.js";
import { getDeload, isDeloadActive, deloadSets } from "../deload.js";
import { t } from "../i18n.js";
import { proposeExtras, enableSupersets, disableSupersets, blocks, pairRest } from "../supersets.js";

/** mode: "plan" (guardado) o "draft" (vista previa) */
export async function renderDay(view, mode, dayIndex) {
  const isDraft = mode === "draft";
  const plan = isDraft ? await getDraft() : await getPlan();
  if (!plan) {
    location.hash = "#/entrenar";
    return;
  }
  const index = Math.min(Number(dayIndex), plan.days.length - 1);
  const day = plan.days[index];
  const exercises = await getAllExercises();
  const notes = await getNotes();
  const byId = (id) => exercises.find((e) => e.id === id);
  // En semana de descarga se muestran menos series y la meta mínima.
  const deload = !isDraft && isDeloadActive(await getDeload());
  // Meta de repeticiones de cada ejercicio según tu historial.
  const targets = {};
  for (const item of day.items) {
    const ex = byId(item.exerciseId);
    const suggestion = ex ? suggestNext(ex, await getLastPerformance(item.exerciseId), item) : null;
    targets[item.exerciseId] = deload ? item.repMin : targetReps(item, suggestion);
  }
  const shown = (item) => (deload ? { ...item, sets: deloadSets(item.sets) } : item);
  if (isDraft) document.body.classList.add("focus-mode");

  const dayTabs = plan.days
    .map(
      (d, i) =>
        `<a class="segment" href="#/${isDraft ? "plan/preview" : "dia"}/${i}" aria-current="${i === index}">${t("common.dayN", { n: i + 1 })}</a>`
    )
    .join("");

  const card = (item, i, label, showRest) => {
    const ex = byId(item.exerciseId);
    if (!ex) {
      return `<article class="card ex-card"><p class="muted">${t("common.deletedExercise")}</p>
        <button class="btn-small" data-action="swap" data-index="${i}">${icons.swap} ${t("common.swap")}</button></article>`;
    }
    const note = notes[ex.id];
    return `
      <article class="card ex-card">
        <div class="ex-head">
          <a class="ex-name" href="#/ejercicio/${ex.id}"><span class="ex-index ${item.group ? "pair" : ""}">${label}</span>${esc(ex.name)}</a>
          <button class="icon-btn ${note ? "has-note" : ""}" data-action="note" data-id="${ex.id}" aria-label="${t("note.label")}">${icons.pencil}</button>
        </div>
        <p class="ex-dose">${formatDose(shown(item), ex, targets[item.exerciseId], showRest)}</p>
        <div class="tags">${muscleTags(ex)}</div>
        ${note ? `<p class="ex-note" data-action="note" data-id="${ex.id}">${esc(note)}</p>` : ""}
        <div class="ex-actions">
          <button class="btn-small" data-action="swap" data-index="${i}">${icons.swap} ${t("common.swap")}</button>
          <a class="btn-small" href="#/ejercicio/${ex.id}">${icons.info} ${t("exercise.howTo")}</a>
        </div>
      </article>`;
  };

  // Superseries: las parejas van juntas en un bloque (A1, A2); el resto con número.
  let soloNumber = 0;
  // Título "Cierre" antes del primer ejercicio del cierre.
  let closingShown = false;
  const closingFor = (entries) => {
    if (!entries[0].item.finisher || closingShown) return "";
    closingShown = true;
    return closingHeader();
  };
  const cards = blocks(day.items)
    .map(({ group, entries }) => {
      const closing = closingFor(entries);
      if (!group) return closing + entries.map(({ item, index: i }) => card(item, i, ++soloNumber, true)).join("");
      return `${closing}
        <div class="ss-group">
          <p class="ss-label"><span>${t("superset.label", { letter: group })}</span><span>${t("dose.rest", { time: formatRest(pairRest(entries.map((e) => e.item))) })}</span></p>
          ${entries.map(({ item, index: i }, n) => card(item, i, `${group}${n + 1}`, false)).join("")}
        </div>`;
    })
    .join("");

  const supersetToggle = isDraft
    ? ""
    : `
    <div class="ss-row">
      <span><strong>${t("superset.title")}</strong><small>${t("superset.hint")}</small></span>
      <span class="unit-toggle" role="group" aria-label="${t("superset.title")}">
        <button type="button" data-action="superset" data-value="off" aria-pressed="${!day.superset}">${t("common.no")}</button>
        <button type="button" data-action="superset" data-value="on" aria-pressed="${Boolean(day.superset)}">${t("common.yes")}</button>
      </span>
    </div>`;

  view.innerHTML = `
    ${isDraft
      ? header({ title: t("day.newPlan"), back: "#/plan/nuevo" })
      : header({ title: "", back: "#/entrenar" })}
    <nav class="segments">${dayTabs}</nav>
    <h1 class="screen-title">${esc(dayLabel(day))}</h1>
    <p class="muted day-meta">${t("home.dayMeta", { n: day.items.length, minutes: plan.minutes })} · ${GOALS[plan.goal].label}${plan.focus?.length ? ` · ${t("day.focus", { list: plan.focus.map((g) => t(`group.${g}`)).join(", ") })}` : ""}${deload ? ` · ${t("deload.tag")}` : ""}</p>
    ${supersetToggle}
    ${cards}
    ${isDraft
      ? `<div class="bottom-bar bottom-bar-split">
           <button class="btn btn-secondary" data-action="regenerate">${icons.refresh} ${t("day.regenerate")}</button>
           <button class="btn btn-primary" data-action="save">${t("day.savePlan")}</button>
         </div>`
      : `<div class="bottom-spacer"></div>
         <div class="bottom-bar above-tabs">
           <button class="btn btn-primary" data-action="start">${t("day.startWorkout")}</button>
         </div>`}
  `;

  const persist = () => (isDraft ? saveDraft(plan) : savePlan(plan));

  view.onclick = async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action } = target.dataset;

    if (action === "swap") {
      const i = Number(target.dataset.index);
      const current = byId(day.items[i].exerciseId);
      chooseAlternative(current, exercises, plan.excludedEquipment, plan.care, async (chosen) => {
        const { group, extra, finisher, sets, exerciseId: previousId } = day.items[i];
        day.items[i] = { ...makeItem(chosen, plan.goal, i, plan), ...(group && { group }), ...(extra && { extra }), ...(finisher && { finisher, sets }) };
        if (day.originalOrder) day.originalOrder = day.originalOrder.map((id) => (id === previousId ? chosen.id : id));
        await persist();
        toast(t("day.swapped"));
        renderDay(view, mode, index);
      });
    } else if (action === "superset") {
      const on = target.dataset.value === "on";
      if (on === Boolean(day.superset)) return;
      const refresh = () => renderDay(view, mode, index);
      if (on) {
        supersetSheet(plan, index, exercises, async (extras) => {
          enableSupersets(plan, index, extras, exercises);
          await persist();
          toast(extras.length ? t("superset.addedN", { n: extras.length }) : t("superset.on"));
          refresh();
        });
      } else {
        const extras = day.items.filter((i) => i.extra).length;
        if (extras) {
          const ok = await confirmSheet({
            title: t("superset.offTitle"),
            text: t("superset.offText", { n: extras }),
            confirmLabel: t("superset.offConfirm"),
          });
          if (!ok) return;
        }
        disableSupersets(plan, index);
        await persist();
        toast(t("superset.off"));
        refresh();
      }
    } else if (action === "note") {
      editNote(byId(target.dataset.id), notes[target.dataset.id] || "", () => renderDay(view, mode, index));
    } else if (action === "start") {
      await startWorkout(plan, index);
    } else if (action === "regenerate") {
      await makeDraft();
    } else if (action === "save") {
      const existing = await getPlan();
      if (existing) {
        const ok = await confirmSheet({
          title: t("day.replaceTitle"),
          text: t("day.replaceText"),
          confirmLabel: t("day.replaceConfirm"),
        });
        if (!ok) return;
      }
      await savePlan(plan);
      await deleteDraft();
      toast(t("day.saved"));
      location.hash = "#/entrenar";
    }
  };
}

// ---------- Activar superseries: elegir ejercicios extra ----------

async function supersetSheet(plan, dayIndex, exercises, onConfirm) {
  const extras = proposeExtras(plan, dayIndex, exercises, await getFavorites());
  if (!extras.length) return onConfirm([]);
  const close = openSheet({
    title: t("superset.extrasTitle", { n: extras.length }),
    body: `
      <p class="sheet-text">${t("superset.extrasText")}</p>
      <div class="check-list">
        ${extras
          .map(
            (e) => `
          <label class="check-row">
            <input type="checkbox" value="${e.id}" checked />
            <span><strong>${esc(e.name)}</strong><small>${e.primary.map(muscleName).join(", ")}</small></span>
          </label>`
          )
          .join("")}
      </div>
      <div class="stack">
        <button class="btn btn-primary" data-add>${t("superset.addN", { n: extras.length })}</button>
        <button class="btn btn-secondary" data-only>${t("superset.onlyPair")}</button>
      </div>`,
    onMount: (sheet) => {
      const add = sheet.querySelector("[data-add]");
      const chosen = () => [...sheet.querySelectorAll("input:checked")].map((input) => extras.find((e) => e.id === input.value));
      sheet.addEventListener("change", () => {
        const n = chosen().length;
        add.textContent = n ? t("superset.addN", { n }) : t("superset.activate");
      });
      add.onclick = () => {
        close();
        onConfirm(chosen());
      };
      sheet.querySelector("[data-only]").onclick = () => {
        close();
        onConfirm([]);
      };
    },
  });
}

// ---------- Elegir alternativa ----------

/** care: zonas a cuidar del plan; esos ejercicios van al final y se marcan. */
export async function chooseAlternative(current, exercises, excludedEquipment, care = [], onChoose) {
  const favorites = await getFavorites();
  let showAll = false;

  const render = () => {
    const pool = current
      ? findAlternatives(current, exercises, showAll ? [] : excludedEquipment)
      : exercises.map((exercise) => ({ exercise, reason: "" }));
    const hidden = current && !showAll ? findAlternatives(current, exercises).length - pool.length : 0;
    // Los que no te gustan o cargan una zona a cuidar van al final.
    const last = (e) => favorites.disliked.includes(e.id) || Boolean(stressesCare(e, care));
    pool.sort((a, b) => last(a.exercise) - last(b.exercise));
    return `
      ${current ? `<p class="sheet-text">${t("alt.intro", { name: `<strong>${esc(current.name)}</strong>` })}</p>` : ""}
      <div class="list">
        ${pool
          .slice(0, 25)
          .map(
            ({ exercise: e, reason }) => `
          <button class="list-row" data-choose="${e.id}">
            <span class="list-row-text">
              <strong>${favorites.exercises.includes(e.id) ? "⭐ " : ""}${esc(e.name)}</strong>
              <small>${favorites.disliked.includes(e.id) ? `${t("exercise.dislikedShort")} · ` : ""}${stressesCare(e, care) ? `${t("care.flag", { zone: t(`care.${stressesCare(e, care)}`).toLowerCase() })} · ` : ""}${reason ? `${reason} · ` : ""}${equipmentName(e.equipment)} · ${e.primary.map(muscleName).join(", ")}</small>
            </span>
          </button>`
          )
          .join("")}
      </div>
      ${hidden > 0 ? `<button class="link-btn center-block" data-show-all>${t("alt.showHidden", { n: hidden })}</button>` : ""}
    `;
  };

  const close = openSheet({
    title: t("alt.title"),
    body: render(),
    onMount: (sheet) => {
      sheet.addEventListener("click", (event) => {
        if (event.target.closest("[data-show-all]")) {
          showAll = true;
          sheet.querySelector(".sheet-body").innerHTML = render();
          return;
        }
        const row = event.target.closest("[data-choose]");
        if (!row) return;
        close();
        onChoose(exercises.find((e) => e.id === row.dataset.choose));
      });
    },
  });
}

// ---------- Nota del ejercicio ----------

export function editNote(exercise, text, onSaved) {
  const close = openSheet({
    title: `${t("note.label")} · ${exercise.name}`,
    body: `
      <textarea class="input textarea" rows="4" placeholder="${t("note.placeholder")}">${esc(text)}</textarea>
      <div class="stack">
        <button class="btn btn-primary" data-save>${t("note.save")}</button>
        ${text ? `<button class="btn btn-secondary" data-clear>${t("note.delete")}</button>` : ""}
      </div>`,
    onMount: (sheet) => {
      const field = sheet.querySelector("textarea");
      setTimeout(() => field.focus(), 250);
      sheet.querySelector("[data-save]").onclick = async () => {
        await setNote(exercise.id, field.value);
        close();
        onSaved();
      };
      const clear = sheet.querySelector("[data-clear]");
      if (clear)
        clear.onclick = async () => {
          await setNote(exercise.id, "");
          close();
          onSaved();
        };
    },
  });
}


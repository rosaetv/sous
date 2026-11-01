// Cuestionario para crear o ajustar el plan semanal. Una pregunta por pantalla.

import { GOALS, EQUIPMENT, SESSION_MINUTES, MUSCLE_GROUPS } from "../data/catalog.js";
import { CARE_ZONES } from "../data/care.js";
import { getPrefs, savePrefs, getFavorites, setFavoriteEquipment, getPlan, savePlan, saveDraft, getAllExercises } from "../store.js";
import { generatePlan } from "../generator.js";
import { esc, icons, openSheet, toast } from "../ui.js";
import { t } from "../i18n.js";

const STEPS = ["days", "minutes", "goal", "level", "focus", "care", "excluded", "favoriteEquipment"];
const LEVELS = ["principiante", "intermedio", "avanzado"];
const MAX_FOCUS = 2;
// Respuestas de selección múltiple: paso → campo donde se guardan.
const MULTI = { excluded: "excludedEquipment", favoriteEquipment: "favoriteEquipment", focus: "focus", care: "care" };

let answers;
let step;

export async function renderWizard(view) {
  const prefs = await getPrefs();
  const favorites = await getFavorites();
  answers = {
    daysPerWeek: prefs.daysPerWeek ?? null,
    minutes: prefs.minutes ?? 60,
    goal: prefs.goal ?? "hipertrofia",
    level: prefs.level ?? "intermedio",
    focus: prefs.focus ?? [],
    care: prefs.care ?? [],
    excludedEquipment: prefs.excludedEquipment ?? [],
    favoriteEquipment: favorites.equipment,
  };
  step = 0;
  document.body.classList.add("focus-mode");
  draw(view);

  view.onclick = async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, value } = target.dataset;

    if (action === "back") {
      if (step === 0) history.back();
      else {
        step--;
        draw(view);
      }
    } else if (action === "pick") {
      const key = STEPS[step] === "days" ? "daysPerWeek" : STEPS[step];
      answers[key] = ["goal", "level"].includes(key) ? value : Number(value);
      draw(view);
    } else if (action === "toggle") {
      const key = MULTI[STEPS[step]];
      const set = new Set(answers[key]);
      if (set.has(value)) set.delete(value);
      else if (key === "focus" && set.size >= MAX_FOCUS) return toast(t("wizard.focusMax", { n: MAX_FOCUS }));
      else set.add(value);
      answers[key] = [...set];
      draw(view);
    } else if (action === "info") {
      showGoalInfo();
    } else if (action === "next") {
      if (step < STEPS.length - 1) {
        step++;
        draw(view);
      } else {
        await finish();
      }
    }
  };
}

function draw(view) {
  const name = STEPS[step];
  const canContinue = name !== "days" || answers.daysPerWeek;
  view.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="${t("common.back")}">${icons.back}</button>
      <div class="progress" aria-label="${t("wizard.step", { n: step + 1, total: STEPS.length })}">
        ${STEPS.map((_, i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("")}
      </div>
      <span></span>
    </header>
    <div class="wizard">
      ${QUESTIONS[name]()}
    </div>
    <div class="bottom-bar">
      <button class="btn btn-primary" data-action="next" ${canContinue ? "" : "disabled"}>
        ${step === STEPS.length - 1 ? t("home.createPlan") : t("common.next")}
      </button>
    </div>
  `;
}

const chip = (action, value, label, selected, sub = "") => `
  <button class="choice ${sub ? "choice-tall" : ""}" data-action="${action}" data-value="${value}" aria-pressed="${selected}">
    <span>${label}</span>${sub ? `<small>${sub}</small>` : ""}
  </button>`;

const QUESTIONS = {
  days: () => `
    <h1 class="wizard-title">${t("wizard.daysTitle")}</h1>
    <p class="wizard-hint">${t("wizard.daysHint")}</p>
    <div class="choice-grid">
      ${[2, 3, 4, 5, 6].map((n) => chip("pick", n, t("wizard.nDays", { n }), answers.daysPerWeek === n)).join("")}
    </div>`,

  minutes: () => `
    <h1 class="wizard-title">${t("wizard.minutesTitle")}</h1>
    <p class="wizard-hint">${t("wizard.minutesHint")}</p>
    <div class="choice-grid">
      ${SESSION_MINUTES.map((m) => chip("pick", m, m === 75 ? "75+ min" : `${m} min`, answers.minutes === m)).join("")}
    </div>`,

  goal: () => `
    <h1 class="wizard-title">${t("wizard.goalTitle")}</h1>
    <button class="link-btn" data-action="info">${icons.info} ${t("wizard.goalWhich")}</button>
    <div class="choice-list">
      ${Object.entries(GOALS)
        .map(([key, g]) => chip("pick", key, g.label + (key === "hipertrofia" ? ` · ${t("wizard.recommended")}` : ""), answers.goal === key, g.short))
        .join("")}
    </div>`,

  level: () => `
    <h1 class="wizard-title">${t("wizard.levelTitle")}</h1>
    <p class="wizard-hint">${t("wizard.levelHint")}</p>
    <div class="choice-list">
      ${LEVELS.map((key) => chip("pick", key, t(`level.${key}`), answers.level === key, t(`level.${key}.short`))).join("")}
    </div>`,

  focus: () => `
    <h1 class="wizard-title">${t("wizard.focusTitle")}</h1>
    <p class="wizard-hint">${t("wizard.focusHint", { n: MAX_FOCUS })}</p>
    <div class="choice-grid">
      ${Object.keys(MUSCLE_GROUPS).map((key) => chip("toggle", key, t(`group.${key}`), answers.focus.includes(key))).join("")}
    </div>`,

  care: () => `
    <h1 class="wizard-title">${t("wizard.careTitle")}</h1>
    <p class="wizard-hint">${t("wizard.careHint")}</p>
    <div class="choice-grid">
      ${Object.keys(CARE_ZONES).map((key) => chip("toggle", key, t(`care.${key}`), answers.care.includes(key))).join("")}
    </div>
    <p class="wizard-note">${t("wizard.careNote")}</p>`,

  excluded: () => `
    <h1 class="wizard-title">${t("wizard.excludedTitle")}</h1>
    <p class="wizard-hint">${t("wizard.excludedHint")}</p>
    <div class="choice-grid">
      ${Object.entries(EQUIPMENT).map(([key, label]) => chip("toggle", key, label, answers.excludedEquipment.includes(key))).join("")}
    </div>`,

  favoriteEquipment: () => `
    <h1 class="wizard-title">${t("wizard.favoriteTitle")}</h1>
    <p class="wizard-hint">${t("wizard.favoriteHint")}</p>
    <div class="choice-grid">
      ${Object.entries(EQUIPMENT)
        .filter(([key]) => !answers.excludedEquipment.includes(key))
        .map(([key, label]) => chip("toggle", key, label, answers.favoriteEquipment.includes(key)))
        .join("")}
    </div>`,
};

function showGoalInfo() {
  openSheet({
    title: t("wizard.goalInfoTitle"),
    body: Object.values(GOALS)
      .map((g) => `<div class="info-block"><h3>${g.label}</h3><p>${esc(g.info)}</p></div>`)
      .join(""),
  });
}

async function finish() {
  const favoriteEquipment = answers.favoriteEquipment.filter((e) => !answers.excludedEquipment.includes(e));
  await setFavoriteEquipment(favoriteEquipment);
  const { daysPerWeek, minutes, goal, level, focus, care, excludedEquipment } = answers;
  await savePrefs({ daysPerWeek, minutes, goal, level, focus, care, excludedEquipment });

  // Si solo cambió la cantidad de días, ofrece mantener los mismos ejercicios.
  const plan = await getPlan();
  const onlyDaysChanged =
    plan &&
    plan.daysPerWeek !== daysPerWeek &&
    plan.minutes === minutes &&
    plan.goal === goal &&
    (plan.level ?? "intermedio") === level &&
    sameList(plan.focus, focus) &&
    sameList(plan.care, care) &&
    sameList(plan.excludedEquipment, excludedEquipment);

  if (onlyDaysChanged) {
    const close = openSheet({
      title: t("wizard.changeDaysTitle", { n: daysPerWeek }),
      body: `
        <p class="sheet-text">${t("wizard.changeDaysText", { n: daysPerWeek })}</p>
        <div class="stack">
          <button class="btn btn-primary" data-keep>${t("wizard.keepRoutines")}</button>
          <button class="btn btn-secondary" data-new>${t("planAge.new")}</button>
        </div>`,
      onMount: (sheet) => {
        sheet.querySelector("[data-keep]").onclick = async () => {
          plan.daysPerWeek = daysPerWeek;
          await savePlan(plan);
          close();
          toast(t("wizard.goalUpdated", { n: daysPerWeek }));
          location.hash = "#/entrenar";
        };
        sheet.querySelector("[data-new]").onclick = async () => {
          close();
          await makeDraft();
        };
      },
    });
    return;
  }

  await makeDraft();
}

export async function makeDraft() {
  const prefs = await getPrefs();
  const favorites = await getFavorites();
  const exercises = await getAllExercises();
  const draft = generatePlan({ ...prefs, favorites }, exercises);
  await saveDraft(draft);
  location.hash = "#/plan/preview/0";
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

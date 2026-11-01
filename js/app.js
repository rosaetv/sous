// Punto de entrada: decide qué pantalla mostrar según la dirección (#/...).

import { renderHome } from "./screens/home.js";
import { renderWizard } from "./screens/wizard.js";
import { renderDay } from "./screens/day.js";
import { renderSession } from "./screens/session.js";
import { renderHistory, renderWorkout } from "./screens/history.js";
import { renderProfile, renderMetric } from "./screens/profile.js";
import { renderLibrary } from "./screens/library.js";
import { renderExercise } from "./screens/exercise.js";
import { renderExerciseForm } from "./screens/exercise-form.js";
import { renderGoals } from "./screens/goals.js";
import { renderCore } from "./screens/core.js";
import { getActiveWorkout, getProfile } from "./store.js";
import { esc, icons, workoutDayLabel } from "./ui.js";
import { setLanguage, t } from "./i18n.js";
import { applyTheme } from "./theme.js";
import { setupPWA } from "./pwa.js";

const view = document.getElementById("view");

// [patrón, pantalla, pestaña activa]
const routes = [
  [/^entrenar$/, renderHome, "entrenar"],
  [/^plan\/nuevo$/, renderWizard, "entrenar"],
  [/^plan\/preview\/(\d+)$/, (v, i) => renderDay(v, "draft", i), "entrenar"],
  [/^dia\/(\d+)$/, (v, i) => renderDay(v, "plan", i), "entrenar"],
  [/^entrenando$/, renderSession, "entrenar"],
  [/^core$/, renderCore, "entrenar"],
  [/^historial$/, renderHistory, "historial"],
  [/^historial\/([^/]+)$/, renderWorkout, "historial"],
  [/^ejercicios$/, renderLibrary, "ejercicios"],
  [/^ejercicio\/nuevo$/, (v) => renderExerciseForm(v), "ejercicios"],
  [/^ejercicio\/([^/]+)\/editar$/, renderExerciseForm, "ejercicios"],
  [/^ejercicio\/([^/]+)$/, renderExercise, "ejercicios"],
  [/^perfil$/, renderProfile, "perfil"],
  [/^perfil\/(cuerpo|periodo|preferencias|app)$/, renderProfile, "perfil"],
  [/^perfil\/metas$/, renderGoals, "perfil"],
  [/^perfil\/medida\/([^/]+)$/, renderMetric, "perfil"],
];

async function route() {
  const path = location.hash.replace(/^#\/?/, "") || "entrenar";
  let match;
  const found = routes.find(([pattern]) => (match = path.match(pattern))) || routes[0];
  const [, render, tab] = found;

  // Limpia lo que dejó la pantalla anterior.
  view.onclick = view.oninput = view.onchange = null;
  window.onscroll = null;
  document.body.classList.remove("focus-mode");
  document.querySelectorAll(".sheet-backdrop").forEach((s) => s.remove());

  document.querySelectorAll(".tab").forEach((t) => {
    if (t.dataset.tab === tab) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });

  try {
    await render(view, ...(match ? match.slice(1) : []));
  } catch (error) {
    console.error(error);
    view.innerHTML = `<section class="card empty"><p>${t("common.loadError")}</p></section>`;
  }
  window.scrollTo(0, 0);
  await updateResumeBar(path);
}

// Barra para volver al entrenamiento en curso desde cualquier otra pantalla.
async function updateResumeBar(path) {
  let bar = document.getElementById("resume-bar");
  const active = await getActiveWorkout();
  const hidden = !active || path === "entrenando" || path === "entrenar" || document.body.classList.contains("focus-mode");
  document.body.classList.toggle("has-resume-bar", !hidden);
  if (hidden) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("a");
    bar.id = "resume-bar";
    bar.className = "resume-bar";
    bar.href = "#/entrenando";
    document.body.append(bar);
  }
  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  bar.innerHTML = `
    <span class="resume-dot" aria-hidden="true"></span>
    <span class="resume-text"><small>${t("resume.label")}</small><strong>${esc(workoutDayLabel(active))} · ${done}/${total}</strong></span>
    <span class="resume-action">${t("resume.action")} ${icons.chevron}</span>`;
}

// La app controla el scroll: evita que el navegador lo restaure en posiciones raras.
history.scrollRestoration = "manual";

// Al abrir: idioma, tema y nombres de las pestañas; luego la primera pantalla.
async function start() {
  const profile = await getProfile();
  setLanguage(profile.lang);
  applyTheme(profile.theme);
  document.querySelector(".tabbar").setAttribute("aria-label", t("tab.nav"));
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.querySelector(".tab-label").textContent = t(`tab.${tab.dataset.tab}`);
  });
  window.addEventListener("hashchange", route);
  route();
  setupPWA();
}

start();

// Pestaña Entrenar: saludo, frase del día, avisos, siguiente entrenamiento, semana y plan.

import { getPlan, savePlan, getAllExercises, getWorkouts, getActiveWorkout, getProfile } from "../store.js";
import { weeklySummary } from "../stats.js";
import { quoteOfTheDay } from "../quotes.js";
import { downloadBackup, getLastBackup, getBackupSnooze, snoozeBackup } from "../backup.js";
import { getDeload, deloadAdvice, planAgeWeeks, startDeload, endDeload, snoozeDeload, isDeloadActive, afterDeload, dismissAfterDeload } from "../deload.js";
import { startWorkout } from "./session.js";
import { GOALS } from "../data/catalog.js";
import { esc, icons, pageHeader, toast, dayLabel, workoutDayLabel } from "../ui.js";
import { t, locale } from "../i18n.js";
import { getPeriods, activePeriod } from "../period.js";
import { periodButton, periodStartSheet, periodEndSheet } from "./period.js";

export async function renderHome(view) {
  const plan = await getPlan();
  const profile = await getProfile();
  const workouts = await getWorkouts();
  const summary = weeklySummary(workouts, plan?.daysPerWeek);
  const periods = profile.trackPeriod ? await getPeriods() : [];
  const period = activePeriod(periods);

  const greeting = `
    ${pageHeader({
      eyebrow: formatToday(),
      title: profile.name ? t("home.helloName", { name: esc(profile.name) }) : t("home.hello"),
      action: profile.trackPeriod ? periodButton(period) : "",
    })}
    ${profile.name ? "" : `<a class="streak-link name-link" href="#/perfil">${t("home.addName")}</a>`}`;

  const quote = profile.hideQuote
    ? ""
    : `
    <section class="card quote-card">
      <p class="quote-label">${t("home.today")}</p>
      <p class="quote-text">${esc(quoteOfTheDay(workouts, summary, plan?.daysPerWeek, Boolean(period)))}</p>
    </section>`;

  if (!plan) {
    view.innerHTML = `
      ${greeting}
      ${quote}
      <section class="card hero-empty">
        <h2>${t("home.emptyTitle")}</h2>
        <p>${t("home.emptyText")}</p>
        <a class="btn btn-primary" href="#/plan/nuevo">${t("home.createPlan")}</a>
      </section>
    `;
    view.onclick = (event) => periodAction(event, () => renderHome(view));
    return;
  }

  const exercises = await getAllExercises();
  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || t("common.deletedExercise");
  const nextIndex = plan.nextDay % plan.days.length;
  const next = plan.days[nextIndex];
  const done = summary.weeks.at(-1).count;
  const goal = plan.daysPerWeek;
  const streakText = summary.current
    ? t("home.streak", { n: summary.current })
    : done >= goal ? t("home.weekDone") : t("home.seeWeeks");
  const active = await getActiveWorkout();
  const deload = await getDeload();

  const nextCard = active
    ? (() => {
        const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
        const completed = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
        return `
        <h2 class="section-title">${t("home.inProgress")}</h2>
        <section class="card next-card">
          <p class="eyebrow">${active.extra ? t("core.extraTag") : t("common.dayN", { n: active.dayIndex + 1 })}</p>
          <h3>${esc(workoutDayLabel(active))}</h3>
          <p class="muted">${t("home.setsDone", { done: completed, total })}</p>
          <a class="btn btn-primary" href="#/entrenando">${t("home.continue")}</a>
        </section>`;
      })()
    : `
        <h2 class="section-title">${t("home.next")}</h2>
        <section class="card next-card">
          <p class="eyebrow">${t("common.dayN", { n: nextIndex + 1 })}${isDeloadActive(deload) ? ` · ${t("deload.tag")}` : ""}</p>
          <h3>${esc(dayLabel(next))}</h3>
          <p class="muted">${next.items.slice(0, 3).map((i) => esc(nameOf(i.exerciseId))).join(" · ")}${next.items.length > 3 ? ` ${t("home.andMore", { n: next.items.length - 3 })}` : ""}</p>
          <div class="btn-row">
            <a class="btn btn-secondary" href="#/dia/${nextIndex}">${t("home.seeRoutine")}</a>
            <button class="btn btn-primary" data-action="start">${t("home.start")}</button>
          </div>
        </section>`;

  view.innerHTML = `
    ${greeting}
    ${quote}
    ${nextCard}
    ${notices(plan, deload, workouts, periods)}

    <h2 class="section-title">${t("home.thisWeek")}</h2>
    <section class="card week-card">
      ${ring(done, goal)}
      <div class="week-text">
        <h2>${t("home.weekCount", { done, goal })}</h2>
        <p>${t("home.weekCountLabel")}</p>
        <a class="streak-link" href="#/perfil">${streakText}</a>
      </div>
    </section>

    ${await backupReminder(workouts)}

    <h2 class="section-title">${t("home.plan", { n: plan.days.length, goal: GOALS[plan.goal].label })}</h2>
    <div class="list">
      ${plan.days
        .map(
          (day, i) => `
        <a class="list-row" href="#/dia/${i}">
          <span class="day-number">${i + 1}</span>
          <span class="list-row-text">
            <strong>${esc(dayLabel(day))}</strong>
            <small>${t("home.dayMeta", { n: day.items.length, minutes: plan.minutes })}${day.superset ? ` · ${t("superset.title")}` : ""}</small>
          </span>
          ${icons.chevron}
        </a>`
        )
        .join("")}
      <a class="list-row" href="#/core">
        <span class="day-number day-extra" aria-hidden="true">+</span>
        <span class="list-row-text">
          <strong>${t("core.title")}</strong>
          <small>${t("core.rowHint")}</small>
        </span>
        ${icons.chevron}
      </a>
    </div>

    <a class="btn btn-secondary btn-outline btn-spaced" href="#/plan/nuevo">${t("home.adjustPlan")}</a>
  `;

  view.onclick = async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const refresh = () => renderHome(view);
    if (periodAction(event, refresh)) return;
    if (action === "start") startWorkout(plan, nextIndex);
    else if (action === "backup-now") {
      try {
        if (await downloadBackup()) {
          toast(t("backup.ready"));
          refresh();
        }
      } catch {
        toast(t("backup.exportErrorHome"));
      }
    } else if (action === "backup-later") {
      await snoozeBackup(7);
      refresh();
    } else if (action === "deload-start") {
      await startDeload();
      toast(t("deload.started"));
      refresh();
    } else if (action === "deload-later") {
      await snoozeDeload(14);
      refresh();
    } else if (action === "deload-end") {
      // Al terminar la descarga se arranca el cuestionario para un plan nuevo.
      await endDeload();
      toast(t("deload.ended"));
      location.hash = "#/plan/nuevo";
    } else if (action === "after-deload-keep") {
      await dismissAfterDeload();
      refresh();
    } else if (action === "plan-keep") {
      plan.ageSnoozeUntil = new Date(Date.now() + 14 * 86400000).toISOString();
      await savePlan(plan);
      refresh();
    }
  };
}

// Botón del período junto al saludo. Devuelve true si el toque era suyo.
function periodAction(event, refresh) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "period-start") periodStartSheet(refresh);
  else if (action === "period-end") periodEndSheet(refresh);
  else return false;
  return true;
}

// ---------- Avisos: semana de descarga y plan con muchas semanas ----------

function notices(plan, deload, workouts, periods) {
  // Descarga en curso
  if (isDeloadActive(deload)) {
    const until = new Date(deload.until).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
    return `
      <section class="card notice-card notice-deload">
        <p class="notice-title">${t("deload.activeTitle")}</p>
        <p class="muted">${t("deload.activeText", { date: until })}</p>
        <button class="btn btn-secondary" data-action="deload-end">${t("deload.end")}</button>
      </section>`;
  }

  // La descarga terminó: invitar a un plan nuevo
  if (afterDeload(deload, plan)) {
    return `
      <section class="card notice-card">
        <p class="notice-title">${t("deload.doneTitle")}</p>
        <p class="muted">${t("deload.doneText")}</p>
        <div class="btn-row">
          <button class="btn btn-secondary" data-action="after-deload-keep">${t("planAge.keep")}</button>
          <a class="btn btn-primary" href="#/plan/nuevo">${t("planAge.new")}</a>
        </div>
      </section>`;
  }

  // Sugerencia de descarga
  const advice = deloadAdvice(workouts, plan, deload, periods);
  if (advice) {
    return `
      <section class="card notice-card">
        <p class="notice-title">${t("deload.adviceTitle")}</p>
        <p class="muted">${advice.reason === "stalled" ? t("deload.adviceStalled", { n: advice.stalled }) : t("deload.adviceCalendar", { n: advice.weeks })}</p>
        <div class="btn-row">
          <button class="btn btn-secondary" data-action="deload-later">${t("common.notNow")}</button>
          <button class="btn btn-primary" data-action="deload-start">${t("deload.start")}</button>
        </div>
      </section>`;
  }

  // Plan con 6 semanas o más
  const weeks = planAgeWeeks(plan);
  const snoozed = plan.ageSnoozeUntil && new Date(plan.ageSnoozeUntil) > new Date();
  if (weeks >= 6 && !snoozed) {
    return `
      <section class="card notice-card">
        <p class="notice-title">${t("planAge.title", { n: weeks })}</p>
        <p class="muted">${t("planAge.text")}</p>
        <div class="btn-row">
          <button class="btn btn-secondary" data-action="plan-keep">${t("planAge.keep")}</button>
          <a class="btn btn-primary" href="#/plan/nuevo">${t("planAge.new")}</a>
        </div>
      </section>`;
  }
  return "";
}

// Recordatorio de respaldo: si pasaron 30 días (o nunca) y entrenaste desde entonces.
async function backupReminder(workouts) {
  if (!workouts.length) return "";
  const last = await getLastBackup();
  const snooze = await getBackupSnooze();
  const old = !last || Date.now() - new Date(last) > 30 * 86400000;
  const newWorkouts = !last || workouts[0].finishedAt > last;
  if (!old || !newWorkouts || (snooze && new Date(snooze) > new Date())) return "";
  return `
    <section class="card reminder-card">
      <p class="reminder-title">${last ? t("backup.reminderOld") : t("backup.reminderNever")}</p>
      <p class="muted">${t("backup.reminderText")}</p>
      <div class="btn-row">
        <button class="btn btn-secondary" data-action="backup-later">${t("common.later")}</button>
        <button class="btn btn-primary" data-action="backup-now">${t("backup.now")}</button>
      </div>
    </section>`;
}

function ring(done, goal) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(done / goal, 1));
  return `
    <div class="ring" role="img" aria-label="${t("home.weekCount", { done, goal })}">
      <svg viewBox="0 0 96 96">
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--gradient-progress-start)" />
            <stop offset="1" style="stop-color: var(--gradient-progress-end)" />
          </linearGradient>
        </defs>
        <circle class="ring-track" cx="48" cy="48" r="${radius}" fill="none" stroke-width="8" />
        ${done > 0 ? `<circle class="ring-progress" cx="48" cy="48" r="${radius}" fill="none" stroke-width="8"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />` : ""}
      </svg>
      <span class="ring-label">${done}/${goal}</span>
    </div>
  `;
}

function formatToday() {
  const text = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Semana de descarga y antigüedad del plan.
//
// Descarga: una semana más suave (menos series y ~10% menos peso) para recuperarte.
// Se sugiere si varios ejercicios están estancados o tras 6 semanas entrenando
// desde la última descarga (o desde que creaste el plan). Siempre es opcional.

import { db } from "./db.js";
import { startOfWeek } from "./store.js";
import { isPeriodDate, todayISO } from "./period.js";

const DAY = 86400000;

// { until: fecha fin si está activa, lastEndedAt, snoozeUntil }
export async function getDeload() {
  const state = (await db.get("kv", "deload")) || {};
  // Si ya pasó la fecha de fin, se cierra sola.
  if (state.until && new Date(state.until) <= new Date()) {
    state.lastEndedAt = state.until;
    delete state.until;
    delete state.afterDismissed;
    await db.put("kv", state, "deload");
  }
  return state;
}

export const isDeloadActive = (state) => Boolean(state?.until && new Date(state.until) > new Date());

export async function startDeload() {
  const state = await getDeload();
  state.until = new Date(Date.now() + 7 * DAY).toISOString();
  delete state.snoozeUntil;
  await db.put("kv", state, "deload");
}

export async function endDeload() {
  const state = await getDeload();
  state.lastEndedAt = new Date().toISOString();
  delete state.until;
  delete state.afterDismissed;
  await db.put("kv", state, "deload");
}

/**
 * ¿Mostrar "terminó tu descarga, ¿plan nuevo?"? Sí si la descarga terminó hace
 * menos de 2 semanas, el plan es anterior a ella y no elegiste "Seguir con este".
 */
export function afterDeload(state, plan) {
  if (!state.lastEndedAt || state.afterDismissed || isDeloadActive(state)) return false;
  const ended = new Date(state.lastEndedAt);
  return Date.now() - ended < 14 * DAY && new Date(plan.createdAt || 0) < ended;
}

export async function dismissAfterDeload() {
  const state = await getDeload();
  state.afterDismissed = true;
  await db.put("kv", state, "deload");
}

export async function snoozeDeload(days) {
  const state = await getDeload();
  state.snoozeUntil = new Date(Date.now() + days * DAY).toISOString();
  await db.put("kv", state, "deload");
}

// Series durante la descarga: unas 40% menos, mínimo 2 (3 → 2, 4 → 2, 5 → 3).
export const deloadSets = (sets) => Math.max(2, Math.floor(sets * 0.6));

/**
 * ¿Conviene sugerir una descarga?
 * Devuelve null o { reason: "stalled", stalled: n } / { reason: "calendar", weeks: n }.
 */
export function deloadAdvice(workouts, plan, state, periods = []) {
  if (!plan || isDeloadActive(state)) return null;
  if (state.snoozeUntil && new Date(state.snoozeUntil) > new Date()) return null;

  const since = new Date(Math.max(new Date(plan.createdAt || 0), new Date(state.lastEndedAt || 0)));
  const regular = workouts.filter((w) => !w.deload && !w.extra && new Date(w.finishedAt) > since);

  // 1. Estancamiento: sin mejora en 3 sesiones seguidas, en 3 ejercicios o más.
  //    Las sesiones de días de período no cuentan (un día más ligero no es estancarse).
  const comparable = regular.filter((w) => !isPeriodDate(periods, todayISO(new Date(w.finishedAt))));
  const planIds = new Set(plan.days.flatMap((d) => d.items.map((i) => i.exerciseId)));
  let stalled = 0;
  for (const id of planIds) {
    const sessions = comparable
      .filter((w) => w.exercises.some((e) => e.exerciseId === id))
      .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
      .slice(-3)
      .map((w) => best(w.exercises.find((e) => e.exerciseId === id).sets));
    if (sessions.length === 3 && sessions[2] <= sessions[0]) stalled++;
  }
  if (stalled >= 3) return { reason: "stalled", stalled };

  // 2. Calendario: 6 semanas o más entrenando desde la referencia.
  const weeks = new Set(regular.map((w) => startOfWeek(new Date(w.finishedAt)).getTime())).size;
  if (weeks >= 6) return { reason: "calendar", weeks };

  return null;
}

// Mejor serie de una sesión, estimando la fuerza (fórmula de Epley).
// En ejercicios sin peso cuenta las repeticiones.
function best(sets) {
  return Math.max(...sets.map((s) => (s.weight > 0 ? s.weight * (1 + s.reps / 30) : s.reps)));
}

// Semanas desde que se creó el plan.
export const planAgeWeeks = (plan) => (plan?.createdAt ? Math.floor((Date.now() - new Date(plan.createdAt)) / (7 * DAY)) : 0);

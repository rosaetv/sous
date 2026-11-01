// Metas y logros. Todo se guarda solo en el teléfono.
//
// Metas (kv "goals"): [{ id, type, createdAt, achievedAt?, ...datos }]
//   type "strength":    { exerciseId, weight (kg), reps }   → una serie con ese peso o más y esas reps o más
//   type "consistency": { weeks }                            → semanas cumplidas seguidas
//   type "body":        { metric, target, start }            → llegar a esa medida (start = valor al crearla)
//   type "free":        { title }                            → la marcas tú
//
// Victorias (kv "victories"): [{ id, date, text, tag? }] — cosas que notas fuera de los números.
//
// Los logros automáticos (récords, hitos de racha y metas cumplidas) se calculan
// a partir de tus datos; no se guardan aparte.

import { db } from "./db.js";
import { weeklySummary } from "./stats.js";

const SAME = 0.01;

export const getGoals = async () => (await db.get("kv", "goals")) || [];
export const saveGoals = (list) => db.put("kv", list, "goals");
export const getVictories = async () => ((await db.get("kv", "victories")) || []).sort((a, b) => b.date.localeCompare(a.date));
export const saveVictories = (list) => db.put("kv", list, "victories");

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Avance de una meta: { ratio (0–1), current } según tus datos.
 * data: { workouts, measurements, summary }
 *   current: strength → mejor serie { weight, reps } que cuenta; consistency → semanas;
 *            body → último valor; free → null
 */
export function goalProgress(goal, data) {
  if (goal.achievedAt) return { ratio: 1, current: null };
  if (goal.type === "strength") {
    const sets = data.workouts.filter((w) => !w.extra).flatMap((w) => w.exercises.filter((e) => e.exerciseId === goal.exerciseId).flatMap((e) => e.sets));
    // Sin peso: cuenta tu máximo de repeticiones.
    if (goal.weight <= SAME) {
      const best = sets.reduce((b, s) => (!b || s.reps > b.reps ? s : b), null);
      return { ratio: best ? Math.min(best.reps / goal.reps, 1) : 0, current: best };
    }
    // Con peso: el mayor peso con al menos las repeticiones de la meta.
    const best = sets.filter((s) => s.reps >= goal.reps).reduce((b, s) => (!b || s.weight > b.weight ? s : b), null);
    return { ratio: best ? Math.min(best.weight / goal.weight, 1) : 0, current: best };
  }
  if (goal.type === "consistency") {
    const current = data.summary.current;
    return { ratio: Math.min(current / goal.weeks, 1), current };
  }
  if (goal.type === "body") {
    const latest = data.measurements.filter((m) => m.values[goal.metric] != null).at(-1);
    const value = latest ? latest.values[goal.metric] : goal.start;
    if (value == null || goal.start == null || goal.start === goal.target) return { ratio: value === goal.target ? 1 : 0, current: value };
    const ratio = (value - goal.start) / (goal.target - goal.start);
    return { ratio: Math.max(0, Math.min(ratio, 1)), current: value };
  }
  return { ratio: 0, current: null };
}

// ¿Se cumplió? (las libres solo se cumplen a mano)
export function isReached(goal, data) {
  if (goal.type === "free") return false;
  if (goal.type === "strength") {
    const best = goalProgress(goal, data).current;
    return Boolean(best && best.weight >= goal.weight - SAME && best.reps >= goal.reps);
  }
  if (goal.type === "body") {
    const { current } = goalProgress(goal, data);
    if (current == null) return false;
    return goal.target < goal.start ? current <= goal.target + SAME : current >= goal.target - SAME;
  }
  return goalProgress(goal, data).ratio >= 1;
}

/**
 * Revisa las metas activas y marca como cumplidas las que ya se lograron.
 * Devuelve las recién cumplidas (para celebrarlas en ese momento).
 * data: { workouts, measurements, summary } — si falta algo, se lee de la base.
 */
export async function checkGoals(data = {}) {
  const goals = await getGoals();
  const active = goals.filter((g) => !g.achievedAt);
  if (!active.length) return [];
  const workouts = data.workouts || (await db.getAll("workouts"));
  const full = {
    workouts,
    measurements: data.measurements || (await db.getAll("measurements")).sort((a, b) => a.date.localeCompare(b.date)),
    summary: data.summary || weeklySummary(workouts, (await db.get("kv", "plan"))?.daysPerWeek),
  };
  const reached = active.filter((g) => isReached(g, full));
  if (!reached.length) return [];
  const now = new Date().toISOString();
  for (const g of reached) g.achievedAt = now;
  await saveGoals(goals);
  return reached;
}

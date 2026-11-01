// Semanas cumplidas: una semana (lunes a domingo) cuenta si entrenaste los días de tu meta.

import { startOfWeek } from "./store.js";

/**
 * workouts: entrenamientos terminados (cualquier orden)
 * currentGoal: días por semana del plan actual (para la semana en curso)
 * Devuelve { weeks: [{ start, count, goal, done, current }], current, best }
 */
export function weeklySummary(workouts, currentGoal) {
  // Los extras (Core DIY) se ven en el historial pero no cuentan para la meta.
  workouts = workouts.filter((w) => !w.extra);
  const thisWeek = startOfWeek().getTime();
  if (!workouts.length) {
    return { weeks: [{ start: new Date(thisWeek), count: 0, goal: currentGoal, done: false, current: true }], current: 0, best: 0 };
  }

  const sorted = [...workouts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const byWeek = new Map();
  for (const w of sorted) {
    const key = startOfWeek(new Date(w.finishedAt)).getTime();
    const entry = byWeek.get(key) || { count: 0, goal: w.goalPerWeek };
    entry.count++;
    // La meta de esa semana es la que tenías en tu último entrenamiento de la semana.
    if (w.goalPerWeek) entry.goal = w.goalPerWeek;
    byWeek.set(key, entry);
  }

  const weeks = [];
  let goal = sorted[0].goalPerWeek || currentGoal || 3;
  const cursor = startOfWeek(new Date(sorted[0].finishedAt));
  while (cursor.getTime() <= thisWeek) {
    const key = cursor.getTime();
    const entry = byWeek.get(key);
    if (entry?.goal) goal = entry.goal;
    const current = key === thisWeek;
    const weekGoal = current && currentGoal ? currentGoal : goal;
    const count = entry?.count || 0;
    weeks.push({ start: new Date(key), count, goal: weekGoal, done: count >= weekGoal, current });
    cursor.setDate(cursor.getDate() + 7);
  }

  // Racha actual: semanas cumplidas seguidas hasta hoy. La semana en curso no la rompe.
  let current = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].current && !weeks[i].done) continue;
    if (!weeks[i].done) break;
    current++;
  }

  let best = 0;
  let run = 0;
  for (const w of weeks) {
    if (w.done) best = Math.max(best, ++run);
    else if (!w.current) run = 0;
  }

  return { weeks, current, best };
}

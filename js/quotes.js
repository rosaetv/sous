// Elige la frase del día según tu contexto. Cambia una vez al día y
// recorre todas las frases de cada grupo antes de repetir.

import { QUOTES_ES } from "./data/quotes.js";
import { QUOTES_EN } from "./data/quotes-en.js";
import { startOfWeek } from "./store.js";
import { lang } from "./i18n.js";

/**
 * workouts: entrenamientos terminados (del más reciente al más antiguo)
 * summary: resultado de weeklySummary()
 * goal: días por semana del plan
 * onPeriod: true si hay un período en curso (frases más suaves)
 */
export function quoteOfTheDay(workouts, summary, goal, onPeriod = false) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = Math.floor((today - new Date(2026, 0, 1)) / 86400000);
  const last = workouts[0] ? new Date(workouts[0].finishedAt) : null;
  const thisWeek = summary.weeks.at(-1);

  let group = "general";
  if (last && last >= today) group = "today";
  else if (onPeriod) group = "period";
  else if (last && today - last >= 10 * 86400000) group = "comeback";
  else if (goal && thisWeek.count >= goal && last >= startOfWeek()) group = "weekDone";
  else if (goal && goal - thisWeek.count === 1) group = "oneLeft";
  else if (summary.current >= 2 && day % 3 === 0) group = "streak";

  const list = (lang() === "en" ? QUOTES_EN : QUOTES_ES)[group];
  return list[((day % list.length) + list.length) % list.length].replace("{n}", summary.current);
}

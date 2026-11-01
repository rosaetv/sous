// Genera el plan semanal y calcula alternativas de ejercicios.

import { DAY_TEMPLATES, SPLITS, EXERCISES_PER_SESSION, PRESCRIPTIONS, MUSCLE_GROUPS } from "./data/catalog.js";
import { CARE_ZONES, FOCUS_PATTERNS, SAFE_SWAPS } from "./data/care.js";
import { WEEKLY_COVERAGE, REGIONS } from "./data/coverage.js";
import { isCompound } from "./store.js";
import { t } from "./i18n.js";

/**
 * options: { daysPerWeek, minutes, goal, level, focus, care, excludedEquipment, favorites }
 *   level: "principiante" | "intermedio" | "avanzado"
 *   focus: zonas a priorizar (claves de MUSCLE_GROUPS, máx. 2)
 *   care: zonas a cuidar (claves de CARE_ZONES)
 */
export function generatePlan(options, exercises) {
  const { daysPerWeek, minutes, goal } = options;
  options = { level: "intermedio", focus: [], care: [], ...options };
  const split = SPLITS[daysPerWeek];
  const usedInPlan = new Set();
  const seen = {};

  const days = split.map((key) => {
    const template = DAY_TEMPLATES[key];
    seen[key] = (seen[key] || 0) + 1;
    const repeated = split.filter((k) => k === key).length > 1;
    const suffix = repeated ? (seen[key] === 1 ? "A" : "B") : "";
    // Se guarda el tipo de día (template) para mostrar el nombre en el idioma actual.
    const name = suffix ? `${template.name} ${suffix}` : template.name;

    const count = EXERCISES_PER_SESSION[goal][minutes];
    const usedInDay = new Set();
    const items = [];

    // Zonas a priorizar: si el día ya trabaja esa zona, suma un hueco extra
    // justo después de los dos ejercicios principales.
    const slots = [...template.slots];
    const dayPatterns = new Set(template.slots.flat());
    for (const group of options.focus) {
      const extra = (FOCUS_PATTERNS[group] || []).filter((p) => dayPatterns.has(p));
      if (extra.length) slots.splice(2, 0, extra);
    }

    // Segunda vuelta: si falta equipo y quedan huecos, repite tipos de movimiento.
    for (let pass = 0; pass < 2; pass++) {
      for (const patterns of slots) {
        if (items.length >= count) break;
        let exercise = pickExercise(patterns, exercises, options, usedInDay, usedInPlan, items.length);
        if (!exercise) continue;
        // Si carga una zona a cuidar y no había otra opción del mismo tipo, se busca un equivalente.
        if (stressesCare(exercise, options.care) && SAFE_SWAPS[exercise.pattern]) {
          const safe = (e) => !stressesCare(e, options.care);
          exercise = pickExercise(SAFE_SWAPS[exercise.pattern], exercises, options, usedInDay, usedInPlan, items.length, safe) || exercise;
        }
        usedInDay.add(exercise.id);
        usedInPlan.add(exercise.id);
        items.push(makeItem(exercise, goal, items.length, options));
      }
    }
    return { template: key, suffix, name, items };
  });

  ensureWeeklyCoverage(days, exercises, options, usedInPlan);
  addFinishers(days, exercises, options, usedInPlan);

  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    daysPerWeek,
    minutes,
    goal,
    level: options.level,
    focus: options.focus,
    care: options.care,
    excludedEquipment: options.excludedEquipment,
    days,
    nextDay: 0,
  };
}

/**
 * Cobertura semanal (ver js/data/coverage.js): si un músculo queda desatendido,
 * cambia el ejercicio menos importante de un día de esa zona por uno que lo trabaje.
 * Nunca toca los 2 ejercicios principales del día, y solo acepta el cambio si no
 * deja sin cubrir otro músculo. Las zonas a priorizar solo ceden un ejercicio si
 * ese movimiento se repite en la semana.
 */
function ensureWeeklyCoverage(days, exercises, options, usedInPlan) {
  const byId = (id) => exercises.find((e) => e.id === id);
  const focusPatterns = new Set(options.focus.flatMap((g) => FOCUS_PATTERNS[g] || []));
  const changes = new Map(); // día → cuántos cambios lleva (para repartir)

  const coverage = () => {
    const count = {};
    for (const day of days)
      for (const item of day.items) {
        const ex = byId(item.exerciseId);
        if (!ex) continue;
        for (const m of ex.primary) (count[m] ||= { primary: 0, secondary: 0 }).primary++;
        for (const m of ex.secondary) (count[m] ||= { primary: 0, secondary: 0 }).secondary++;
      }
    return count;
  };
  const isCovered = (req, count) => {
    const c = count[req.muscle] || { primary: 0, secondary: 0 };
    return c.primary >= 1 || (!req.direct && c.secondary >= 2);
  };
  const weekCount = (pattern) => days.reduce((n, d) => n + d.items.filter((i) => byId(i.exerciseId)?.pattern === pattern).length, 0);

  for (const req of WEEKLY_COVERAGE) {
    for (let attempt = 0; attempt < 2 && !isCovered(req, coverage()); attempt++) {
      const before = coverage();
      const alreadyCovered = WEEKLY_COVERAGE.filter((r) => r !== req && isCovered(r, before));
      // Ejercicios que trabajan el músculo (como principal; si no hay ninguno, como secundario).
      const hasPrimary = exercises.some((e) => e.primary.includes(req.muscle));
      const works = (e) => (hasPrimary ? e.primary.includes(req.muscle) : e.secondary.includes(req.muscle));
      const regionPatterns = REGIONS[req.region];

      const candidates = days
        .map((day, index) => ({ day, index }))
        .filter(({ day }) => !regionPatterns || DAY_TEMPLATES[day.template].slots.flat().some((p) => regionPatterns.includes(p)))
        .sort((a, b) => (changes.get(a.index) || 0) - (changes.get(b.index) || 0));

      const placed = [false, true].some((relaxed) =>
        candidates.some(({ day, index }) => {
          const usedInDay = new Set(day.items.map((i) => i.exerciseId));
          const exercise =
            pickExercise(req.patterns, exercises, options, usedInDay, usedInPlan, 2, works) ||
            pickExercise([...new Set(exercises.filter(works).map((e) => e.pattern))], exercises, options, usedInDay, usedInPlan, 2, works);
          if (!exercise) return false;

          for (let slot = day.items.length - 1; slot >= 2; slot--) {
            const current = byId(day.items[slot].exerciseId);
            if (!current) continue;
            if (focusPatterns.has(current.pattern) && !(relaxed && weekCount(current.pattern) > 1)) continue;
            // Probar el cambio y aceptarlo solo si no descubre otro músculo.
            const previous = day.items[slot];
            day.items[slot] = makeItem(exercise, options.goal, slot, options);
            const after = coverage();
            if (alreadyCovered.every((r) => isCovered(r, after))) {
              usedInPlan.add(exercise.id);
              changes.set(index, (changes.get(index) || 0) + 1);
              return true;
            }
            day.items[slot] = previous;
          }
          return false;
        })
      );
      if (!placed) break; // No hay espacio (sesiones muy cortas): se deja como está.
    }
  }
}

// Core para la postura que se puede hacer en casa, sin equipo.
const HOME_CORE = new Set(["plancha", "plancha-lateral", "dead-bug", "bird-dog", "superman", "plancha-alterna"]);

/**
 * Cierre de cada día: ejercicios cortos (2 series) al final, que también se
 * pueden hacer en casa.
 *   - Core para la postura, si el día no trae ya un ejercicio de core.
 *   - Tobillo, si marcaste Tobillos en las zonas a cuidar (va rotando entre días).
 */
function addFinishers(days, exercises, options, usedInPlan) {
  const add = (day, patterns, preferred) => {
    const usedInDay = new Set(day.items.map((i) => i.exerciseId));
    const exercise =
      pickExercise(patterns, exercises, options, usedInDay, usedInPlan, 9, preferred) ||
      pickExercise(patterns, exercises, options, usedInDay, usedInPlan, 9);
    if (!exercise) return;
    usedInPlan.add(exercise.id);
    day.items.push({ ...makeItem(exercise, options.goal, 9, options), sets: 2, finisher: true });
  };
  const byId = (id) => exercises.find((e) => e.id === id);
  for (const day of days) {
    if (!day.items.some((i) => byId(i.exerciseId)?.pattern === "core")) add(day, ["core"], (e) => HOME_CORE.has(e.id));
    if (options.care?.includes("tobillos")) add(day, ["ankle"]);
  }
}

export function pickExercise(patterns, exercises, options, usedInDay, usedInPlan, position, filter = null) {
  const { excludedEquipment, favorites, goal, level, care } = options;
  const focusMuscles = focusMuscleSet(options.focus);
  let best = null;
  let bestScore = -Infinity;

  for (const exercise of exercises) {
    const patternRank = patterns.indexOf(exercise.pattern);
    if (patternRank === -1) continue;
    if (excludedEquipment.includes(exercise.equipment)) continue;
    if (usedInDay.has(exercise.id)) continue;
    if (filter && !filter(exercise)) continue;

    let score = Math.random() * 2 - patternRank * 3;
    if (favorites.exercises.includes(exercise.id)) score += 10;
    if (favorites.disliked?.includes(exercise.id)) score -= 15; // casi nunca, salvo que no haya otra opción
    if (favorites.equipment.includes(exercise.equipment)) score += 4;
    if (usedInPlan.has(exercise.id)) score -= 6;
    // Técnicos: casi nunca para principiantes, sin castigo para avanzados.
    if (exercise.advanced) score -= level === "principiante" ? 10 : level === "avanzado" ? 0 : 3;
    // Zonas a cuidar: casi nunca, salvo que no haya otra opción.
    if (stressesCare(exercise, care)) score -= 12;
    // Zonas a priorizar: un empujón a los ejercicios que las trabajan.
    if (exercise.primary.some((m) => focusMuscles.has(m))) score += 2;
    if (goal === "fuerza" && position < 2 && ["barra", "smith"].includes(exercise.equipment)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = exercise;
    }
  }
  return best;
}

/**
 * Series, repeticiones y descanso de un ejercicio según su posición en la rutina.
 * profile (opcional): { level, focus } del plan para ajustar las series.
 */
export function makeItem(exercise, goal, position, profile = {}) {
  const table = PRESCRIPTIONS[goal];
  let kind = "isolation";
  if (exercise.timed) kind = "timed";
  else if (isCompound(exercise)) kind = position < 2 ? "main" : "compound";
  const item = { exerciseId: exercise.id, ...table[kind] };

  // Nivel: principiantes hasta 3 series; avanzados, una más en los principales.
  if (profile.level === "principiante") item.sets = Math.min(item.sets, 3);
  if (profile.level === "avanzado" && kind === "main") item.sets += 1;
  // Zona a priorizar: una serie más (máximo 5).
  const focusMuscles = focusMuscleSet(profile.focus);
  if (exercise.primary.some((m) => focusMuscles.has(m))) item.sets = Math.min(item.sets + 1, 5);
  return item;
}

const focusMuscleSet = (focus = []) => new Set(focus.flatMap((g) => MUSCLE_GROUPS[g] || []));

// ¿El ejercicio carga alguna de las zonas a cuidar? Devuelve la primera zona o null.
export function stressesCare(exercise, care = []) {
  return care.find((zone) => CARE_ZONES[zone]?.includes(exercise.id)) || null;
}

/**
 * Ejercicios que trabajan lo mismo, ordenados de más a menos parecido.
 * Devuelve [{ exercise, reason }].
 */
export function findAlternatives(target, exercises, excludedEquipment = []) {
  return exercises
    .filter((e) => e.id !== target.id && !excludedEquipment.includes(e.equipment))
    .map((e) => {
      const samePattern = e.pattern === target.pattern && target.pattern !== "other";
      const sharedPrimary = e.primary.filter((m) => target.primary.includes(m)).length;
      const sharedSecondary = e.secondary.filter((m) => target.secondary.includes(m) || target.primary.includes(m)).length;
      const score = (samePattern ? 10 : 0) + sharedPrimary * 3 + sharedSecondary;
      const reason = samePattern ? t("alt.samePattern") : t("alt.sameMuscles");
      return { exercise: e, score, reason, sharedPrimary, samePattern };
    })
    .filter((a) => a.samePattern || a.sharedPrimary > 0)
    .sort((a, b) => b.score - a.score);
}

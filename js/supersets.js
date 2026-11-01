// Superseries: dos ejercicios de zonas distintas seguidos, con un solo descanso.
// Se activan por día. Con el tiempo que se ahorra caben ejercicios extra, que
// se agregan solo si los aceptas y se quitan al apagar las superseries.
//
// En el plan, cada día con superseries guarda:
//   day.superset = true
//   day.originalOrder = [ids en el orden de antes] (para volver a él al apagar)
//   item.group = "A", "B"... en los ejercicios emparejados
//   item.extra = true en los ejercicios agregados por las superseries

import { EXERCISES_PER_SESSION, DAY_TEMPLATES } from "./data/catalog.js";
import { WEEKLY_COVERAGE, REGIONS } from "./data/coverage.js";
import { pickExercise, makeItem } from "./generator.js";
import { isCompound } from "./store.js";

// Los principales pesados van solos: necesitan su descanso completo.
const SOLO_PATTERNS = new Set(["squat", "hinge"]);

// Parejas que se complementan (uno descansa mientras trabaja el otro).
const ANTAGONISTS = [
  ["h_push", "h_pull"],
  ["v_push", "v_pull"],
  ["biceps", "triceps"],
  ["knee_ext", "knee_flex"],
  ["fly", "rear_delt"],
  ["abduction", "adduction"],
];

const MAX_EXTRAS = 3;

const regionOf = (pattern) => Object.entries(REGIONS).find(([, list]) => list?.includes(pattern))?.[0] || "core";

function staysSolo(exercise, index) {
  return index < 2 && exercise && isCompound(exercise) && SOLO_PATTERNS.has(exercise.pattern);
}

// Qué tan buena es una pareja. -Infinity si comparten músculo principal.
function pairScore(a, b) {
  if (!a || !b) return -Infinity;
  if (a.primary.some((m) => b.primary.includes(m))) return -Infinity;
  const antagonist = ANTAGONISTS.some(([x, y]) => (a.pattern === x && b.pattern === y) || (a.pattern === y && b.pattern === x));
  if (antagonist) return 5;
  return regionOf(a.pattern) !== regionOf(b.pattern) ? 3 : 1;
}

/**
 * Arma las parejas del día. Los principales pesados y lo que no encuentre
 * pareja quedan solos; todo mantiene el orden original del día.
 */
export function applyPairs(day, byId) {
  for (const item of day.items) delete item.group;
  const solo = [];
  const pool = [];
  const finishers = []; // el cierre (core y tobillo) se empareja entre sí y queda al final
  day.items.forEach((item, i) => (item.finisher ? finishers : staysSolo(byId(item.exerciseId), i) ? solo : pool).push(item));

  // Prueba todas las formas de emparejar (son pocos ejercicios) y se queda con la
  // que forma más parejas y, entre esas, la de mejores combinaciones.
  const score = (a, b) => pairScore(byId(a.exerciseId), byId(b.exerciseId));
  const best = (rest) => {
    if (rest.length < 2) return { pairs: [], leftover: rest, value: 0 };
    const [first, ...others] = rest;
    let result = best(others);
    result = { ...result, leftover: [first, ...result.leftover] };
    others.forEach((other, i) => {
      const s = score(first, other);
      if (s === -Infinity) return;
      const sub = best(others.filter((_, j) => j !== i));
      const value = sub.value + 100 + s; // cada pareja vale más que cualquier diferencia de calidad
      if (value > result.value) result = { pairs: [[first, other], ...sub.pairs], leftover: sub.leftover, value };
    });
    return result;
  };
  const { pairs, leftover } = best(pool);
  const closing = best(finishers);

  // Cada bloque (solo o pareja) va donde estaba su primer ejercicio; el cierre, al final.
  const position = (item) => day.items.indexOf(item);
  const byPosition = (a, b) => Math.min(...a.map(position)) - Math.min(...b.map(position));
  const ordered = [
    ...[...solo.map((i) => [i]), ...leftover.map((i) => [i]), ...pairs].sort(byPosition),
    ...[...closing.leftover.map((i) => [i]), ...closing.pairs].sort(byPosition),
  ];
  ordered
    .filter((block) => block.length === 2)
    .forEach((pair, i) => pair.forEach((item) => (item.group = String.fromCharCode(65 + i))));
  day.items = ordered.flat();
}

/**
 * Ejercicios extra que caben con superseries: para los músculos que menos
 * trabaja tu plan (brazos y zonas pequeñas primero), sin repetir los del día.
 * options: { excludedEquipment, favorites, goal, level, care, focus }
 */
export function proposeExtras(plan, dayIndex, exercises, favorites) {
  const day = plan.days[dayIndex];
  const byId = (id) => exercises.find((e) => e.id === id);
  const count = Math.min(MAX_EXTRAS, Math.round((EXERCISES_PER_SESSION[plan.goal]?.[plan.minutes] || 4) / 2));

  // Músculos que el día puede recibir según su tipo (el core siempre).
  const dayPatterns = DAY_TEMPLATES[day.template]?.slots.flat() || [];
  const fits = (region) => region === "core" || !REGIONS[region] || dayPatterns.some((p) => REGIONS[region].includes(p));

  // Cuántas veces es músculo principal en todo el plan.
  const worked = {};
  for (const d of plan.days)
    for (const item of d.items) for (const m of byId(item.exerciseId)?.primary || []) worked[m] = (worked[m] || 0) + 1;

  const options = {
    excludedEquipment: plan.excludedEquipment || [],
    favorites,
    goal: plan.goal,
    level: plan.level || "intermedio",
    care: plan.care || [],
    focus: plan.focus || [],
  };
  const usedInDay = new Set(day.items.map((i) => i.exerciseId));
  const usedInPlan = new Set(plan.days.flatMap((d) => d.items.map((i) => i.exerciseId)));
  const requirements = WEEKLY_COVERAGE.filter((r) => fits(r.region))
    .map((r, order) => ({ ...r, order }))
    .sort((a, b) => (worked[a.muscle] || 0) - (worked[b.muscle] || 0) || a.order - b.order);

  const extras = [];
  for (const req of requirements) {
    if (extras.length >= count) break;
    if (extras.some((e) => e.primary.includes(req.muscle))) continue;
    // Nunca los que marcaste con "no me gusta".
    const works = (e) => e.primary.includes(req.muscle) && !isCompound(e) && !favorites.disliked?.includes(e.id);
    const exercise =
      pickExercise(req.patterns, exercises, options, usedInDay, usedInPlan, 3, works) ||
      pickExercise([...new Set(exercises.filter(works).map((e) => e.pattern))], exercises, options, usedInDay, usedInPlan, 3, works);
    if (!exercise) continue;
    usedInDay.add(exercise.id);
    extras.push(exercise);
  }
  return extras;
}

export function enableSupersets(plan, dayIndex, extras, exercises) {
  const day = plan.days[dayIndex];
  const byId = (id) => exercises.find((e) => e.id === id);
  day.originalOrder = day.items.map((i) => i.exerciseId);
  for (const exercise of extras) day.items.push({ ...makeItem(exercise, plan.goal, day.items.length, plan), extra: true });
  day.superset = true;
  applyPairs(day, byId);
}

export function disableSupersets(plan, dayIndex) {
  const day = plan.days[dayIndex];
  const order = day.originalOrder || [];
  const position = (item) => (order.includes(item.exerciseId) ? order.indexOf(item.exerciseId) : order.length);
  day.items = day.items.filter((i) => !i.extra).sort((a, b) => position(a) - position(b));
  for (const item of day.items) delete item.group;
  delete day.superset;
  delete day.originalOrder;
}

// Descanso de una pareja: el mayor de los dos.
export const pairRest = (items) => Math.max(...items.map((i) => i.rest || 0));

/**
 * Agrupa una lista (items del plan o ejercicios del entrenamiento) en bloques:
 * [{ group: "A" | null, entries: [{ item, index }] }].
 */
export function blocks(items) {
  const result = [];
  items.forEach((item, index) => {
    const last = result.at(-1);
    if (item.group && last?.group === item.group) last.entries.push({ item, index });
    else result.push({ group: item.group || null, entries: [{ item, index }] });
  });
  return result;
}

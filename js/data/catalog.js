// Listas fijas de la app: músculos, equipo, tipos de movimiento y reglas del generador.

import { t } from "../i18n.js";

// Los nombres que ves vienen del diccionario de idiomas (js/i18n): "muscle.pecho", etc.
// Cada lista se lee en el idioma actual cada vez que se usa.
function labeled(prefix, keys) {
  const object = {};
  for (const key of keys) Object.defineProperty(object, key, { get: () => t(`${prefix}.${key}`), enumerable: true });
  return object;
}

export const MUSCLES = labeled("muscle", [
  "pecho", "dorsales", "espalda_media", "trapecio", "lumbares",
  "hombro_frontal", "hombro_lateral", "hombro_posterior",
  "biceps", "triceps", "antebrazo", "abdomen", "oblicuos",
  "gluteos", "gluteo_medio", "cuadriceps", "isquios", "aductores", "pantorrillas", "tibial",
]);

// Grupos para los filtros de la biblioteca (el nombre es "group.<clave>").
export const MUSCLE_GROUPS = {
  chest: ["pecho"],
  back: ["dorsales", "espalda_media", "trapecio", "lumbares"],
  shoulders: ["hombro_frontal", "hombro_lateral", "hombro_posterior"],
  arms: ["biceps", "triceps", "antebrazo"],
  legs: ["cuadriceps", "isquios", "aductores", "pantorrillas"],
  glutes: ["gluteos", "gluteo_medio"],
  core: ["abdomen", "oblicuos"],
};

export const EQUIPMENT = labeled("equipment", [
  "barra", "mancuernas", "maquina", "polea", "smith", "kettlebell", "banda", "peso_corporal",
]);

export const PATTERNS = labeled("pattern", [
  "squat", "hinge", "lunge", "knee_ext", "knee_flex", "hip_thrust", "abduction", "adduction", "calf",
  "h_push", "fly", "v_push", "lateral", "rear_delt", "h_pull", "v_pull", "biceps", "triceps", "core", "ankle", "other",
]);

// Movimientos que usan varias articulaciones a la vez: van primero en la rutina.
export const COMPOUND_PATTERNS = new Set([
  "squat", "hinge", "lunge", "hip_thrust", "h_push", "v_push", "h_pull", "v_pull",
]);

export const GOALS = {};
for (const key of ["hipertrofia", "fuerza", "resistencia"]) {
  Object.defineProperty(GOALS, key, {
    get: () => ({ label: t(`goal.${key}.label`), short: t(`goal.${key}.short`), info: t(`goal.${key}.info`) }),
    enumerable: true,
  });
}

export const SESSION_MINUTES = [30, 45, 60, 75];

// Cuántos ejercicios caben en una sesión según objetivo y minutos.
export const EXERCISES_PER_SESSION = {
  hipertrofia: { 30: 4, 45: 5, 60: 6, 75: 7 },
  fuerza: { 30: 3, 45: 4, 60: 5, 75: 6 },
  resistencia: { 30: 5, 45: 6, 60: 7, 75: 8 },
};

// Plantillas de día. Cada "hueco" acepta uno o más tipos de movimiento,
// en orden de preferencia. Se usan tantos huecos como quepan en el tiempo.
export const DAY_TEMPLATES = {
  fullA: { get name() { return t("day.fullA"); }, slots: [["squat"], ["h_push"], ["h_pull"], ["hinge", "hip_thrust"], ["v_push"], ["lateral"], ["biceps"], ["triceps"], ["calf"]] },
  fullB: { get name() { return t("day.fullB"); }, slots: [["hinge"], ["v_pull"], ["h_push"], ["lunge", "squat"], ["h_pull"], ["rear_delt"], ["triceps"], ["biceps"], ["core"]] },
  fullC: { get name() { return t("day.fullC"); }, slots: [["squat", "lunge"], ["v_push"], ["v_pull"], ["hip_thrust"], ["h_push"], ["knee_flex"], ["lateral"], ["biceps"], ["core"]] },
  upperA: { get name() { return t("day.upperA"); }, slots: [["h_push"], ["v_pull"], ["v_push"], ["h_pull"], ["lateral"], ["triceps"], ["biceps"], ["fly"], ["rear_delt"]] },
  upperB: { get name() { return t("day.upperB"); }, slots: [["v_pull"], ["h_push"], ["h_pull"], ["v_push"], ["fly"], ["biceps"], ["triceps"], ["rear_delt"], ["lateral"]] },
  lowerA: { get name() { return t("day.lowerA"); }, slots: [["squat"], ["hinge"], ["lunge"], ["knee_flex"], ["knee_ext"], ["calf"], ["core"], ["abduction"], ["adduction"]] },
  lowerB: { get name() { return t("day.lowerB"); }, slots: [["hinge"], ["squat"], ["hip_thrust"], ["knee_ext"], ["knee_flex"], ["abduction"], ["calf"], ["core"], ["lunge"]] },
  push: { get name() { return t("day.push"); }, slots: [["h_push"], ["v_push"], ["h_push"], ["lateral"], ["fly"], ["triceps"], ["triceps"], ["lateral"]] },
  pull: { get name() { return t("day.pull"); }, slots: [["v_pull"], ["h_pull"], ["h_pull", "v_pull"], ["rear_delt"], ["biceps"], ["biceps"], ["core"], ["rear_delt"]] },
  legs: { get name() { return t("day.legs"); }, slots: [["squat"], ["hinge"], ["lunge"], ["knee_ext"], ["knee_flex"], ["hip_thrust"], ["calf"], ["abduction"]] },
};

// Cómo se reparte la semana según los días.
export const SPLITS = {
  2: ["fullA", "fullB"],
  3: ["fullA", "fullB", "fullC"],
  4: ["upperA", "lowerA", "upperB", "lowerB"],
  5: ["upperA", "lowerA", "push", "pull", "legs"],
  6: ["push", "pull", "legs", "push", "pull", "legs"],
};

// Series, repeticiones y descanso (segundos) según objetivo y tipo de ejercicio.
// En ejercicios por tiempo (plancha) las "repeticiones" son segundos.
export const PRESCRIPTIONS = {
  hipertrofia: {
    main: { sets: 3, repMin: 8, repMax: 12, rest: 90 },
    compound: { sets: 3, repMin: 8, repMax: 12, rest: 90 },
    isolation: { sets: 3, repMin: 10, repMax: 15, rest: 60 },
    timed: { sets: 3, repMin: 30, repMax: 45, rest: 60 },
  },
  fuerza: {
    main: { sets: 4, repMin: 4, repMax: 6, rest: 150 },
    compound: { sets: 3, repMin: 6, repMax: 8, rest: 120 },
    isolation: { sets: 3, repMin: 8, repMax: 12, rest: 75 },
    timed: { sets: 3, repMin: 30, repMax: 45, rest: 75 },
  },
  resistencia: {
    main: { sets: 3, repMin: 12, repMax: 15, rest: 60 },
    compound: { sets: 3, repMin: 12, repMax: 15, rest: 60 },
    isolation: { sets: 2, repMin: 15, repMax: 20, rest: 45 },
    timed: { sets: 2, repMin: 45, repMax: 60, rest: 45 },
  },
};

// Peso corporal y medidas del perfil.
export const BODY_METRICS = {};
for (const [key, unit] of Object.entries({ peso: "kg", busto: "cm", cintura: "cm", cadera: "cm", gluteos: "cm", brazo: "cm", muslo: "cm", pantorrilla: "cm" })) {
  Object.defineProperty(BODY_METRICS, key, { get: () => ({ label: t(`metric.${key}`), unit }), enumerable: true });
}

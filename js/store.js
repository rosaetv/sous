// Funciones para leer y guardar los datos de la app.

import { db } from "./db.js";
import { EXERCISES } from "./data/exercises.js";
import { EXERCISES_EN } from "./data/exercises-en.js";
import { lang } from "./i18n.js";
import { COMPOUND_PATTERNS } from "./data/catalog.js";
import { getPeriods, isPeriodDate, todayISO } from "./period.js";

// ---------- Ejercicios ----------

let exerciseCache;

export async function getAllExercises() {
  if (!exerciseCache) {
    const custom = await db.getAll("exercises");
    // En inglés se usan los textos traducidos; tus ejercicios propios quedan como los escribiste.
    const builtIn = lang() === "en" ? EXERCISES.map((e) => ({ ...e, ...EXERCISES_EN[e.id] })) : EXERCISES;
    exerciseCache = [...builtIn, ...custom.map((e) => ({ ...e, custom: true }))];
  }
  return exerciseCache;
}

export async function getExercise(id) {
  return (await getAllExercises()).find((e) => e.id === id);
}

export async function saveCustomExercise(exercise) {
  const { custom, ...data } = exercise;
  await db.put("exercises", data);
  exerciseCache = undefined;
}

export async function deleteCustomExercise(id) {
  await db.delete("exercises", id);
  exerciseCache = undefined;
}

export function isCompound(exercise) {
  return COMPOUND_PATTERNS.has(exercise.pattern);
}

// ---------- Favoritos y notas ----------

// favorites: { exercises: [favoritos], equipment: [equipo favorito], disliked: [no me gustan] }
export async function getFavorites() {
  const favorites = (await db.get("kv", "favorites")) || { exercises: [], equipment: [] };
  favorites.disliked ||= [];
  return favorites;
}

export async function toggleFavoriteExercise(id) {
  const favorites = await getFavorites();
  const list = new Set(favorites.exercises);
  list.has(id) ? list.delete(id) : list.add(id);
  favorites.exercises = [...list];
  // Un favorito no puede estar también en "no me gusta".
  if (list.has(id)) favorites.disliked = favorites.disliked.filter((x) => x !== id);
  await db.put("kv", favorites, "favorites");
  return list.has(id);
}

export async function toggleDislikedExercise(id) {
  const favorites = await getFavorites();
  const list = new Set(favorites.disliked);
  list.has(id) ? list.delete(id) : list.add(id);
  favorites.disliked = [...list];
  if (list.has(id)) favorites.exercises = favorites.exercises.filter((x) => x !== id);
  await db.put("kv", favorites, "favorites");
  return list.has(id);
}

export async function setFavoriteEquipment(equipment) {
  const favorites = await getFavorites();
  favorites.equipment = equipment;
  await db.put("kv", favorites, "favorites");
}

export async function getNotes() {
  return (await db.get("kv", "notes")) || {};
}

export async function setNote(exerciseId, text) {
  const notes = await getNotes();
  if (text.trim()) notes[exerciseId] = text.trim();
  else delete notes[exerciseId];
  await db.put("kv", notes, "notes");
}

// ---------- Plan semanal ----------

export const getPlan = () => db.get("kv", "plan");
export const savePlan = (plan) => db.put("kv", plan, "plan");

export const getDraft = () => db.get("kv", "draft");
export const saveDraft = (draft) => db.put("kv", draft, "draft");
export const deleteDraft = () => db.delete("kv", "draft");

// ---------- Entrenamientos ----------

// Entrenamiento en curso: se guarda en cada cambio para no perder nada si se cierra la app.
export const getActiveWorkout = () => db.get("kv", "active");
export const saveActiveWorkout = (workout) => db.put("kv", workout, "active");
export const clearActiveWorkout = () => db.delete("kv", "active");

export const saveWorkout = (workout) => db.put("workouts", workout);

// Entrenamientos terminados, del más reciente al más antiguo.
export async function getWorkouts() {
  const all = await db.getAll("workouts");
  return all.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export const getWorkout = (id) => db.get("workouts", id);
export const deleteWorkout = (id) => db.delete("workouts", id);

// Todas las sesiones de un ejercicio, de la más antigua a la más reciente.
export async function getExerciseHistory(exerciseId) {
  const sessions = [];
  for (const workout of await getWorkouts()) {
    if (workout.extra) continue; // Core DIY va en segundos: no entra en la progresión ni en los récords
    const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (entry?.sets.length) sessions.push({ date: workout.finishedAt, workoutId: workout.id, ...entry });
  }
  return sessions.reverse();
}

// Series de la última vez que se hizo un ejercicio.
// Las sesiones de descarga no cuentan: la progresión sigue desde antes de la descarga.
// Las sesiones de días de período no cuentan como referencia si hay una sesión normal:
// así un día más ligero no baja la siguiente sugerencia.
export async function getLastPerformance(exerciseId) {
  const periods = (await getProfile()).trackPeriod ? await getPeriods() : [];
  let periodFallback = null;
  for (const workout of await getWorkouts()) {
    if (workout.deload || workout.extra) continue;
    const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!entry?.sets.length) continue;
    const found = { date: workout.finishedAt, sets: entry.sets, effort: entry.effort };
    if (!isPeriodDate(periods, todayISO(new Date(workout.finishedAt)))) return found;
    periodFallback ||= found;
  }
  return periodFallback;
}

// Lunes a las 00:00 de la semana de la fecha dada.
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}


// ---------- Peso y medidas ----------

// Cada registro: { id, date: "2026-10-10", values: { peso: 60.5, cintura: 70, ... } }
export async function getMeasurements() {
  const all = await db.getAll("measurements");
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export const saveMeasurement = (record) => db.put("measurements", record);
export const deleteMeasurement = (id) => db.delete("measurements", id);

// Últimas respuestas del cuestionario, para rellenarlo la próxima vez.
export async function getPrefs() {
  return (await db.get("kv", "prefs")) || {};
}
export const savePrefs = (prefs) => db.put("kv", prefs, "prefs");

// ---------- Perfil ----------

export async function getProfile() {
  return (await db.get("kv", "profile")) || {};
}
export const saveProfile = (profile) => db.put("kv", profile, "profile");

// Para volver a leer los ejercicios propios después de importar o borrar.
export function resetExerciseCache() {
  exerciseCache = undefined;
}

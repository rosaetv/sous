// Respaldo: exportar e importar todos los datos, y borrar por categorías.

import { db, STORES } from "./db.js";
import { resetExerciseCache } from "./store.js";
import { t } from "./i18n.js";

// Nombre interno de los respaldos: se mantiene para poder importar respaldos anteriores.
const APP = "show-up";
const VERSION = 1;

// ---------- Exportar ----------

export async function exportData() {
  const data = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), kv: {} };
  for (const key of await db.getAllKeys("kv")) data.kv[key] = await db.get("kv", key);
  data.exercises = await db.getAll("exercises");
  data.workouts = await db.getAll("workouts");
  data.measurements = await db.getAll("measurements");
  return data;
}

/** Guarda el archivo: en el iPhone abre el menú de compartir; en la computadora lo descarga. */
export async function downloadBackup() {
  const data = await exportData();
  const date = data.exportedAt.slice(0, 10);
  const name = `showup-respaldo-${date}.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });

  const isTouch = matchMedia("(pointer: coarse)").matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t("backup.shareTitle") });
    } catch (error) {
      if (error.name === "AbortError") return false; // Se canceló el menú de compartir.
      throw error;
    }
  } else {
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await db.put("kv", new Date().toISOString(), "lastBackup");
  return true;
}

export const getLastBackup = () => db.get("kv", "lastBackup");

// "Más tarde" en el recordatorio: lo oculta unos días.
export const getBackupSnooze = () => db.get("kv", "backupSnooze");
export const snoozeBackup = (days) => db.put("kv", new Date(Date.now() + days * 86400000).toISOString(), "backupSnooze");

// Espacio que usa la app en el dispositivo (en MB), si el navegador lo informa.
export async function storageUsage() {
  const estimate = await navigator.storage?.estimate?.();
  return estimate?.usage != null ? estimate.usage / (1024 * 1024) : null;
}

// ---------- Importar ----------

/** Lee y revisa un archivo de respaldo. Lanza un error con un mensaje claro si no es válido. */
export async function readBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(t("backup.errorRead"));
  }
  if (data?.app !== APP || typeof data.kv !== "object" || !Array.isArray(data.workouts)) {
    throw new Error(t("backup.errorNotBackup"));
  }
  if (data.version > VERSION) {
    throw new Error(t("backup.errorNewer"));
  }
  return data;
}

/** Reemplaza todos los datos actuales por los del respaldo. */
export async function importData(data) {
  for (const store of STORES) await db.clear(store);
  for (const [key, value] of Object.entries(data.kv)) await db.put("kv", value, key);
  for (const item of data.exercises || []) await db.put("exercises", item);
  for (const item of data.workouts || []) await db.put("workouts", item);
  for (const item of data.measurements || []) await db.put("measurements", item);
  resetExerciseCache();
}

// ---------- Borrar por categorías ----------

// Nombre y descripción de cada categoría: "delete.<clave>" y "delete.<clave>Detail".
export const DELETE_CATEGORIES = {};
for (const key of ["workouts", "measurements", "period", "goals", "plan", "customExercises", "favorites", "prefs", "profile"]) {
  Object.defineProperty(DELETE_CATEGORIES, key, {
    get: () => ({ label: t(`delete.${key}`), detail: t(`delete.${key}Detail`) }),
    enumerable: true,
  });
}

export async function deleteData(categories) {
  const has = (c) => categories.includes(c);

  if (has("workouts")) {
    await db.clear("workouts");
    await db.delete("kv", "active");
  }
  if (has("measurements")) await db.clear("measurements");
  if (has("period")) await db.delete("kv", "periods");
  if (has("goals")) {
    await db.delete("kv", "goals");
    await db.delete("kv", "victories");
  }
  if (has("plan")) {
    await db.delete("kv", "plan");
    await db.delete("kv", "draft");
  }
  if (has("customExercises")) {
    // Quita también sus favoritos y notas para no dejar restos.
    const ids = await db.getAllKeys("exercises");
    const favorites = await db.get("kv", "favorites");
    if (favorites) {
      favorites.exercises = favorites.exercises.filter((id) => !ids.includes(id));
      await db.put("kv", favorites, "favorites");
    }
    const notes = await db.get("kv", "notes");
    if (notes) {
      ids.forEach((id) => delete notes[id]);
      await db.put("kv", notes, "notes");
    }
    await db.clear("exercises");
  }
  if (has("favorites")) {
    await db.delete("kv", "favorites");
    await db.delete("kv", "notes");
    await db.delete("kv", "units");
  }
  if (has("prefs")) await db.delete("kv", "prefs");
  if (has("profile")) await db.delete("kv", "profile");
  resetExerciseCache();
}

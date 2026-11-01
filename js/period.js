// Registro del período: fechas de inicio y fin, guardadas solo en el teléfono.
// Esos días la app es más amable: frases suaves, recordatorio al entrenar y
// la progresión no toma como retroceso una sesión más ligera.

import { db } from "./db.js";

const DAY = 86400000;
const MAX_DAYS = 10; // si se olvida marcar "Terminó", deja de contar como activo

// Cada registro: { start: "2026-10-12", end: "2026-10-16" | null }
export async function getPeriods() {
  const list = (await db.get("kv", "periods")) || [];
  return list.sort((a, b) => b.start.localeCompare(a.start)); // el más reciente primero
}

export const savePeriods = (list) => db.put("kv", list, "periods");

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00`) - new Date(`${a}T00:00`)) / DAY);

// Último día de un período. Sin fecha de fin: si es el más reciente y empezó hace
// menos de 10 días, sigue en curso (llega hasta hoy); si no, solo cuenta el día de inicio.
function lastDay(p, all, today) {
  if (p.end) return p.end;
  const isLatest = !all.some((other) => other !== p && other.start > p.start);
  const inProgress = isLatest && p.start <= today && daysBetween(p.start, today) < MAX_DAYS;
  return inProgress ? today : p.start;
}

// Período en curso: { period, day } o null. Solo el más reciente puede estarlo.
export function activePeriod(periods, date = todayISO()) {
  const period = periods.filter((p) => p.start <= date).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (!period || period.end) return null;
  const day = daysBetween(period.start, date) + 1;
  return day <= MAX_DAYS ? { period, day } : null;
}

// ¿Esa fecha cayó dentro de un período registrado?
export function isPeriodDate(periods, date, today = todayISO()) {
  return periods.some((p) => p.start <= date && date <= lastDay(p, periods, today));
}

// Revisa que un período no se cruce con otro. Devuelve el texto del error (clave) o null.
// ignore: el registro que se está editando (no se compara consigo mismo).
export function periodError(periods, candidate, ignore, today = todayISO()) {
  if (candidate.end && candidate.end < candidate.start) return "period.errorOrder";
  const others = periods.filter((p) => p !== ignore);
  const all = [...others, candidate];
  // Los registros existentes se miden como están ahora (un período en curso sigue hasta hoy).
  const overlaps = others.some((p) => p.start <= lastDay(candidate, all, today) && candidate.start <= lastDay(p, others, today));
  return overlaps ? "period.errorOverlap" : null;
}

export async function startPeriod(start) {
  const periods = await getPeriods();
  periods.push({ start, end: null });
  await savePeriods(periods);
}

export async function endPeriod(period, end) {
  const periods = await getPeriods();
  const stored = periods.find((p) => p.start === period.start);
  if (stored) stored.end = end;
  await savePeriods(periods);
}

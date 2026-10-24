// Batch (mealprep): qué día toca y cuánto llevas.

import { pasoBatch } from "./validar.js";
import { datesBetween, fromISO, isISODate } from "./fechas.js";

// En el orden de Date.getDay(), sin acentos.
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Domingo después de las 17h" → la fecha de ese domingo dentro de la semana.
// Acepta plural ("Domingos"). Si nombra varios días, cuenta el primero que aparece. Si no nombra ninguno: null.
export function fechaDelBatch(cuando, inicio, fin) {
  const text = sinAcentos(String(cuando || ""));
  let dia = -1;
  let at = Infinity;
  DIAS.forEach((nombre, i) => {
    const m = text.match(new RegExp(`\\b${nombre}s?\\b`));
    if (m && m.index < at) [dia, at] = [i, m.index];
  });
  if (dia === -1) return null;
  return datesBetween(inicio, fin).find((f) => fromISO(f).getDay() === dia) || null;
}

// El día de un bloque de mealprep: su "fecha" exacta si la trae (puede ser antes del lunes del menú,
// como el batch del domingo anterior); si no, el día que nombra "cuando" dentro de la semana.
export function fechaDeBloque(b, semana) {
  return isISODate(b.fecha) ? b.fecha : fechaDelBatch(b.cuando, semana.inicio, semana.fin);
}

// Todos los bloques de mealprep (de cualquier menú) que tocan en una fecha: [{ semana, i }]
export function bloquesDelDia(semanas, fecha) {
  return semanas.flatMap((semana) => semana.batch.map((b, i) => ({ semana, i })).filter(({ semana, i }) => fechaDeBloque(semana.batch[i], semana) === fecha));
}

export const batchKey = (inicio, i, j) => `${inicio}|batch|${i}|${j}`;

// Los pasos siempre como { texto, recetaId } (las semanas viejas los guardaron como texto).
export const pasosDe = (b) => b.pasos.map(pasoBatch);

export function progresoBatch(inicio, i, b, checks) {
  const total = b.pasos.length;
  const hechos = b.pasos.filter((_, j) => checks.has(batchKey(inicio, i, j))).length;
  return { hechos, total };
}

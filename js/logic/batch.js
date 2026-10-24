// Batch (mealprep): qué día toca y cuánto llevas.

import { pasoBatch } from "./validar.js";
import { datesBetween, fromISO, isISODate, toISO } from "./fechas.js";

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

const MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11 };

// Una fecha escrita en el texto: "Domingo 25 oct", "el 3 de noviembre". El año: el más cercano a "cerca".
// null si no hay fecha o no existe (31 de febrero).
export function fechaEnTexto(texto, cerca) {
  const m = sinAcentos(String(texto || "")).match(/\b(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\b/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = MESES[m[2]];
  const base = fromISO(cerca);
  const opciones = [-1, 0, 1]
    .map((d) => new Date(base.getFullYear() + d, mes, dia))
    .filter((f) => f.getDate() === dia && f.getMonth() === mes);
  if (!opciones.length) return null;
  opciones.sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
  return toISO(opciones[0]);
}

// El día de un bloque de mealprep, en este orden:
// 1. su "fecha" exacta (puede ser antes del lunes del menú, como el batch del domingo anterior);
// 2. una fecha escrita en "cuando" ("Domingo 25 oct, después de las 17h");
// 3. el día de la semana que nombra "cuando", dentro de las fechas del menú.
export function fechaDeBloque(b, semana) {
  if (isISODate(b.fecha)) return b.fecha;
  return fechaEnTexto(b.cuando, semana.inicio) || fechaDelBatch(b.cuando, semana.inicio, semana.fin);
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

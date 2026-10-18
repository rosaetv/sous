// Fechas como texto "YYYY-MM-DD" en hora local (sin líos de zonas horarias).

const pad = (n) => String(n).padStart(2, "0");

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ¿Es una fecha real con el formato YYYY-MM-DD? ("2026-02-30" no lo es)
export function isISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISO(fromISO(value)) === value;
}

export function addDays(iso, days) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

// Todas las fechas entre inicio y fin, incluidas.
export function datesBetween(start, end) {
  const dates = [];
  for (let d = start; d <= end && dates.length < 60; d = addDays(d, 1)) dates.push(d);
  return dates;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// "Mar 20"
export function shortDay(iso) {
  const date = fromISO(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

// "19–25 oct" o "28 oct – 3 nov"
export function rangeLabel(start, end) {
  const a = fromISO(start);
  const b = fromISO(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

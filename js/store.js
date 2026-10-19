// Guardar y leer los datos de la app. Las pantallas solo hablan con este archivo.

import { db } from "./db.js";
import { rangeLabel, todayISO } from "./logic/fechas.js";

const now = () => new Date().toISOString();

// ---------- Importar ----------

// Antes de importar: ¿qué se va a reemplazar? (para pedir confirmación con un toque)
export async function previewImport({ tipo, datos }) {
  if (tipo !== "menu") return { needsConfirm: false };

  const semanas = await db.getAll("semanas");
  const overlapping = semanas.filter((s) => s.inicio <= datos.fin && s.fin >= datos.inicio);
  if (!overlapping.length) return { needsConfirm: false };

  const marcas = await db.getAll("marcas");
  const marked = marcas.filter((m) => m.fecha >= datos.inicio && m.fecha <= datos.fin).length;
  return { needsConfirm: true, replaces: overlapping.map((s) => rangeLabel(s.inicio, s.fin)), marked };
}

// Guarda lo importado. Devuelve un resumen corto para mostrar.
export async function applyImport({ tipo, datos }) {
  if (tipo === "menu") return importMenu(datos);
  if (tipo === "lista") return importLista(datos);
  return importRecetario(datos);
}

// Reemplaza la semana con las mismas fechas. Las marcas no se tocan (viven aparte, por fecha y momento).
async function importMenu(menu) {
  const semanas = await db.getAll("semanas");
  const overlapping = semanas.filter((s) => s.inicio <= menu.fin && s.fin >= menu.inicio);
  const previous = semanas.find((s) => s.inicio === menu.inicio);

  // Los intercambios de días se conservan si los dos días siguen en el menú nuevo.
  const fechas = new Set(menu.dias.map((d) => d.fecha));
  const intercambios = Object.fromEntries(
    Object.entries(previous?.intercambios || {}).filter(([fecha, origen]) => fechas.has(fecha) && fechas.has(origen)),
  );

  const { tipo, ...semana } = menu;
  await db.transaction(["semanas"], ({ semanas: store }) => {
    overlapping.forEach((s) => store.delete(s.inicio));
    store.put({ ...semana, intercambios, importadoEn: now() });
  });

  const comidas = menu.dias.reduce((sum, d) => sum + d.comidas.length, 0);
  return {
    title: `Menú del ${rangeLabel(menu.inicio, menu.fin)}`,
    detail: `${plural(menu.dias.length, "día", "días")} · ${plural(comidas, "comida", "comidas")}${menu.batch.length ? " · batch" : ""}`,
    replaced: overlapping.length > 0,
    // Un menú que aún no empieza (lo normal: lo importas el fin de semana): se abre esa semana.
    // Hoy sigue mostrando tu día de hoy.
    go: menu.inicio > todayISO() ? { href: `#/semana/${menu.inicio}`, label: "Ver la semana" } : { href: "#/hoy", label: "Ver Hoy" },
  };
}

// La lista se reemplaza; lo palomeado se guarda aparte por nombre, así que sigue palomeado.
async function importLista(lista) {
  const previous = await db.get("listas", lista.semanaInicio);
  const { tipo, ...rest } = lista;
  await db.put("listas", { ...rest, importadoEn: now() });
  return {
    title: "Lista del súper",
    detail: `${plural(lista.items.length, "artículo", "artículos")}${lista.totalEstimado != null ? ` · ${formatMoney(lista.totalEstimado)}` : ""}`,
    replaced: Boolean(previous),
    go: { href: "#/super", label: "Ver Súper" },
  };
}

// Actualiza cada receta por id. Las fotos viven aparte: importar nunca las toca.
// Las recetas que ya no vienen en el recetario se quedan (no se borra nada).
async function importRecetario(recetario) {
  const existing = new Set(await db.getAllKeys("recetas"));
  const nuevas = recetario.recetas.filter((r) => !existing.has(r.id)).length;
  await db.transaction(["recetas", "kv"], ({ recetas, kv }) => {
    recetario.recetas.forEach((r) => recetas.put({ ...r, importadoEn: now() }));
    kv.put(recetario.version, "recetarioVersion");
  });
  const actualizadas = recetario.recetas.length - nuevas;
  return {
    title: `Recetario${recetario.version ? ` (${recetario.version})` : ""}`,
    detail: [nuevas && plural(nuevas, "nueva", "nuevas"), actualizadas && plural(actualizadas, "actualizada", "actualizadas")]
      .filter(Boolean)
      .join(" · "),
    replaced: false,
    go: { href: "#/recetas", label: "Ver Recetas" },
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function formatMoney(value) {
  return value.toLocaleString("es", { style: "currency", currency: "EUR" });
}

// ---------- Leer ----------

export async function counts() {
  const [semanas, listas, recetas] = await Promise.all([db.getAllKeys("semanas"), db.getAllKeys("listas"), db.getAllKeys("recetas")]);
  return { semanas: semanas.length, listas: listas.length, recetas: recetas.length };
}

// ---------- Un día ----------

// La semana importada que incluye esa fecha (o null).
export async function weekFor(fecha) {
  const semanas = await db.getAll("semanas");
  return semanas.find((s) => s.inicio <= fecha && s.fin >= fecha) || null;
}

// Qué toca comer en una fecha, ya con los intercambios aplicados.
// Las etiquetas (oficina, gym…) son de la fecha; las comidas y macros, del menú que se come ese día.
export function dayPlan(semana, fecha) {
  if (!semana) return null;
  const own = semana.dias.find((d) => d.fecha === fecha);
  const origen = semana.intercambios?.[fecha] || fecha;
  const menu = semana.dias.find((d) => d.fecha === origen);
  if (!menu) return null;
  return {
    fecha,
    origen, // si es distinto de fecha, hoy comes el menú de otro día
    etiquetas: own?.etiquetas || [],
    etiquetasOrigen: menu.etiquetas,
    comidas: menu.comidas,
    macros: menu.macros,
  };
}

export async function marksFor(fecha) {
  const database = await db.getAll("marcas");
  return Object.fromEntries(database.filter((m) => m.fecha === fecha).map((m) => [m.momento, m]));
}

export async function marksBetween(inicio, fin) {
  return (await db.getAll("marcas")).filter((m) => m.fecha >= inicio && m.fecha <= fin);
}

// Marca una comida. Guarda también el plato del menú, para que el resumen
// siga siendo correcto aunque después cambie el menú o intercambies días.
export async function setMark(fecha, comida, { estado, sustituto = "", comio = null }) {
  const clave = `${fecha}|${comida.momento}`;
  const previous = await db.get("marcas", clave);
  const mark = {
    ...previous,
    clave,
    fecha,
    momento: comida.momento,
    estado,
    sustituto: estado === "cambiado" ? sustituto : "",
    // Lo que de verdad comiste ({ plato, ingredientes }), si lo editaste al marcar "Cambiado".
    comio: estado === "cambiado" ? comio : null,
    // Ingredientes palomeados por partes: solo cuentan si la comida está como Comido.
    partes: estado === "comido" ? previous?.partes || null : null,
    plato: comida.plato,
    recetaId: comida.recetaId,
    marcadoEn: now(),
  };
  await db.put("marcas", mark);
  return mark;
}

// ---------- Por partes y reserva del día ----------

// Palomea un ingrediente: la comida queda como comida y lo no palomeado pasa a la reserva. No se despalomea.
export async function checkParte(fecha, comida, nombre) {
  let mark = await db.get("marcas", `${fecha}|${comida.momento}`);
  if (!mark || mark.estado !== "comido") mark = await setMark(fecha, comida, { estado: "comido" });
  const partes = [...(mark.partes || [])];
  if (!partes.includes(nombre)) partes.push(nombre);
  const updated = { ...mark, partes };
  await db.put("marcas", updated);
  return updated;
}

// "Comido" en una comida por partes = me comí todo lo que quedaba (lo movido a otra comida se queda allá).
export async function checkAllPartes(fecha, comida, movidos) {
  const mark = await db.get("marcas", `${fecha}|${comida.momento}`);
  const fuera = movidos.filter((m) => m.de === comida.momento).map((m) => m.nombre);
  const partes = comida.ingredientes.map((i) => i.nombre).filter((n) => !fuera.includes(n));
  const updated = { ...mark, partes };
  await db.put("marcas", updated);
  return updated;
}

// Lo que pasó de la reserva a otra comida ese día.
export async function movidosDe(fecha) {
  return (await db.get("kv", `reserva|${fecha}`))?.movidos || [];
}

export async function moverDeReserva(fecha, { nombre, de, a }) {
  const movidos = [...(await movidosDe(fecha)), { nombre, de, a }];
  await db.put("kv", { movidos }, `reserva|${fecha}`);
  return movidos;
}

export async function clearMark(fecha, momento) {
  await db.delete("marcas", `${fecha}|${momento}`);
}

// 👍 / 👎 y nota corta, sobre una comida ya marcada.
export async function updateMark(fecha, momento, changes) {
  const clave = `${fecha}|${momento}`;
  const mark = await db.get("marcas", clave);
  if (!mark) return null;
  const updated = { ...mark, ...changes };
  await db.put("marcas", updated);
  return updated;
}

// Intercambia los menús de dos días de la misma semana (el día completo).
// Hacerlo otra vez con los mismos días lo deshace.
export async function swapDays(inicio, a, b) {
  const semana = await db.get("semanas", inicio);
  const map = { ...(semana.intercambios || {}) };
  const origenA = map[a] || a;
  const origenB = map[b] || b;
  map[a] = origenB;
  map[b] = origenA;
  // Sin entradas que apunten a sí mismas: así "sin intercambios" queda vacío.
  for (const [fecha, origen] of Object.entries(map)) if (fecha === origen) delete map[fecha];
  await db.put("semanas", { ...semana, intercambios: map });
  return map;
}

export async function recipeIds() {
  return new Set(await db.getAllKeys("recetas"));
}

// Map de id → receta (para enlazar los pasos del batch con su receta y tiempo).
export async function recipesById() {
  return new Map((await db.getAll("recetas")).map((r) => [r.id, r]));
}

// ---------- Semanas ----------

export async function allWeeks() {
  return (await db.getAll("semanas")).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
}

// La semana para abrir por defecto: la de hoy; si no hay, la próxima; si no, la última.
export function defaultWeek(semanas, today) {
  return (
    semanas.find((s) => s.inicio <= today && s.fin >= today) ||
    semanas.find((s) => s.inicio > today) ||
    semanas.at(-1) ||
    null
  );
}

// ---------- Palomitas (batch y súper) ----------
// Clave: "2026-10-19|batch|0|1" o "2026-10-19|super|avena".

export async function checksWithPrefix(prefix) {
  return new Set((await db.getAllKeys("checks")).filter((k) => k.startsWith(prefix)));
}

// value: true (hecho) o un objeto con más detalle, como { estado: "parcial", llevo: "2 latas" }.
// Falso o vacío: se quita la palomita.
export async function setCheck(key, value) {
  if (value) await db.put("checks", value, key);
  else await db.delete("checks", key);
}

// Las palomitas con su valor: Map de clave → valor.
export async function checksMap(prefix) {
  const database = await db.getAllKeys("checks");
  const keys = database.filter((k) => k.startsWith(prefix));
  const values = await Promise.all(keys.map((k) => db.get("checks", k)));
  return new Map(keys.map((k, i) => [k, values[i]]));
}

// ---------- Súper ----------

export async function allLists() {
  return (await db.getAll("listas")).sort((a, b) => (a.semanaInicio < b.semanaInicio ? -1 : 1));
}

// La lista para abrir por defecto: la última que importaste (normalmente vas al súper justo después).
export function defaultList(listas) {
  return listas.reduce((best, l) => (!best || (l.importadoEn || "") > (best.importadoEn || "") ? l : best), null);
}

export async function clearChecks(prefix) {
  const keys = await checksWithPrefix(prefix);
  await db.transaction(["checks"], ({ checks }) => keys.forEach((k) => checks.delete(k)));
}

// ---------- Recetas y fotos ----------

export async function allRecipes() {
  return (await db.getAll("recetas")).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function getRecipe(id) {
  return db.get("recetas", id);
}

// Fotos de todas las recetas: Map de id → { blob, origen, url }.
export async function allPhotos() {
  const [keys, values] = await Promise.all([db.getAllKeys("fotos"), db.getAll("fotos")]);
  return new Map(keys.map((k, i) => [k, values[i]]));
}

export function getPhoto(id) {
  return db.get("fotos", id);
}

// origen "usuario": la pusiste tú (nunca se reemplaza sola). origen "url": copia de imagenUrl.
export function savePhoto(id, blob, origen, url = "") {
  return db.put("fotos", { blob, origen, url, actualizadoEn: now() }, id);
}

export function deletePhoto(id) {
  return db.delete("fotos", id);
}

// Guarda en el teléfono la foto de imagenUrl, para verla sin conexión.
// Solo si no pusiste una tuya. Si el sitio no deja descargarla, no pasa nada:
// se sigue viendo con internet (y el modo sin conexión la guarda al verla).
export async function cacheRecipeImage(receta) {
  if (!receta.imagenUrl) return false;
  const existing = await getPhoto(receta.id);
  if (existing && (existing.origen === "usuario" || existing.url === receta.imagenUrl)) return false;
  try {
    const response = await fetch(receta.imagenUrl, { mode: "cors" });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return false;
    // Mientras se descargaba pudiste poner tu foto: la tuya gana.
    if ((await getPhoto(receta.id))?.origen === "usuario") return false;
    await savePhoto(receta.id, blob, "url", receta.imagenUrl);
    return true;
  } catch {
    return false;
  }
}

// ---------- Resumen para Claude ----------

export async function summaryData(semana) {
  const plans = semana.dias.map((d) => dayPlan(semana, d.fecha)).filter(Boolean);
  const [marks, lista] = await Promise.all([marksBetween(semana.inicio, semana.fin), db.get("listas", semana.inicio)]);
  const prefix = `${semana.inicio}|super|`;
  const listChecks = new Map([...(await checksMap(prefix))].map(([k, v]) => [k.slice(prefix.length), v]));
  const movidos = Object.fromEntries(await Promise.all(plans.map(async (p) => [p.fecha, await movidosDe(p.fecha)])));
  return { semana, plans, marks, lista: lista || null, listChecks, movidos };
}

// ---------- Borrar una semana ----------
// Borra el menú, las marcas de esos días, las palomitas (batch y súper) y la lista del súper.
export async function deleteWeek(inicio) {
  const semana = await db.get("semanas", inicio);
  if (!semana) return;
  const marcas = await marksBetween(semana.inicio, semana.fin);
  const checks = await checksWithPrefix(`${inicio}|`);
  const fechas = semana.dias.map((d) => d.fecha);
  await db.transaction(["semanas", "marcas", "checks", "listas", "kv"], (s) => {
    fechas.forEach((f) => s.kv.delete(`reserva|${f}`));
    s.semanas.delete(inicio);
    marcas.forEach((m) => s.marcas.delete(m.clave));
    checks.forEach((k) => s.checks.delete(k));
    s.listas.delete(inicio);
  });
}

// Lo que has dicho de una receta cada vez que la comiste: para ver de un vistazo si funciona.
export async function recipeHistory(recetaId) {
  const marks = (await db.getAll("marcas")).filter((m) => m.recetaId === recetaId).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return {
    comida: marks.filter((m) => m.estado === "comido").length,
    cambiada: marks.filter((m) => m.estado !== "comido").length,
    up: marks.filter((m) => m.valoracion === "up").length,
    down: marks.filter((m) => m.valoracion === "down").length,
    notas: marks.filter((m) => m.nota).map((m) => ({ fecha: m.fecha, nota: m.nota, valoracion: m.valoracion })),
  };
}

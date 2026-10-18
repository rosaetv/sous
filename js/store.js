// Guardar y leer los datos de la app. Las pantallas solo hablan con este archivo.

import { db } from "./db.js";
import { rangeLabel } from "./logic/fechas.js";

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
    go: { href: "#/hoy", label: "Ver Hoy" },
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
export async function setMark(fecha, comida, { estado, sustituto = "" }) {
  const clave = `${fecha}|${comida.momento}`;
  const previous = await db.get("marcas", clave);
  const mark = {
    ...previous,
    clave,
    fecha,
    momento: comida.momento,
    estado,
    sustituto: estado === "cambiado" ? sustituto : "",
    plato: comida.plato,
    recetaId: comida.recetaId,
    marcadoEn: now(),
  };
  await db.put("marcas", mark);
  return mark;
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

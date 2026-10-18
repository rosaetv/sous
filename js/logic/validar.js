// Lee y revisa el JSON que pegas desde Claude.
// Devuelve los datos ya ordenados y completos (con valores por defecto),
// o una lista de errores claros en español. Nunca guarda nada: eso lo hace store.js.

import { isISODate, datesBetween, shortDay } from "./fechas.js";
import { MOMENTOS, CATEGORIAS } from "./menu.js";

const TIPOS = ["menu", "lista", "recetario"];
const MACROS = ["kcal", "prot", "carb", "grasa", "fibra"];

// ---------- Del texto al objeto ----------

// Acepta el JSON tal cual, dentro de un bloque ```json ... ``` o con texto alrededor.
export function parseJSON(text) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, errores: ["El campo está vacío. Pega el JSON que te dio Claude."] };

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last <= first) {
    return { ok: false, errores: ["No encontré un JSON: debe empezar con { y terminar con }."] };
  }
  const body = raw.slice(first, last + 1);

  for (const candidate of [body, body.replace(/[“”]/g, '"')]) {
    try {
      return { ok: true, datos: JSON.parse(candidate) };
    } catch {
      // probamos con comillas rectas antes de rendirnos
    }
  }
  return {
    ok: false,
    errores: ["El texto no es un JSON válido. Revisa que lo hayas copiado completo, desde la primera { hasta la última }."],
  };
}

// ---------- Revisión por tipo ----------

export function validar(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, errores: ["El JSON debe ser un objeto que empiece con {."] };
  }
  if (!("tipo" in obj)) return { ok: false, errores: ['Falta el campo tipo ("menu", "lista" o "recetario").'] };
  if (!TIPOS.includes(obj.tipo)) {
    return { ok: false, errores: [`No reconozco el tipo "${obj.tipo}". Debe ser "menu", "lista" o "recetario".`] };
  }

  const ctx = { errores: [], avisos: [] };
  const datos =
    obj.tipo === "menu" ? validarMenu(obj, ctx) : obj.tipo === "lista" ? validarLista(obj, ctx) : validarRecetario(obj, ctx);

  if (ctx.errores.length) return { ok: false, tipo: obj.tipo, errores: ctx.errores };
  return { ok: true, tipo: obj.tipo, datos, avisos: ctx.avisos };
}

// Pegar y revisar en un solo paso.
export function leer(text) {
  const parsed = parseJSON(text);
  return parsed.ok ? validar(parsed.datos) : parsed;
}

// ---------- Ayudas ----------

const isText = (v) => typeof v === "string" && v.trim() !== "";
const text = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

function textList(value, where, ctx) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    ctx.errores.push(`${where} debe ser una lista [ ].`);
    return [];
  }
  return value.filter((v) => v != null && text(v) !== "").map(text);
}

function list(value, where, ctx, { required = false } = {}) {
  if (value == null) {
    if (required) ctx.errores.push(`Falta el campo ${where}.`);
    return [];
  }
  if (!Array.isArray(value)) {
    ctx.errores.push(`${where} debe ser una lista [ ].`);
    return [];
  }
  return value;
}

function number(value, where, ctx) {
  if (value == null || value === "") return null;
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || Number.isNaN(n)) {
    ctx.errores.push(`${where} debe ser un número (está como "${value}").`);
    return null;
  }
  return n;
}

function macros(value, where, ctx) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    ctx.errores.push(`${where}: macros debe ser un objeto { }.`);
    return null;
  }
  const out = {};
  for (const key of MACROS) {
    const n = number(value[key], `${where}: macros.${key}`, ctx);
    if (n != null) out[key] = n;
  }
  return out;
}

// La cantidad puede venir como número (2) o como texto ("al gusto").
function cantidad(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? text(value) : n;
}

function ingredientes(value, where, ctx) {
  return list(value, `${where}: ingredientes`, ctx).flatMap((ing, i) => {
    if (typeof ing === "string" && ing.trim()) return [{ nombre: ing.trim(), cantidad: null, unidad: "", ref: "" }];
    if (!ing || !isText(ing.nombre)) {
      ctx.errores.push(`${where}, ingrediente ${i + 1}: falta el campo nombre.`);
      return [];
    }
    return [{ nombre: text(ing.nombre), cantidad: cantidad(ing.cantidad), unidad: text(ing.unidad), ref: text(ing.ref) }];
  });
}

export function slug(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- Menú semanal ----------

function validarMenu(obj, ctx) {
  const semana = obj.semana;
  if (!semana || typeof semana !== "object") {
    ctx.errores.push("Falta el campo semana (con inicio y fin).");
    return null;
  }
  const { inicio, fin } = semana;
  if (!isISODate(inicio)) ctx.errores.push(`semana.inicio debe ser una fecha como "2026-10-19"${inicio ? ` (está como "${inicio}")` : ""}.`);
  if (!isISODate(fin)) ctx.errores.push(`semana.fin debe ser una fecha como "2026-10-25"${fin ? ` (está como "${fin}")` : ""}.`);
  if (ctx.errores.length) return null;
  if (fin < inicio) {
    ctx.errores.push(`La semana termina (${fin}) antes de empezar (${inicio}).`);
    return null;
  }

  const rawDias = list(obj.dias, "dias", ctx, { required: true });
  if (obj.dias != null && Array.isArray(obj.dias) && rawDias.length === 0) ctx.errores.push("La lista dias está vacía.");

  const vistas = new Set();
  const orden = MOMENTOS.map((m) => m.id);
  const dias = rawDias.flatMap((dia, i) => {
    if (!dia || !isISODate(dia.fecha)) {
      ctx.errores.push(`Día ${i + 1}: falta el campo fecha (como "2026-10-19").`);
      return [];
    }
    const where = `Día ${dia.fecha}`;
    if (dia.fecha < inicio || dia.fecha > fin) {
      ctx.errores.push(`${where}: está fuera de la semana (${inicio} a ${fin}).`);
      return [];
    }
    if (vistas.has(dia.fecha)) {
      ctx.errores.push(`${where}: aparece dos veces.`);
      return [];
    }
    vistas.add(dia.fecha);

    const momentos = new Set();
    const comidas = list(dia.comidas, `${where}: comidas`, ctx, { required: true }).flatMap((c, j) => {
      const whereC = `${where}, comida ${j + 1}`;
      if (!c || !orden.includes(c.momento)) {
        const opciones = orden.join(", ");
        ctx.errores.push(`${whereC}: momento debe ser uno de: ${opciones}${c?.momento ? ` (está como "${c.momento}")` : ""}.`);
        return [];
      }
      if (momentos.has(c.momento)) {
        ctx.errores.push(`${where}: el momento "${c.momento}" aparece dos veces.`);
        return [];
      }
      momentos.add(c.momento);
      if (!isText(c.plato)) {
        ctx.errores.push(`${whereC} (${c.momento}): falta el campo plato.`);
        return [];
      }
      return [
        {
          momento: c.momento,
          plato: text(c.plato),
          recetaId: isText(c.recetaId) ? text(c.recetaId) : null,
          ingredientes: ingredientes(c.ingredientes, `${whereC} (${c.momento})`, ctx),
          nota: text(c.nota),
        },
      ];
    });
    comidas.sort((a, b) => orden.indexOf(a.momento) - orden.indexOf(b.momento));

    return [
      {
        fecha: dia.fecha,
        etiquetas: textList(dia.etiquetas, `${where}: etiquetas`, ctx).map((e) => e.toLowerCase()),
        comidas,
        macros: macros(dia.macros, where, ctx),
      },
    ];
  });
  dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const faltan = datesBetween(inicio, fin).filter((d) => !vistas.has(d));
  if (dias.length && faltan.length) ctx.avisos.push(`No hay menú para: ${faltan.map(shortDay).join(", ")}.`);

  const batch = list(obj.batch, "batch", ctx).flatMap((b, i) => {
    if (!b || typeof b !== "object") return [];
    const pasos = textList(b.pasos, `batch ${i + 1}: pasos`, ctx);
    if (!pasos.length) return [];
    return [{ cuando: text(b.cuando), pasos }];
  });

  return {
    tipo: "menu",
    inicio,
    fin,
    modo: text(semana.modo),
    notasFijas: textList(obj.notasFijas, "notasFijas", ctx),
    dias,
    batch,
  };
}

// ---------- Lista del súper ----------

function validarLista(obj, ctx) {
  const inicio = obj.semana?.inicio;
  if (!isISODate(inicio)) {
    ctx.errores.push(`Falta semana.inicio, la fecha del lunes de esa semana (como "2026-10-19")${inicio ? `; está como "${inicio}"` : ""}.`);
  }
  const rawItems = list(obj.items, "items", ctx, { required: true });
  if (Array.isArray(obj.items) && rawItems.length === 0) ctx.errores.push("La lista items está vacía.");

  const ids = new Set();
  const items = rawItems.flatMap((item, i) => {
    if (!item || !isText(item.nombre)) {
      ctx.errores.push(`Artículo ${i + 1}: falta el campo nombre.`);
      return [];
    }
    // El id sale del nombre: así, al reimportar, lo que ya palomeaste sigue palomeado.
    let id = slug(item.nombre) || `item-${i + 1}`;
    for (let n = 2; ids.has(id); n++) id = `${slug(item.nombre)}-${n}`;
    ids.add(id);
    return [
      {
        id,
        seccion: text(item.seccion) || "Otros",
        nombre: text(item.nombre),
        cantidad: text(item.cantidad),
        super: text(item.super),
        probablementeYaTengo: item.probablementeYaTengo === true,
      },
    ];
  });

  return {
    tipo: "lista",
    semanaInicio: inicio,
    totalEstimado: number(obj.totalEstimado, "totalEstimado", ctx),
    items,
  };
}

// ---------- Recetario ----------

function validarRecetario(obj, ctx) {
  const rawRecetas = list(obj.recetas, "recetas", ctx, { required: true });
  if (Array.isArray(obj.recetas) && rawRecetas.length === 0) ctx.errores.push("La lista recetas está vacía.");

  const categorias = CATEGORIAS.map((c) => c.id);
  const ids = new Set();
  const recetas = rawRecetas.flatMap((r, i) => {
    if (!r || !isText(r.id)) {
      ctx.errores.push(`Receta ${i + 1}${r && isText(r.nombre) ? ` (${r.nombre})` : ""}: falta el campo id.`);
      return [];
    }
    const where = `Receta "${r.id}"`;
    if (ids.has(r.id)) {
      ctx.errores.push(`${where}: el id aparece dos veces.`);
      return [];
    }
    ids.add(r.id);
    if (!isText(r.nombre)) ctx.errores.push(`${where}: falta el campo nombre.`);
    if (!categorias.includes(r.categoria)) {
      ctx.errores.push(`${where}: categoria debe ser una de: ${categorias.join(", ")}${r.categoria ? ` (está como "${r.categoria}")` : ""}.`);
    }
    const aparato = typeof r.aparato === "string" ? [r.aparato] : textList(r.aparato, `${where}: aparato`, ctx);
    return [
      {
        id: text(r.id),
        nombre: text(r.nombre),
        categoria: r.categoria,
        emoji: text(r.emoji),
        macros: macros(r.macros, where, ctx),
        tiempoActivoMin: number(r.tiempoActivoMin, `${where}: tiempoActivoMin`, ctx),
        aparato,
        batch: r.batch === true,
        tupper: r.tupper === true,
        hierro: r.hierro === true,
        ingredientes: ingredientes(r.ingredientes, where, ctx),
        pasos: textList(r.pasos, `${where}: pasos`, ctx),
        fuente: text(r.fuente),
        imagenUrl: text(r.imagenUrl),
      },
    ];
  });

  return { tipo: "recetario", version: text(obj.version), recetas };
}

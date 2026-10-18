// Respaldo: todos tus datos (con las fotos) en un archivo JSON, para no perder nada si se borra Safari
// o cambias de teléfono. El archivo es tuyo: nunca se sube a ningún lado.

import { db, STORES } from "./db.js";
import { todayISO } from "./logic/fechas.js";
import { APP_VERSION } from "./version.js";

const FORMAT = 1;
const KEYED = ["kv", "checks", "fotos"]; // tablas sin clave dentro del valor: se guardan como [clave, valor]

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportAll() {
  const data = {};
  for (const store of STORES) {
    if (KEYED.includes(store)) {
      const [keys, values] = await Promise.all([db.getAllKeys(store), db.getAll(store)]);
      data[store] = keys.map((k, i) => [k, values[i]]);
    } else {
      data[store] = await db.getAll(store);
    }
  }
  // Las fotos van dentro del archivo, como texto (base64).
  data.fotos = await Promise.all(data.fotos.map(async ([id, foto]) => [id, { ...foto, blob: await blobToDataURL(foto.blob) }]));
  return { app: "sous", tipo: "respaldo", formato: FORMAT, version: APP_VERSION, creado: new Date().toISOString(), data };
}

// Guarda el archivo: en el iPhone abre "Compartir" (Guardar en Archivos, AirDrop…).
export async function exportBackup() {
  const json = await exportAll();
  const name = `sous-respaldo-${todayISO()}.json`;
  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Respaldo de Sous" });
    } catch (error) {
      if (error.name === "AbortError") return false; // la cerraste sin guardar
      throw error;
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await db.put("kv", new Date().toISOString(), "ultimoRespaldo");
  return true;
}

// Lee y revisa un archivo de respaldo. Devuelve el contenido o lanza un error con un mensaje claro.
export async function readBackup(file) {
  let json;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("Ese archivo no es un respaldo de Sous.");
  }
  if (json?.app !== "sous" || json.tipo !== "respaldo" || typeof json.data !== "object") {
    throw new Error("Ese archivo no es un respaldo de Sous.");
  }
  if (json.formato > FORMAT) throw new Error("Ese respaldo es de una versión más nueva de Sous. Actualiza la app primero.");
  return json;
}

// Cuánto trae, para confirmarlo antes de reemplazar.
export function describeBackup(json) {
  const d = json.data;
  return {
    creado: json.creado,
    semanas: d.semanas?.length || 0,
    recetas: d.recetas?.length || 0,
    fotos: d.fotos?.length || 0,
  };
}

// Reemplaza todos tus datos por los del respaldo, en un solo paso: si algo falla, no queda a medias.
export async function restoreBackup(json) {
  const fotos = await Promise.all(
    (json.data.fotos || []).map(async ([id, foto]) => [id, { ...foto, blob: await (await fetch(foto.blob)).blob() }]),
  );
  const data = { ...json.data, fotos };
  await db.transaction(STORES, (stores) => {
    for (const store of STORES) {
      stores[store].clear();
      for (const record of data[store] || []) {
        if (KEYED.includes(store)) stores[store].put(record[1], record[0]);
        else stores[store].put(record);
      }
    }
  });
}

export async function lastBackup() {
  return db.get("kv", "ultimoRespaldo");
}

// Acceso a IndexedDB, la base de datos local del navegador.
// Todas las tablas se crean desde ya para no tener que migrar datos más adelante.

// Nombre interno: no cambiarlo al renombrar la app, o los datos guardados quedarían en la base anterior.
const DB_NAME = "sous";
const DB_VERSION = 1;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("kv"); // versión del recetario y otros ajustes
        db.createObjectStore("semanas", { keyPath: "inicio" }); // menú importado + intercambios
        db.createObjectStore("marcas", { keyPath: "clave" }).createIndex("fecha", "fecha"); // clave "fecha|momento"
        db.createObjectStore("checks"); // pasos del batch y artículos del súper palomeados
        db.createObjectStore("listas", { keyPath: "semanaInicio" });
        db.createObjectStore("recetas", { keyPath: "id" });
        db.createObjectStore("fotos"); // clave: id de la receta (aparte, para que importar nunca las borre)
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // Pide al sistema que no borre estos datos para liberar espacio.
    navigator.storage?.persist?.();
  }
  return dbPromise;
}

async function run(storeName, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const STORES = ["kv", "semanas", "marcas", "checks", "listas", "recetas", "fotos"];

export const db = {
  get: (store, key) => run(store, "readonly", (s) => s.get(key)),
  getAll: (store) => run(store, "readonly", (s) => s.getAll()),
  getAllKeys: (store) => run(store, "readonly", (s) => s.getAllKeys()),
  put: (store, value, key) => run(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  delete: (store, key) => run(store, "readwrite", (s) => s.delete(key)),
  clear: (store) => run(store, "readwrite", (s) => s.clear()),

  // Varios cambios juntos: o se guardan todos o ninguno (si algo falla, no queda a medias).
  // write recibe { semanas: objectStore, ... } y hace put/delete sin esperar.
  async transaction(storeNames, write) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeNames, "readwrite");
      const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
      write(stores);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("No se guardó"));
    });
  },
};

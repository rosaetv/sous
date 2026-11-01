// Acceso a IndexedDB, la base de datos local del navegador.
// Todas las tablas se crean desde ya para no tener que migrar datos más adelante.

// Nombre interno: no cambiarlo al renombrar la app, o los datos guardados quedarían en la base anterior.
const DB_NAME = "show-up";
const DB_VERSION = 1;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("kv"); // ajustes, plan, favoritos, notas
        db.createObjectStore("exercises", { keyPath: "id" }); // ejercicios propios
        db.createObjectStore("workouts", { keyPath: "id" }).createIndex("finishedAt", "finishedAt");
        db.createObjectStore("measurements", { keyPath: "id" }).createIndex("date", "date");
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

export const STORES = ["kv", "exercises", "workouts", "measurements"];

export const db = {
  get: (store, key) => run(store, "readonly", (s) => s.get(key)),
  getAll: (store) => run(store, "readonly", (s) => s.getAll()),
  getAllKeys: (store) => run(store, "readonly", (s) => s.getAllKeys()),
  put: (store, value, key) => run(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  delete: (store, key) => run(store, "readwrite", (s) => s.delete(key)),
  clear: (store) => run(store, "readwrite", (s) => s.clear()),
};

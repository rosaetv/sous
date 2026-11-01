// Idioma de la app (español / inglés).
// Por defecto usa el idioma del teléfono; en Perfil se puede elegir uno fijo.
// Los textos están en js/i18n/es.js y js/i18n/en.js.

import { ES } from "./i18n/es.js";
import { EN } from "./i18n/en.js";

const STRINGS = { es: ES, en: EN };
let current = "es";

/** preference: "auto", "es" o "en" */
export function setLanguage(preference) {
  if (preference === "es" || preference === "en") current = preference;
  else current = (navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en";
  document.documentElement.lang = current;
}

export const lang = () => current;

// Para fechas: "domingo, 11 de octubre" / "Sunday, October 11".
export const locale = () => (current === "es" ? "es" : "en-US");

/**
 * Texto traducido. Admite parámetros: t("hola", { name: "Ana" }) con "Hola, {name}".
 * Si el texto es una función (para plurales), se llama con los parámetros.
 */
export function t(key, params = {}) {
  return tIn(current, key, params);
}

export function tIn(language, key, params = {}) {
  const value = STRINGS[language][key] ?? STRINGS.es[key];
  if (value === undefined) {
    console.warn(`Falta el texto "${key}"`);
    return key;
  }
  if (typeof value === "function") return value(params);
  return value.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

// Todas las claves (para revisar que ambos idiomas estén completos).
export const allKeys = () => ({ es: Object.keys(ES), en: Object.keys(EN) });

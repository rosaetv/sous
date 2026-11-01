// Modo claro / oscuro. Por defecto sigue al teléfono; en Perfil se puede fijar uno.
// Los colores de cada modo están en css/theme.css.

const media = matchMedia("(prefers-color-scheme: dark)");
let preference = "auto";

/** pref: "auto", "light" o "dark" */
export function applyTheme(pref = "auto") {
  preference = pref;
  const resolved = pref === "light" || pref === "dark" ? pref : media.matches ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  // Copia rápida para aplicar el tema antes de que cargue la app (ver index.html).
  try {
    localStorage.setItem("theme-pref", pref);
  } catch {}
  // Color de la barra de estado del iPhone = fondo de la app.
  const background = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
}

// Si el teléfono cambia de modo y la app está en automático, se actualiza sola.
media.addEventListener("change", () => {
  if (preference === "auto") applyTheme("auto");
});

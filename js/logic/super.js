// Agrupa la lista del súper por sección, en el orden en que vienen.
// Nada cambia de lugar al palomear (así no se palomea algo por error porque la lista se movió).
//
// Estado de cada artículo:
//   ""        pendiente
//   "parcial" llevas una parte (se queda arriba, para comprar el resto)
//   "todo"    comprado
//   "nohabia" no había (baja con lo comprado)

const RESOLVED = new Set(["todo", "nohabia"]);

// Lo guardado (true o { estado, llevo }) → { estado, llevo }
export function itemState(value) {
  if (!value) return { estado: "", llevo: "" };
  if (value === true) return { estado: "todo", llevo: "" };
  return { estado: value.estado || "todo", llevo: value.llevo || "" };
}

export function supersOf(items) {
  return [...new Set(items.map((i) => i.super).filter(Boolean))];
}

// states: Map de id → valor guardado. superFilter: "" para todos.
export function groupList(items, states, superFilter = "") {
  const visible = items.filter((i) => !superFilter || !i.super || i.super === superFilter);
  const withState = visible.map((i) => ({ ...i, ...itemState(states.get(i.id)) }));

  const sections = [];
  for (const item of withState.filter((i) => !i.probablementeYaTengo)) {
    let section = sections.find((s) => s.seccion === item.seccion);
    if (!section) sections.push((section = { seccion: item.seccion, items: [] }));
    section.items.push(item);
  }
  for (const section of sections) section.done = section.items.every((i) => RESOLVED.has(i.estado));

  const toBuy = withState.filter((i) => !i.probablementeYaTengo);
  return {
    sections,
    maybe: withState.filter((i) => i.probablementeYaTengo),
    counts: {
      done: toBuy.filter((i) => RESOLVED.has(i.estado)).length,
      partial: toBuy.filter((i) => i.estado === "parcial").length,
      total: toBuy.length,
    },
  };
}

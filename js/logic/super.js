// Ordena la lista del súper para comprar: por sección (en el orden en que vienen),
// lo pendiente arriba y lo resuelto abajo; las secciones terminadas bajan al final.
//
// Estado de cada artículo:
//   ""        pendiente
//   "parcial" llevas una parte (se queda arriba, para comprar el resto)
//   "todo"    comprado
//   "nohabia" no había (baja con lo comprado)

const RESOLVED = new Set(["todo", "nohabia"]);
const rank = (estado) => (estado === "parcial" ? 0 : RESOLVED.has(estado) ? 2 : 1);

// Lo guardado (true o { estado, llevo }) → { estado, llevo }
export function itemState(value) {
  if (!value) return { estado: "", llevo: "" };
  if (value === true) return { estado: "todo", llevo: "" };
  return { estado: value.estado || "todo", llevo: value.llevo || "" };
}

export function supersOf(items) {
  return [...new Set(items.map((i) => i.super).filter(Boolean))];
}

const byRank = (list) => list.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.estado) - rank(b.item.estado) || a.i - b.i).map((x) => x.item);

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
  for (const section of sections) {
    section.items = byRank(section.items);
    section.done = section.items.every((i) => RESOLVED.has(i.estado));
  }

  const toBuy = withState.filter((i) => !i.probablementeYaTengo);
  return {
    sections: [...sections.filter((s) => !s.done), ...sections.filter((s) => s.done)],
    maybe: byRank(withState.filter((i) => i.probablementeYaTengo)),
    counts: {
      done: toBuy.filter((i) => RESOLVED.has(i.estado)).length,
      partial: toBuy.filter((i) => i.estado === "parcial").length,
      total: toBuy.length,
    },
  };
}

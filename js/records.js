// Récords personales por ejercicio.
//
// Un récord es superar tu peso máximo, o hacer más repeticiones con ese mismo peso.
// En ejercicios sin peso (peso corporal, bandas, planchas) cuentan las repeticiones
// o los segundos. La primera vez que haces un ejercicio no cuenta como récord.
// Los ejercicios asistidos no tienen récords (ahí menos peso es más difícil).
// Todos los pesos están en kg, como se guardan.

const SAME = 0.01; // margen para comparar pesos con decimales

/**
 * Mejores marcas de un ejercicio en tu historial.
 * sessions: [{ date, sets: [{ weight, reps }] }]
 * Devuelve null si no hay historial, o:
 *   { heaviest: { weight, reps, date }, mostReps: { weight, reps, date } }
 */
export function bestMarks(sessions) {
  let heaviest = null;
  let mostReps = null;
  for (const { date, sets } of sessions) {
    for (const s of sets) {
      if (!heaviest || s.weight > heaviest.weight + SAME || (Math.abs(s.weight - heaviest.weight) <= SAME && s.reps > heaviest.reps)) {
        heaviest = { weight: s.weight, reps: s.reps, date };
      }
      if (!mostReps || s.reps > mostReps.reps || (s.reps === mostReps.reps && s.weight > mostReps.weight + SAME)) {
        mostReps = { weight: s.weight, reps: s.reps, date };
      }
    }
  }
  return heaviest ? { heaviest, mostReps } : null;
}

// ¿Esta serie supera la marca anterior?
function beats(set, best) {
  if (best.heaviest.weight > SAME || set.weight > SAME) {
    if (set.weight > best.heaviest.weight + SAME) return true;
    return Math.abs(set.weight - best.heaviest.weight) <= SAME && set.reps > best.heaviest.reps;
  }
  return set.reps > best.mostReps.reps;
}

/**
 * Récord de un ejercicio en la sesión de hoy.
 * sets: series hechas hoy, en kg. best: bestMarks() del historial anterior.
 * Devuelve null o { set: la mejor serie de hoy, previous: la marca que superó }.
 */
export function sessionRecord(exercise, sets, best) {
  if (!best || !sets.length || exercise?.assisted) return null;
  const top = bestMarks([{ sets }]);
  const set = best.heaviest.weight > SAME || top.heaviest.weight > SAME ? top.heaviest : top.mostReps;
  if (!beats(set, best)) return null;
  const previous = set.weight > SAME ? best.heaviest : best.mostReps;
  return { set, previous };
}

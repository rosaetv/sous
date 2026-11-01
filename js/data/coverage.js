// Cobertura semanal: músculos que el plan no debe dejar desatendidos.
//
// Un músculo cuenta como trabajado en la semana si es el PRINCIPAL de al menos
// un ejercicio, o SECUNDARIO en al menos 2 ejercicios combinados.
// "direct: true" exige al menos un ejercicio donde sea el principal.
//
// region: qué tipo de día puede recibir el ejercicio que falte.
// patterns: tipos de movimiento preferidos para cubrirlo, en orden.

export const WEEKLY_COVERAGE = [
  // Brazos primero: suelen ser lo primero que el tiempo recorta.
  { muscle: "biceps", region: "pull", patterns: ["biceps"], direct: true },
  { muscle: "triceps", region: "push", patterns: ["triceps"], direct: true },

  // Piernas
  { muscle: "cuadriceps", region: "legs", patterns: ["squat", "knee_ext", "lunge"] },
  { muscle: "isquios", region: "legs", patterns: ["knee_flex", "hinge"] },
  { muscle: "gluteos", region: "legs", patterns: ["hip_thrust", "hinge", "lunge"] },
  { muscle: "pantorrillas", region: "legs", patterns: ["calf"] },
  { muscle: "aductores", region: "legs", patterns: ["adduction", "squat", "lunge"] },

  // Empuje
  { muscle: "pecho", region: "push", patterns: ["h_push", "fly"] },
  { muscle: "hombro_frontal", region: "push", patterns: ["v_push", "h_push"] },
  { muscle: "hombro_lateral", region: "push", patterns: ["lateral", "v_push"] },

  // Jalón
  { muscle: "dorsales", region: "pull", patterns: ["v_pull", "h_pull"] },
  { muscle: "espalda_media", region: "pull", patterns: ["h_pull", "rear_delt"] },
  { muscle: "trapecio", region: "pull", patterns: ["rear_delt", "lateral", "hinge"] },
  { muscle: "hombro_posterior", region: "pull", patterns: ["rear_delt"] },

  // Core
  { muscle: "abdomen", region: "core", patterns: ["core"] },
  { muscle: "oblicuos", region: "core", patterns: ["core"] },
  { muscle: "lumbares", region: "core", patterns: ["hinge"] },
];

// Movimientos que identifican cada tipo de día ("core" vale en cualquier día).
export const REGIONS = {
  legs: ["squat", "hinge", "lunge", "hip_thrust", "knee_ext", "knee_flex", "calf", "abduction", "adduction"],
  push: ["h_push", "v_push", "fly", "lateral", "triceps"],
  pull: ["h_pull", "v_pull", "rear_delt", "biceps"],
  core: null,
};

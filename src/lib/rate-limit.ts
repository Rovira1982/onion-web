import "server-only";

// Limitador en memoria, por clave (normalmente IP). Vale para una sola
// réplica (confirmado por Guardian, 2026-10-02: numReplicas=1 en Railway);
// se reinicia si el proceso se reinicia, lo cual es aceptable aquí porque el
// objetivo es frenar un bucle automatizado, no dar una garantía dura. Si
// algún día hay más de una réplica, esto deja de ser preciso entre
// instancias y habría que pasar a Redis/KV. Parche de seguridad, Guardian
// P6, 2026-10-02.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    // poda ocasional para no crecer sin límite
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return arr.length > maxHits;
}

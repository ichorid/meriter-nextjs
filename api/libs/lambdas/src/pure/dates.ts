const s = 1000;
const m = 60 * s;
const h = 60 * m;
const d = 24 * h;

export function dateGenerateInPast(days: number, minutes?: number) {
  return new Date(Date.now() - days * d - (minutes ?? 0) * m);
}
export function dateGenerateInFuture(days: number, minutes?: number) {
  return new Date(Date.now() + days * d - (minutes ?? 0) * m);
}

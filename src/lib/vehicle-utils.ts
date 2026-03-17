/** Convert speed from knots to km/h */
export function knotsToKmh(knots: number): number {
  return Math.round(knots * 1.852);
}

/** Parse ignition value robustly from various Traccar formats */
export function parseIgnition(value: unknown): boolean | null {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

/** Check if ignition is ON (returns false for null/undefined) */
export function isIgnitionOn(value: unknown): boolean {
  return parseIgnition(value) === true;
}

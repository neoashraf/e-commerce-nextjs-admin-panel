/** Report date helpers — ISO yyyy-mm-dd math for the period controls. */

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Max custom span the BE accepts, mirrored client-side (FR-RPT-072 / validation). */
export const MAX_RANGE_DAYS = 366;

export function rangeError(from: string, to: string): string | null {
  if (!from || !to) return null;
  if (from > to) return "Start date must be before end date.";
  const days =
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  if (days > MAX_RANGE_DAYS) return `Range too large (max ${MAX_RANGE_DAYS} days).`;
  return null;
}

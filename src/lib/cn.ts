/**
 * Tiny className combiner for the UI primitives. Falsy values are dropped so
 * conditional classes read cleanly: cn("base", active && "active", className).
 * Kept dependency-free (no clsx/tailwind-merge) — primitives keep their class
 * sets non-overlapping, callers append with `className`.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

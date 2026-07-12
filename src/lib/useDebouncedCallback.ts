"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a stable, debounced version of `fn` that fires `delay` ms after the
 * last call. Used by list search inputs so each keystroke doesn't refetch — the
 * call lands once typing pauses. The latest `fn` is always invoked (kept in a
 * ref), and any pending timer is cleared on unmount.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300,
): (...args: A) => void {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  };
}

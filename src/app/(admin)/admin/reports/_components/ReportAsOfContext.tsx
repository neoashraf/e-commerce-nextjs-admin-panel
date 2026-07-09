"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Lets a report body publish its `as_of` timestamp (known only after the data
 * fetch) up to the filter row, which renders above the body. The Sales design
 * (C2 "Controls row") shows the "as of …" stamp at the right end of the filter
 * row — see `Reports - Sales (RPT).dc.html`. Bodies that don't set it leave the
 * stamp absent, so the row degrades cleanly for every other report tab.
 */

interface ReportAsOfValue {
  asOf?: string;
  setAsOf: (value?: string) => void;
}

const ReportAsOfContext = createContext<ReportAsOfValue | null>(null);

export function ReportAsOfProvider({ children }: { children: React.ReactNode }) {
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  const value = useMemo(() => ({ asOf, setAsOf }), [asOf]);
  return (
    <ReportAsOfContext.Provider value={value}>
      {children}
    </ReportAsOfContext.Provider>
  );
}

/** Read the published `as_of` (for the filter row). Null outside a provider. */
export function useReportAsOf(): string | undefined {
  return useContext(ReportAsOfContext)?.asOf;
}

/** Publish a body's `as_of` to the filter row; clears it on unmount. */
export function usePublishAsOf(value?: string): void {
  const ctx = useContext(ReportAsOfContext);
  const setAsOf = ctx?.setAsOf;
  useEffect(() => {
    if (!setAsOf) return;
    setAsOf(value);
    return () => setAsOf(undefined);
  }, [setAsOf, value]);
}

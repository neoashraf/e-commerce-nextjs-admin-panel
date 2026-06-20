import { z } from "zod";
import { api } from "@/lib/api/client";
import { paginated } from "@/lib/api/schemas/pagination";

/**
 * Client-side CSV export helpers. The async reports-export pipeline
 * (POST /admin/reports/export) is unreliable, so list pages build the CSV in the browser:
 * fetch every page of the (filtered) list, then serialize + download. No backend job, always works.
 */

/**
 * Fetch every page of a paginated `{ data, meta }` list endpoint (capped to avoid runaway loops).
 * Generic over the list (array) schema so transformed row schemas keep their output type.
 */
export async function fetchAllRows<S extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  listSchema: S,
  pageSize = 100,
): Promise<z.infer<S>> {
  const pageSchema = paginated(listSchema);
  // Drop empty/undefined filters so we never send `status=` (which some DTOs reject).
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  const out: unknown[] = [];
  let page = 1;
  for (let guard = 0; guard < 200; guard++) {
    const res = (await api.get(path, {
      params: { ...clean, page, limit: pageSize },
      rawEnvelope: true,
      schema: pageSchema,
    })) as { data: unknown[]; meta: { total: number } };
    out.push(...res.data);
    if (out.length >= res.meta.total || res.data.length < pageSize) break;
    page += 1;
  }
  return out as z.infer<S>;
}

/** Serialize a table to RFC-4180 CSV with a UTF-8 BOM (Excel/Bangla-safe). */
export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((r) => r.map(esc).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** YYYY-MM-DD for export filenames (browser-local date). */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

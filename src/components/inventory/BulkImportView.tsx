"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Upload,
  UploadCloud,
} from "lucide-react";
import { useBulkInventory, type BulkResult } from "@/lib/api/hooks/useInventory";
import { Can } from "@/lib/permissions/Can";
import {
  Badge,
  Button,
  Card,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { STOCK_MUTATE_PERMISSION } from "@/app/(admin)/admin/inventory/_components/shared";

/**
 * Bulk stock update wizard (inv-bulk-fe; design Bulk Stock Update (INV).dc.html).
 * Upload → Preview → Results: drop a CSV (sku_code,set_on_hand,
 * low_stock_threshold,reason), validate each row client-side, apply via
 * POST /admin/inventory/bulk, then a per-row results report. Re-skinned to the
 * design system (AD6); the apply logic is server-authoritative and untouched.
 */
type Payload = {
  sku_code: string;
  set_on_hand?: number;
  low_stock_threshold?: number;
  reason?: string;
};
type ParsedRow = Payload & { row: number; error?: string };
type Mode = "continue" | "all";
type Step = "upload" | "preview" | "results";

const COLUMNS = [
  { name: "sku_code", desc: "The variant SKU to update (required)." },
  { name: "set_on_hand", desc: "Absolute on-hand to set (whole number ≥ 0)." },
  { name: "low_stock_threshold", desc: "Low-stock threshold (whole number ≥ 0)." },
  { name: "reason", desc: "Why stock is changing (recommended)." },
];

const TEMPLATE =
  "sku_code,set_on_hand,low_stock_threshold,reason\nPRED-BLK-42,30,5,stock_take_2026Q2\n";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse + client-validate the CSV. Server-only errors (unknown SKU / would-go
 * negative) surface in the Results step, not here. */
function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const start = /sku/i.test(lines[0]) && /on_hand|threshold/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map((line, i) => {
    const [sku, on, thr, reason] = line.split(",").map((c) => c.trim());
    const r: ParsedRow = { row: start + i + 1, sku_code: sku ?? "" };
    if (on !== "" && on != null) r.set_on_hand = Number(on);
    if (thr !== "" && thr != null) r.low_stock_threshold = Number(thr);
    if (reason) r.reason = reason;

    if (!r.sku_code) r.error = "Missing sku_code";
    else if (r.set_on_hand !== undefined && !Number.isInteger(r.set_on_hand))
      r.error = "Quantity must be a whole number";
    else if (r.set_on_hand !== undefined && r.set_on_hand < 0)
      r.error = "Quantity can't be negative";
    else if (r.low_stock_threshold !== undefined && (!Number.isInteger(r.low_stock_threshold) || r.low_stock_threshold < 0))
      r.error = "Threshold must be a whole number ≥ 0";
    else if (r.set_on_hand === undefined && r.low_stock_threshold === undefined)
      r.error = "Nothing to update";
    return r;
  });
}

const StepRail = ({ step }: { step: Step }) => {
  const defs: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "preview", label: "Preview" },
    { key: "results", label: "Results" },
  ];
  const idx = defs.findIndex((d) => d.key === step);
  return (
    <ol className="flex items-center gap-2">
      {defs.map((d, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={d.key} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                state === "current" && "bg-accent-600 text-accent-fg",
                state === "done" && "bg-accent-50 text-accent-700",
                state === "todo" && "bg-surface-subtle text-text-faint",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                state === "todo" ? "text-text-faint" : "text-text",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              {d.label}
            </span>
            {i < defs.length - 1 && <span className="mx-1 h-px w-8 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
};

export function BulkImportView() {
  const bulk = useBulkInventory();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mode, setMode] = useState<Mode>("continue");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputId = useId();
  const dropRef = useRef<HTMLLabelElement>(null);

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);

  // Warn on leaving mid-upload (a file is staged but not yet applied).
  useEffect(() => {
    if (step !== "preview") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  const ingest = useCallback((file: File) => {
    setParseError(null);
    if (!/\.csv$/i.test(file.name)) {
      setParseError("That doesn't look like a .csv file. Use the template.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length === 0) {
        setParseError("We couldn't read any rows. Use the template.");
        return;
      }
      setFileName(file.name);
      setRows(parsed);
      setStep("preview");
    };
    reader.onerror = () => setParseError("We couldn't read this file. Use the template.");
    reader.readAsText(file);
  }, []);

  function reset() {
    setStep("upload");
    setFileName(null);
    setRows([]);
    setResult(null);
    setParseError(null);
    bulk.reset();
  }

  async function apply() {
    if (validRows.length === 0) return;
    const payload: Payload[] = validRows.map((r) => ({
      sku_code: r.sku_code,
      ...(r.set_on_hand !== undefined ? { set_on_hand: r.set_on_hand } : {}),
      ...(r.low_stock_threshold !== undefined ? { low_stock_threshold: r.low_stock_threshold } : {}),
      ...(r.reason !== undefined ? { reason: r.reason } : {}),
    }));
    try {
      const res = (await bulk.mutateAsync(payload)) as BulkResult;
      setResult(res);
      setStep("results");
    } catch {
      // bulk.isError surfaces the retry affordance below.
    }
  }

  const allOrNothingBlocked = mode === "all" && invalidRows.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <nav className="mb-1 text-sm text-text-muted">
          <Link href="/admin/inventory" className="hover:text-accent-700 hover:underline">
            Inventory
          </Link>
          <span className="px-1.5 text-text-faint">›</span>
          <span className="text-text-secondary">Bulk update</span>
        </nav>
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-text">Bulk stock update</h1>
      </div>

      <StepRail step={step} />

      <Can
        permission={STOCK_MUTATE_PERMISSION}
        fallback={
          <Card className="p-0">
            <div className="px-6 py-12 text-center text-sm text-text-muted">
              You don&apos;t have permission to bulk-update stock.
            </div>
          </Card>
        }
      >
        {step === "upload" && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-text">How it works</h2>
              <p className="mt-1 text-sm text-text-muted">
                Upload a CSV with one row per SKU. Each row is validated before anything is applied.
              </p>
              <dl className="mt-4 space-y-2.5">
                {COLUMNS.map((c) => (
                  <div key={c.name} className="flex gap-3">
                    <dt className="shrink-0">
                      <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                        {c.name}
                      </code>
                    </dt>
                    <dd className="text-sm text-text-muted">{c.desc}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => downloadCsv("stock-update-template.csv", TEMPLATE)}
                leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Download CSV template
              </Button>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-accent-600" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-text">Upload your file</h2>
              </div>
              <label
                ref={dropRef}
                htmlFor={fileInputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  dropRef.current?.classList.add("border-accent-600", "bg-accent-50");
                }}
                onDragLeave={() => dropRef.current?.classList.remove("border-accent-600", "bg-accent-50")}
                onDrop={(e) => {
                  e.preventDefault();
                  dropRef.current?.classList.remove("border-accent-600", "bg-accent-50");
                  const f = e.dataTransfer.files?.[0];
                  if (f) ingest(f);
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-strong px-6 py-10 text-center transition-colors hover:bg-surface-subtle"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-accent-600">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="mt-3 text-sm font-medium text-text">
                  Drag &amp; drop your CSV here, or browse
                </span>
                <span className="mt-1 text-xs text-text-faint">.csv up to ~5 MB</span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) ingest(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {parseError && (
                <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-error">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {parseError}
                </p>
              )}
            </Card>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text">
                <FileText className="h-4 w-4 text-text-muted" aria-hidden="true" />
                {fileName}
                <span className="text-text-faint tabular-nums">· {rows.length} rows</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                onClick={reset}
                leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
              >
                Upload another file
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="success" className="rounded-full px-2.5 py-0.5 text-[12.5px]">
                {validRows.length} valid
              </Badge>
              <Badge tone="error" className="rounded-full px-2.5 py-0.5 text-[12.5px]">
                {invalidRows.length} invalid
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-eyebrow uppercase tracking-wide text-text-faint">Errors</span>
                <div role="radiogroup" aria-label="Error handling mode" className="inline-flex items-center gap-1 rounded-md bg-surface-subtle p-1">
                  {([
                    { key: "continue", label: "Continue on error" },
                    { key: "all", label: "All-or-nothing" },
                  ] as const).map((m) => {
                    const on = mode === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setMode(m.key)}
                        className={cn(
                          "rounded-[6px] px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600",
                          on ? "bg-surface text-text shadow-xs" : "text-text-muted hover:text-text-secondary",
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              <Table className="min-w-[820px]">
                <caption className="sr-only">
                  Parsed CSV rows with per-row validation. {validRows.length} valid, {invalidRows.length} invalid.
                </caption>
                <THead>
                  <TR hover={false}>
                    <TH numeric className="w-14">Row</TH>
                    <TH>sku_code</TH>
                    <TH numeric>set_on_hand</TH>
                    <TH numeric>threshold</TH>
                    <TH>reason</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.row}>
                      <TD numeric className="text-text-muted">{r.row}</TD>
                      <TD className="font-mono text-xs text-text">{r.sku_code || "—"}</TD>
                      <TD numeric>{r.set_on_hand ?? "—"}</TD>
                      <TD numeric>{r.low_stock_threshold ?? "—"}</TD>
                      <TD className="text-text-muted">{r.reason ?? "—"}</TD>
                      <TD>
                        {r.error ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-error-50 px-2 py-0.5 text-[11.5px] font-semibold text-error">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {r.error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-success-50 px-2 py-0.5 text-[11.5px] font-semibold text-success">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Valid
                          </span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <p className="max-w-lg text-[12.5px] text-text-muted">
                {allOrNothingBlocked
                  ? "All-or-nothing mode: fix the invalid rows before applying, or switch to Continue on error."
                  : "Unknown SKUs and changes that would make on-hand negative are rejected by the server and reported below."}
              </p>
              {bulk.isError && (
                <span role="alert" className="text-sm text-error">
                  The import didn&apos;t complete. Try again.
                </span>
              )}
              <Button
                className="ml-auto"
                onClick={apply}
                disabled={validRows.length === 0 || allOrNothingBlocked || bulk.isPending}
                loading={bulk.isPending}
                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              >
                Apply {validRows.length} rows
              </Button>
            </div>
          </div>
        )}

        {step === "results" && result && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    result.failed === 0 ? "bg-success-50 text-success" : "bg-warning-50 text-warning",
                  )}
                >
                  {result.failed === 0 ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-text">
                    {result.succeeded} of {result.processed} rows updated.{" "}
                    {result.failed > 0 && `${result.failed} failed.`}
                  </h2>
                  <p className="mt-1 text-sm text-text-muted">
                    Each updated SKU now has a correction movement in its ledger. Failed rows were skipped
                    and left unchanged.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-50 px-2.5 py-1 text-[12.5px] font-semibold text-success">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {result.succeeded} updated
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-error-50 px-2.5 py-1 text-[12.5px] font-semibold text-error">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {result.failed} failed
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text">Failed rows</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        "stock-update-errors.csv",
                        "row,sku_code,error\n" +
                          result.errors
                            .map((e) => `${e.row},${e.sku_code ?? ""},"${e.error.replace(/"/g, '""')}"`)
                            .join("\n"),
                      )
                    }
                    leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
                  >
                    Download error rows
                  </Button>
                </div>
                <Card className="overflow-hidden p-0">
                  <Table className="min-w-[560px]">
                    <caption className="sr-only">Rows that failed to import, with the reason.</caption>
                    <THead>
                      <TR hover={false}>
                        <TH numeric className="w-16">Row</TH>
                        <TH>sku_code</TH>
                        <TH>Error</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {result.errors.map((e, i) => (
                        <TR key={i}>
                          <TD numeric className="text-text-muted">{e.row}</TD>
                          <TD className="font-mono text-xs text-text-secondary">{e.sku_code ?? "—"}</TD>
                          <TD className="text-error">{e.error}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </Card>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/inventory"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-600 px-5 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                View stock
              </Link>
              <Button variant="secondary" onClick={reset} leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}>
                Upload another file
              </Button>
            </div>
          </div>
        )}
      </Can>
    </div>
  );
}

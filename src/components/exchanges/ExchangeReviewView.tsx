"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useExchange,
  useDecideExchange,
  useIssueExchange,
} from "@/lib/api/hooks/exchanges";
import {
  REJECTION_REASONS,
  DISPOSITIONS,
  type Disposition,
} from "@/lib/api/schemas/exchanges";
import { Can } from "@/lib/permissions/Can";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { ApiError } from "@/lib/api/errors";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { resolveMediaUrl } from "@/lib/media";
import { ReplacementPicker } from "./ReplacementPicker";

/**
 * Exchange review (ord-exchange-admin-fe, AC2/AC3, FR-ORD-046–049).
 * Request + evidence + eligibility + QA (defects) → approve/reject (+ reason)
 * → issue equal/higher-value replacement (disposition + difference-paid gate).
 * Server-confirmed throughout; eligibility/QA/value/difference-payment are
 * authoritative on the BE. 409s (lower-value / unpaid difference / out-of-stock)
 * are mapped to clear, blocking messages.
 */
const humanize = (s: string) => s.replace(/_/g, " ");

/** Map an issue 409 (or other ApiError) to operator-facing copy. */
function issueErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const c = `${err.code} ${err.message}`.toLowerCase();
    if (c.includes("lower")) return "Lower-value replacements aren't allowed — no cash is refunded for the difference.";
    if (c.includes("stock")) return "That replacement variant is out of stock. Choose another item or hold the request.";
    if (c.includes("difference") || c.includes("unpaid") || c.includes("payment"))
      return "The customer must pay the price difference before you can issue the replacement.";
    if (err.status === 409) return err.message || "This replacement can't be issued.";
    return err.message || "Couldn't issue the replacement. Try again.";
  }
  return "Couldn't issue the replacement. Try again.";
}

export function ExchangeReviewView({ id }: { id: string }) {
  const { data, isLoading, isError } = useExchange(id);
  const decide = useDecideExchange(id);
  const issue = useIssueExchange(id);
  const { can } = usePermissions();

  // Decision form
  const [decision, setDecision] = useState<"approve" | "reject" | "">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [qaConfirmed, setQaConfirmed] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Issue form
  const [variantId, setVariantId] = useState<string | null>(null);
  const [variantPrice, setVariantPrice] = useState<number | null>(null);
  const [variantLabel, setVariantLabel] = useState("");
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [issueError, setIssueError] = useState<string | null>(null);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">We couldn&apos;t find that exchange.</p>
        <Link href="/admin/exchanges" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to exchanges
        </Link>
      </div>
    );
  }

  const isDefect = data.reason === "quality_defect";
  const hasEvidence = data.attachments.length > 0;
  const originalPrice =
    data.order_item?.unit_price != null && data.order_item.unit_price !== ""
      ? Number(data.order_item.unit_price)
      : null;
  const priceDiff =
    data.price_difference != null && data.price_difference !== ""
      ? Number(data.price_difference)
      : 0;
  const differenceUnpaid =
    priceDiff > 0 &&
    data.difference_payment_state != null &&
    data.difference_payment_state !== "paid";

  // Approve gating: defects need evidence + a reviewer QA pass.
  const approveBlocked = decision === "approve" && isDefect && (!hasEvidence || !qaConfirmed);
  const decisionDisabled =
    !decision ||
    (decision === "reject" && !rejectionReason) ||
    approveBlocked ||
    decide.isPending;

  const canIssue = data.status === "approved" || data.status === "under_qa_review";
  const issued = data.status === "replacement_issued" || data.status === "completed";
  const issueDisabled = !variantId || !disposition || differenceUnpaid || issue.isPending;

  async function submitDecision() {
    setDecisionError(null);
    if (!decision) return;
    try {
      await decide.mutateAsync({
        decision,
        rejection_reason: decision === "reject" ? rejectionReason : undefined,
      });
      toast(decision === "approve" ? "Exchange approved." : "Exchange rejected — customer notified.");
      setDecision("");
      setRejectionReason("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setDecisionError(err.message || "This exchange isn't eligible for that decision.");
      else if (err instanceof ApiError && err.status === 400)
        setDecisionError("Quality claims must pass QA (within 5 working days) before approval.");
      else setDecisionError("Couldn't record the decision. Try again.");
    }
  }

  async function submitIssue() {
    setIssueError(null);
    if (!variantId || !disposition) return;
    try {
      const res = await issue.mutateAsync({
        replacement_variant_id: variantId,
        returned_item_disposition: disposition,
      });
      toast(`Replacement issued — order ${res.replacement_order_no ?? ""}.`);
    } catch (err) {
      setIssueError(issueErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/exchanges" className="text-sm text-brand-700 hover:underline">← Exchanges</Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">
          Exchange {data.exchange_id} — {data.order_no}
        </h1>
        <p className="text-sm text-gray-500">
          {humanize(data.status)} · {humanize(data.reason)}
          {data.created_at ? ` · requested ${formatDate(data.created_at)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left — request, evidence, eligibility, QA */}
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-base font-semibold text-gray-900">Request</h2>
            <p className="text-sm font-medium text-gray-900">{data.order_item?.title ?? "—"}</p>
            <p className="text-xs text-gray-500">
              {data.order_item?.sku_code ?? ""}
              {data.order_item?.variant_options
                ? ` · ${Object.values(data.order_item.variant_options).join(" / ")}`
                : ""}
              {originalPrice != null ? ` · ${formatBDT(originalPrice)}` : ""}
            </p>
            {data.customer_note && (
              <p className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-700">“{data.customer_note}”</p>
            )}
          </section>

          {/* Evidence */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Evidence</h2>
            {hasEvidence ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.attachments.map((a, i) => (
                  <li key={a.id ?? i} className="overflow-hidden rounded-lg border border-gray-200">
                    {a.type?.startsWith("video") ? (
                      <video src={resolveMediaUrl(a.url)} controls className="h-32 w-full bg-black object-contain" aria-label={a.label ?? `Exchange evidence ${i + 1} (video)`} />
                    ) : a.type?.startsWith("image") || !a.type ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(a.url)} alt={a.label ?? `Exchange evidence ${i + 1}`} className="h-32 w-full object-cover" />
                    ) : (
                      <a href={resolveMediaUrl(a.url)} target="_blank" rel="noreferrer" className="block p-3 text-sm text-brand-700 hover:underline">
                        {a.label ?? `Attachment ${i + 1}`}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={"text-sm " + (isDefect ? "text-red-600" : "text-gray-500")}>
                {isDefect
                  ? "No evidence attached — a quality defect can't be QA-passed or approved without evidence."
                  : "No evidence attached."}
              </p>
            )}
          </section>

          {/* Eligibility */}
          {data.eligibility && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-gray-900">Eligibility</h2>
              {data.eligibility.is_eligible === false ? (
                <p className="text-sm font-medium text-red-600">Not eligible.</p>
              ) : (
                <p className="text-sm text-green-700">Within exchange policy.</p>
              )}
              {data.eligibility.flags && data.eligibility.flags.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {data.eligibility.flags.map((f) => (
                    <li key={f} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {humanize(f)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* QA (quality defects only) */}
          {isDefect && (
            <Can permission="orders.exchange.review">
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-base font-semibold text-amber-900">Quality assurance</h2>
                <p className="mt-1 text-sm text-amber-800">
                  Quality claims must pass QA (within 5 working days) before approval.
                  {data.qa_due_at ? ` QA due ${formatDate(data.qa_due_at)}.` : ""}
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={qaConfirmed}
                    disabled={!hasEvidence}
                    onChange={(e) => setQaConfirmed(e.target.checked)}
                  />
                  Pass QA — defect confirmed from the evidence above.
                </label>
              </section>
            </Can>
          )}
        </div>

        {/* Right — decision + issue */}
        <div className="space-y-4">
          {data.status === "rejected" ? (
            <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
              This exchange was rejected; the order remains delivered and the customer was notified.
            </section>
          ) : issued ? (
            <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Replacement issued. The original order is now <span className="font-medium">exchanged</span>.
              {data.replacement_order_no && (
                <>
                  {" "}
                  <Link href={`/admin/orders/${data.replacement_order_no}`} className="font-medium text-brand-700 hover:underline">
                    View replacement {data.replacement_order_no}
                  </Link>
                </>
              )}
            </section>
          ) : (
            <>
              {/* Decision */}
              <Can
                permission="orders.exchange.review"
                fallback={
                  <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
                    You have read-only access — decisions require the review permission.
                  </section>
                }
              >
                <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <h2 className="text-base font-semibold text-gray-900">Decision</h2>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="decision" checked={decision === "approve"} onChange={() => setDecision("approve")} />
                      Approve
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="decision" checked={decision === "reject"} onChange={() => setDecision("reject")} />
                      Reject
                    </label>
                  </div>

                  {decision === "reject" && (
                    <div>
                      <label htmlFor="reject-reason" className="mb-1 block text-xs font-medium text-gray-600">
                        Rejection reason
                      </label>
                      <select
                        id="reject-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
                      >
                        <option value="">Choose a rejection reason…</option>
                        {REJECTION_REASONS.map((r) => (
                          <option key={r} value={r}>{humanize(r)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {approveBlocked && (
                    <p className="text-sm text-amber-700" id="approve-block" role="status">
                      {hasEvidence
                        ? "Pass QA above before approving this quality-defect exchange."
                        : "Evidence and a QA pass are required before approving a quality defect."}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={submitDecision}
                    disabled={decisionDisabled}
                    aria-describedby={approveBlocked ? "approve-block" : undefined}
                    className="h-9 w-full rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {decide.isPending ? "Submitting…" : "Submit decision"}
                  </button>
                  <p role="alert" aria-live="assertive" className="min-h-[1rem] text-sm text-red-600">
                    {decisionError}
                  </p>
                </section>
              </Can>

              {/* Issue replacement */}
              {canIssue && can("orders.exchange.review") && (
                <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <h2 className="text-base font-semibold text-gray-900">Issue replacement</h2>
                  <p className="text-xs text-gray-500">
                    Replacement must be equal or higher value — the customer pays any difference. No cash refund.
                  </p>

                  <ReplacementPicker
                    originalPrice={originalPrice}
                    selectedVariantId={variantId}
                    onSelect={(vid, price, label) => {
                      setVariantId(vid);
                      setVariantPrice(price);
                      setVariantLabel(label);
                      setIssueError(null);
                    }}
                  />

                  {variantId && (
                    <p className="rounded bg-gray-50 p-2 text-xs text-gray-700">
                      Selected: <span className="font-medium">{variantLabel}</span>
                      {variantPrice != null && originalPrice != null && variantPrice > originalPrice
                        ? ` · customer pays +${formatBDT(variantPrice - originalPrice)}`
                        : ""}
                    </p>
                  )}

                  <div>
                    <label htmlFor="disposition" className="mb-1 block text-xs font-medium text-gray-600">
                      Returned item
                    </label>
                    <select
                      id="disposition"
                      value={disposition}
                      onChange={(e) => setDisposition(e.target.value as Disposition)}
                      className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
                    >
                      <option value="">Choose a disposition…</option>
                      {DISPOSITIONS.map((d) => (
                        <option key={d} value={d}>{d === "restocked" ? "Restock (resellable)" : "Scrap (defective)"}</option>
                      ))}
                    </select>
                  </div>

                  {differenceUnpaid && (
                    <p className="text-sm text-amber-700" id="diff-block" role="status">
                      Customer must pay the {formatBDT(priceDiff)} difference before issuing.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={submitIssue}
                    disabled={issueDisabled}
                    aria-describedby={differenceUnpaid ? "diff-block" : undefined}
                    className="h-9 w-full rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {issue.isPending ? "Issuing…" : "Issue replacement"}
                  </button>
                  <p role="alert" aria-live="assertive" className="min-h-[1rem] text-sm text-red-600">
                    {issueError}
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

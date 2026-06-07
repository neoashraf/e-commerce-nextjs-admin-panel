"use client";

import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT } from "@/lib/format";
import { toast } from "@/lib/stores/toast";

/**
 * Reusable admin PaymentPanel (pay-admin-fe). Owned by PAY; embedded in the ORD
 * order-detail screen (ord-admin-fe). Shows the payment status + amounts and an
 * admin refund action limited to prepaid cancellations / duplicate captures
 * (409 not-refundable, 422 over-refund guards). No refunds for returns.
 */
const paymentSchema = z.object({
  payment_id: z.string(),
  method: z.string().optional(),
  status: z.string(),
  amount: z.string().optional(),
  refunded_amount: z.string().optional(),
  paid_at: z.string().nullable().optional(),
});
type Payment = z.infer<typeof paymentSchema>;

const REASONS = [
  { value: "prepaid_order_cancelled", label: "Prepaid order cancelled" },
  { value: "duplicate_capture", label: "Duplicate / erroneous capture" },
  { value: "payment_error", label: "Payment error" },
];

export function PaymentPanel({ paymentId }: { paymentId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-payment", paymentId] as const,
    enabled: !!paymentId,
    queryFn: (): Promise<Payment> => api.get(`/payments/${paymentId}`, { schema: paymentSchema }) as Promise<Payment>,
    staleTime: 15_000,
  });
  const refund = useMutation({
    mutationFn: (body: { amount: string; reason: string }) => api.post(`/admin/payments/${paymentId}/refund`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment", paymentId] }),
  });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0].value);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  if (isError || !data) return <p className="text-sm text-gray-500">Payment details unavailable.</p>;

  const refundable = data.status === "paid";

  async function onRefund() {
    setError(null);
    if (!amount || Number(amount) <= 0) { setError("Enter a refund amount."); return; }
    try {
      await refund.mutateAsync({ amount, reason });
      toast("Refund initiated.");
      setOpen(false); setAmount("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("This payment isn't refundable (not prepaid online, or already dispatched).");
      else if (err instanceof ApiError && err.status === 422) setError("Amount exceeds the refundable balance.");
      else setError("Couldn't process the refund. Try again.");
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">Payment</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row label="Method" value={(data.method ?? "—").toUpperCase()} />
        <Row label="Status" value={data.status.replace(/_/g, " ")} />
        <Row label="Amount" value={data.amount ? formatBDT(Number(data.amount)) : "—"} />
        {Number(data.refunded_amount ?? 0) > 0 && <Row label="Refunded" value={formatBDT(Number(data.refunded_amount))} />}
      </dl>

      {refundable && (
        <Can permission="payments.refund">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-brand-700 hover:underline">Refund…</button>
          ) : (
            <div className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Refunds are only for prepaid cancellations or duplicate captures — not post-delivery returns.</p>
              <div className="flex flex-wrap gap-2">
                <input className="h-9 w-32 rounded-md border border-gray-300 px-2 text-sm" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ৳" />
                <select className="h-9 rounded-md border border-gray-300 px-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                <button type="button" onClick={onRefund} disabled={refund.isPending} className="h-9 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Refund</button>
                <button type="button" onClick={() => setOpen(false)} className="h-9 text-sm font-medium text-gray-500">Cancel</button>
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </Can>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-gray-500">{label}</dt><dd className="font-medium text-gray-900">{value}</dd></div>;
}

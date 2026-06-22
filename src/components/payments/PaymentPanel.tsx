"use client";

import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Can } from "@/lib/permissions/Can";
import { ApiError } from "@/lib/api/errors";
import { formatBDT } from "@/lib/format";
import { toast } from "@/lib/stores/toast";
import { Button, Card, Input, Select, Skeleton, StatusPill } from "@/components/ui";

/**
 * Reusable admin PaymentPanel (pay-admin-fe). Owned by PAY; embedded in the ORD
 * order-detail screen (ord-admin-fe). Shows the payment status + amounts and an
 * admin refund action limited to prepaid cancellations / duplicate captures
 * (409 not-refundable, 422 over-refund guards). No refunds for returns. Reads the
 * admin payment-status endpoint (GET /admin/payments/{id}); styled to the design system.
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
    queryFn: (): Promise<Payment> =>
      api.get(`/admin/payments/${paymentId}`, { schema: paymentSchema }) as Promise<Payment>,
    staleTime: 15_000,
  });
  const refund = useMutation({
    mutationFn: (body: { amount: string; reason: string }) =>
      api.post(`/admin/payments/${paymentId}/refund`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payment", paymentId] }),
  });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0].value);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-28 rounded-lg" />;
  if (isError || !data)
    return (
      <Card className="p-4 text-sm text-text-muted">Payment details unavailable.</Card>
    );

  const refundable = data.status === "paid";

  async function onRefund() {
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Enter a refund amount.");
      return;
    }
    try {
      await refund.mutateAsync({ amount, reason });
      toast("Refund initiated.");
      setOpen(false);
      setAmount("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setError("This payment isn't refundable (not prepaid online, or already dispatched).");
      else if (err instanceof ApiError && err.status === 422)
        setError("Amount exceeds the refundable balance.");
      else setError("Couldn't process the refund. Try again.");
    }
  }

  return (
    <Card className="p-4">
      <dl className="space-y-1">
        <Row label="Method">
          <span className="font-medium tabular-nums text-text">
            {(data.method ?? "—").toUpperCase()}
          </span>
        </Row>
        <Row label="Status">
          <StatusPill status={data.status} />
        </Row>
        <Row label="Amount">
          <span className="font-medium tabular-nums text-text">
            {data.amount ? formatBDT(Number(data.amount)) : "—"}
          </span>
        </Row>
        {Number(data.refunded_amount ?? 0) > 0 && (
          <Row label="Refunded">
            <span className="font-medium tabular-nums text-text">
              {formatBDT(Number(data.refunded_amount))}
            </span>
          </Row>
        )}
      </dl>

      {refundable && (
        <Can permission="payments.refund">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 text-sm font-medium text-accent-700 hover:underline"
            >
              Refund…
            </button>
          ) : (
            <div className="mt-3 space-y-2 rounded-md bg-surface-subtle p-3">
              <p className="text-xs text-text-muted">
                Refunds are only for prepaid cancellations or duplicate captures — not post-delivery returns.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-32"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount ৳"
                  aria-label="Refund amount"
                />
                <div className="w-56">
                  <Select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Refund reason"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRefund}
                  loading={refund.isPending}
                  className="bg-error hover:bg-error/90"
                >
                  Refund
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
            </div>
          )}
        </Can>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

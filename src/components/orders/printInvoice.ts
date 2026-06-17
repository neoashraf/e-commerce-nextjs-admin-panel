import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/stores/auth";

/**
 * Open an order's invoice PDF in a new tab. The admin invoice endpoint
 * (GET /admin/orders/{orderNo}/invoice?format=pdf, FR-ORD-073, gated on
 * orders.order.read) is bearer-authenticated, so a plain link would 401 — we
 * fetch it with the stored token and open the resulting blob. Presentation-only
 * wiring over an existing documented endpoint; the list's own data is unchanged.
 */
export async function printInvoice(orderNo: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(
    `${env.apiUrl}/admin/orders/${orderNo}/invoice?format=pdf`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) throw new Error(`Invoice request failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  // Revoke after the new tab has had a chance to load the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!win) {
    // Popup blocked — fall back to a direct download of the same blob.
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orderNo}-invoice.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

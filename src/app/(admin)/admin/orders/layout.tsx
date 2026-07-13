/**
 * Orders segment layout. The order-detail drawer is now driven by the list's
 * `?order=<orderNo>` query param (rendered inside OrdersView), so it survives a
 * reload as a drawer; the canonical `/admin/orders/[orderNo]` route remains the
 * full-page detail used by copied links and deep-links from other screens.
 */
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

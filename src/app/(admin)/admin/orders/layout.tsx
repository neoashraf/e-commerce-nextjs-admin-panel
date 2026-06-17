/**
 * Orders segment layout — hosts the list (children) plus a parallel `@drawer`
 * slot that the intercepting route fills with the order-detail drawer over the
 * list (AD3). On a normal navigation the slot stays empty (its default.tsx).
 */
export default function OrdersLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}

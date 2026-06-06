import { Suspense } from "react";
import { ExchangeQueueView } from "@/components/exchanges/ExchangeQueueView";

/** Exchange queue — /admin/exchanges (ord-exchange-admin-fe). */
export const metadata = { title: "Exchanges", robots: { index: false } };

export default function ExchangesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
      <ExchangeQueueView />
    </Suspense>
  );
}

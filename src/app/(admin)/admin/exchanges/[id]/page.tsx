import { ExchangeReviewView } from "@/components/exchanges/ExchangeReviewView";

/** Exchange review — /admin/exchanges/<id> (ord-exchange-admin-fe). */
export const metadata = { title: "Exchange review", robots: { index: false } };

export default function ExchangeReviewPage({ params }: { params: { id: string } }) {
  return <ExchangeReviewView id={params.id} />;
}

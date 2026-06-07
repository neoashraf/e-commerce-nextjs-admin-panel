import { MovementsView } from "@/components/inventory/MovementsView";

/** SKU movements — /admin/inventory/<variantId>/movements (inv-movements-fe). */
export default function MovementsPage({ params }: { params: { variantId: string } }) {
  return <MovementsView variantId={params.variantId} />;
}

"use client";

import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui";
import { OrderDetailAdminView } from "./OrderDetailAdminView";

/**
 * Order detail inside the AD3 right-side Drawer, opened over the Orders list via
 * an intercepting route (design-system §8.9). Closing (✕ / Esc / scrim) calls
 * router.back(), returning to the list with focus restored. Direct load/refresh
 * bypasses the interception and renders the full-page fallback instead.
 */
export function OrderDrawer({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.back()}
      title={`Order ${orderNo}`}
      width="max-w-[600px]"
    >
      <OrderDetailAdminView orderNo={orderNo} inDrawer />
    </Drawer>
  );
}

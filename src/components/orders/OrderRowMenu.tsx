"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, Printer } from "lucide-react";
import { RowActions } from "@/components/ui";
import { toast } from "@/lib/stores/toast";
import { printInvoice } from "./printInvoice";

/**
 * Row actions menu (design-system §8.6 actions cell): View order + Print
 * invoice. Built on the shared {@link RowActions} primitive, so the dropdown is
 * portaled and never clipped by the table's overflow wrappers. View opens the
 * detail drawer over the list (via `?order=`, reload-safe); Print opens the
 * documented invoice endpoint.
 */
const itemCls =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle";

export function OrderRowMenu({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [printing, setPrinting] = useState(false);

  function viewOrder() {
    const next = new URLSearchParams(sp.toString());
    next.set("order", orderNo);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const onPrint = async (close: () => void) => {
    close();
    setPrinting(true);
    try {
      await printInvoice(orderNo);
    } catch {
      toast("Couldn't open the invoice. Please try again.", "error");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <RowActions label={`Actions for order ${orderNo}`} width="w-44" disabled={printing}>
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              viewOrder();
            }}
            className={itemCls}
          >
            <Eye className="h-4 w-4 text-text-muted" aria-hidden="true" />
            View order
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => onPrint(close)}
            className={itemCls}
          >
            <Printer className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Print invoice
          </button>
        </>
      )}
    </RowActions>
  );
}

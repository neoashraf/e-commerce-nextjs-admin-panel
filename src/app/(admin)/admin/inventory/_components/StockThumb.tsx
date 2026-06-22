"use client";

import { CircleDot, Footprints, Package, Shirt } from "lucide-react";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import { stockIconKey } from "./shared";

const ICON = {
  footprints: Footprints,
  shirt: Shirt,
  ball: CircleDot,
  package: Package,
} as const;

/**
 * Square product thumbnail for the Stock list cell and the Movements header card
 * (design §C / Movements §A). Renders the listing-rendition image when present,
 * else a rounded surface-subtle tile with a category glyph derived from the SKU.
 * `product_image` is not yet in the backend row, so this degrades to the glyph.
 */
export function StockThumb({
  row,
  size = "md",
}: {
  row: { sku_code: string; product_title?: string | null; product_image?: string | null };
  size?: "md" | "lg";
}) {
  const Icon = ICON[stockIconKey(row)];
  const box = size === "lg" ? "h-[52px] w-[52px] rounded-[11px]" : "h-[38px] w-[38px] rounded-[9px]";
  const glyph = size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";

  if (row.product_image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolveMediaUrl(row.product_image)}
        alt={row.product_title ?? row.sku_code}
        className={cn("shrink-0 border border-border object-cover", box)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-surface-subtle text-text-faint",
        box,
      )}
      aria-hidden="true"
    >
      <Icon className={glyph} />
    </div>
  );
}

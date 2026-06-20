"use client";

import { useRouter } from "next/navigation";
import { Eye, Tag } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { RowActions } from "@/components/ui";
import { CUSTOMERS_TAG_PERMISSION } from "./permissions";

/**
 * Per-row "⋯" actions menu (design §8.6). "Open" (read-only navigation to the
 * 360 profile) is always shown; "Add tag" is gated on `customers.tag.manage`
 * and only for non-guest rows (guests are read-only). Built on the shared
 * {@link RowActions} primitive, so the dropdown is portaled and never clipped.
 */
const itemCls =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle";

export function CustomerRowMenu({
  id,
  name,
  isGuest,
  onAddTag,
}: {
  id: string;
  name: string;
  isGuest: boolean;
  /** Opens the bulk-tag flow scoped to this single row. */
  onAddTag: () => void;
}) {
  const router = useRouter();

  return (
    <RowActions label={`Actions for ${name}`} width="w-40">
      {(close) => (
        <>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              router.push(`/admin/customers/${id}`);
            }}
            className={itemCls}
          >
            <Eye className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Open
          </button>
          {!isGuest && (
            <Can permission={CUSTOMERS_TAG_PERMISSION}>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  close();
                  onAddTag();
                }}
                className={itemCls}
              >
                <Tag className="h-4 w-4 text-text-muted" aria-hidden="true" />
                Add tag
              </button>
            </Can>
          )}
        </>
      )}
    </RowActions>
  );
}

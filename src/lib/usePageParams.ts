"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

/**
 * URL-reflected pagination state shared by every admin data table (AD7, design-system §8.6).
 *
 * `page` (1-based) and `pageSize` live in the query string (`?page=` / `?limit=`), so the
 * choice is shareable, deep-linkable, and survives reload. Defaults are omitted from the URL
 * to keep it clean. Changing the page size resets to page 1 so we never land on an out-of-range
 * page. Filter/search setters in each view delete `page` (not `limit`) on change, as today.
 */
export function usePageParams(defaultPageSize: number = DEFAULT_PAGE_SIZE) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.max(1, Number(sp.get("limit")) || defaultPageSize);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    push(next);
  }

  function setPageSize(size: number) {
    const next = new URLSearchParams(sp.toString());
    if (size === defaultPageSize) next.delete("limit");
    else next.set("limit", String(size));
    next.delete("page"); // size change → back to page 1
    push(next);
  }

  return { page, pageSize, setPage, setPageSize };
}

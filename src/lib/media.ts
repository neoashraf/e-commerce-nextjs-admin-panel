import { env } from "@/lib/env";

/** Origin the browser uses to reach the backend, derived from the API base URL (strips /api/v1). */
function apiOrigin(): string {
  try {
    return new URL(env.apiUrl).origin;
  } catch {
    return "";
  }
}

/**
 * Resolve a stored media URL so it loads from the same origin the app uses for the API.
 * Backend-served uploads live under `/uploads/**`; their stored absolute host comes from
 * PUBLIC_BASE_URL, which can differ from where the browser actually reaches the backend
 * (proxy / tunnel / local) — so we re-point only those to the API origin. Genuinely external
 * URLs (CDN images, video links) and data:/blob: previews pass through untouched.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Our uploaded media (any host) → re-point to the API origin from `/uploads/…` onward.
  const idx = url.indexOf("/uploads/");
  if (idx >= 0) return `${apiOrigin()}${url.slice(idx)}`;
  // Relative path (same-origin as the backend) → prefix the API origin.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return `${apiOrigin()}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  // Absolute external URL → leave as-is.
  return url;
}

/**
 * Pick the best rendition URL for a gallery thumbnail/preview, falling back across sizes and the
 * stored original url. Returns a browser-resolvable URL (via resolveMediaUrl).
 */
export function pickRendition(
  renditions: Record<string, string> | undefined,
  url?: string | null,
  prefer: string[] = ["detail", "listing", "thumb"],
): string {
  if (renditions) {
    for (const key of prefer) {
      if (renditions[key]) return resolveMediaUrl(renditions[key]);
    }
    const first = Object.values(renditions)[0];
    if (first) return resolveMediaUrl(first);
  }
  return resolveMediaUrl(url ?? "");
}

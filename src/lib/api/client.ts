import { z } from "zod";
import { env } from "@/lib/env";
import { ApiError, type ApiErrorDetail } from "@/lib/api/errors";
import { getAccessToken, useAuthStore } from "@/lib/stores/auth";

/**
 * Thin fetch wrapper — the single place that knows the request shape
 * (fe-api-integration). Attaches the admin Bearer token, parses the platform
 * error envelope into a typed ApiError, and optionally validates the response
 * body against a Zod schema so the backend's shape is treated as external input.
 *
 * Never scatter raw fetch() across components — go through `api`.
 */

type Json = Record<string, unknown> | unknown[] | null;

interface RequestOptions<T> {
  /**
   * Zod schema for the `data` field of the response envelope. Input is `unknown`
   * (raw parsed JSON) and `T` is the OUTPUT, so transforming schemas — e.g. ones
   * that rename contract fields (`customer_id` → `id`) — are accepted.
   */
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Query params appended to the URL. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Skip attaching the auth token (for /admin/auth/* public endpoints). */
  public?: boolean;
  /**
   * Return the FULL `{ data, meta }` envelope instead of unwrapping to `data`.
   * Needed by endpoints whose `meta` carries response info (e.g. the dashboard's
   * `meta.visible_widgets`). When set, `schema` validates the whole envelope.
   */
  rawEnvelope?: boolean;
  signal?: AbortSignal;
}

/** Platform success envelope: { data, meta? }. */
const envelopeSchema = z.object({
  data: z.unknown(),
  meta: z.unknown().optional(),
});

/** Platform error envelope: { error: { code, message, details } }. */
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(z.object({ field: z.string().optional(), message: z.string() }))
      .optional(),
    retry_after: z.number().optional(),
  }),
});

function buildUrl(
  path: string,
  params?: RequestOptions<unknown>["params"],
): string {
  const base = env.apiUrl.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body: Json | undefined,
  opts: RequestOptions<T> = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!opts.public) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (cause) {
    // Network failure / aborted / CORS — no HTTP status available.
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.", []);
  }

  // 204 No Content — nothing to parse; return undefined as T.
  if (res.status === 204) return undefined as T;

  // Session expired / token revoked on an authenticated request: the token we
  // hold is dead, so clear it. AuthGuard reacts to `tokens` going null and
  // redirects to /login. Public endpoints (login, password reset) can return
  // 401 for bad credentials — those must NOT wipe a session.
  if (res.status === 401 && !opts.public) {
    useAuthStore.getState().clear();
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    if (res.ok) return undefined as T;
    throw new ApiError(res.status, "BAD_RESPONSE", res.statusText || "Request failed.");
  }

  if (!res.ok) {
    const parsed = errorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(
        res.status,
        code,
        message,
        (details as ApiErrorDetail[]) ?? [],
      );
    }
    throw new ApiError(res.status, "UNKNOWN", res.statusText || "Request failed.");
  }

  // Success — unwrap the { data } envelope and optionally validate. When
  // `rawEnvelope` is set, validate/return the whole { data, meta } payload.
  const env_ = envelopeSchema.safeParse(payload);
  const data = opts.rawEnvelope
    ? payload
    : env_.success
      ? env_.data.data
      : payload;

  if (opts.schema) {
    const valid = opts.schema.safeParse(data);
    if (!valid.success) {
      // Contract drift — surface clearly rather than passing bad data downstream.
      throw new ApiError(
        res.status,
        "CONTRACT_MISMATCH",
        `Response did not match expected shape for ${method} ${path}.`,
      );
    }
    return valid.data;
  }

  return data as T;
}

/**
 * Multipart POST for file uploads (e.g. product images). Unlike `request`, this
 * sends a `FormData` body and lets the browser set the `multipart/form-data`
 * boundary itself — so we deliberately do NOT set Content-Type. Reuses the same
 * auth header, error-envelope parsing, and optional Zod unwrap as `request`.
 */
async function requestForm<T>(
  path: string,
  form: FormData,
  opts: RequestOptions<T> = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!opts.public) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method: "POST",
      headers,
      body: form,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.", []);
  }

  if (res.status === 204) return undefined as T;
  if (res.status === 401 && !opts.public) useAuthStore.getState().clear();

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    if (res.ok) return undefined as T;
    throw new ApiError(res.status, "BAD_RESPONSE", res.statusText || "Request failed.");
  }

  if (!res.ok) {
    const parsed = errorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code, message, (details as ApiErrorDetail[]) ?? []);
    }
    throw new ApiError(res.status, "UNKNOWN", res.statusText || "Request failed.");
  }

  const env_ = envelopeSchema.safeParse(payload);
  const data = env_.success ? env_.data.data : payload;

  if (opts.schema) {
    const valid = opts.schema.safeParse(data);
    if (!valid.success) {
      throw new ApiError(
        res.status,
        "CONTRACT_MISMATCH",
        `Response did not match expected shape for POST ${path}.`,
      );
    }
    return valid.data;
  }

  return data as T;
}

/**
 * Authenticated file download (e.g. the products CSV export, which the backend returns as a raw
 * `text/csv` body, not the JSON envelope). Attaches the Bearer token, parses the error envelope the
 * same way as `request`, and returns the body as a Blob plus the filename from `Content-Disposition`.
 */
async function requestBlob(
  path: string,
  opts: { params?: RequestOptions<unknown>["params"]; signal?: AbortSignal } = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method: "GET",
      headers,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.", []);
  }

  if (res.status === 401) useAuthStore.getState().clear();

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new ApiError(res.status, "UNKNOWN", res.statusText || "Request failed.");
    }
    const parsed = errorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code, message, (details as ApiErrorDetail[]) ?? []);
    }
    throw new ApiError(res.status, "UNKNOWN", res.statusText || "Request failed.");
  }

  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return { blob: await res.blob(), filename: match ? match[1] : null };
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions<T>) =>
    request<T>("GET", path, undefined, opts),
  download: (path: string, opts?: { params?: RequestOptions<unknown>["params"]; signal?: AbortSignal }) =>
    requestBlob(path, opts),
  postForm: <T>(path: string, form: FormData, opts?: RequestOptions<T>) =>
    requestForm<T>(path, form, opts),
  post: <T>(path: string, body?: Json, opts?: RequestOptions<T>) =>
    request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: Json, opts?: RequestOptions<T>) =>
    request<T>("PATCH", path, body, opts),
  put: <T>(path: string, body?: Json, opts?: RequestOptions<T>) =>
    request<T>("PUT", path, body, opts),
  delete: <T>(path: string, body?: Json, opts?: RequestOptions<T>) =>
    request<T>("DELETE", path, body, opts),
};

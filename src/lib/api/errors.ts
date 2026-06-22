/**
 * Typed API error mirroring the platform error envelope
 * (docs/srs/00-overview.md §7):
 *   { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
 *
 * Callers and React Query branch on `status` / `code`; forms map `fields`
 * back onto inputs via setError (see fe-form-builder).
 */

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  /**
   * Structured, object-shaped `error.details` (when the envelope carries an object
   * rather than a field array) — e.g. the 409 `CATEGORY_HAS_DEPENDENTS` payload
   * `{ child_categories, published_products }`. `null` for array/absent details.
   */
  readonly context: Record<string, unknown> | null;

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
    context: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.context = context;
  }

  /** True for 4xx client errors — React Query should NOT retry these. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Field-level validation errors keyed by field name, for form mapping. */
  get fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const d of this.details) {
      if (d.field) map[d.field] = d.message;
    }
    return map;
  }
}

/** Narrow an unknown caught value to ApiError. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

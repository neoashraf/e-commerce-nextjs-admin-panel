import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/errors";

/**
 * Map a backend 400/422 field-error envelope back onto a React Hook Form
 * (fe-form-builder). Returns the non-field message (network/500/auth) for the
 * caller to show in a form-level alert region, or null if everything mapped.
 */
export function mapApiErrorsToForm<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!isApiError(err)) {
    return "Something went wrong. Please try again.";
  }

  const fieldErrors = err.fieldErrors;
  const entries = Object.entries(fieldErrors);
  if (entries.length > 0) {
    for (const [field, message] of entries) {
      setError(field as Path<T>, { type: "server", message });
    }
    return null;
  }

  return err.message || "Request failed.";
}

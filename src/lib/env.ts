/**
 * Centralized, validated access to public environment variables.
 * Fails fast at import time if a required variable is missing, so a
 * misconfigured deploy surfaces immediately instead of as a runtime 404.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and set it.`,
    );
  }
  return value;
}

export const env = {
  /** Backend REST API base URL, including the /api/v1 prefix. */
  apiUrl: required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
} as const;

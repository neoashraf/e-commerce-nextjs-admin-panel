import { z } from "zod";

/**
 * Admin forgot/reset password form schemas (rbac-admin-auth-fe, FR-RBAC-007).
 * The admin password policy is ≥10 chars with upper + lower + number (enforced
 * server-side; mirrored here for the live checklist).
 */
export const forgotSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
export type ForgotFormValues = z.infer<typeof forgotSchema>;

/** Individual password rules, surfaced as a live checklist in the UI. */
export const passwordRules = [
  { key: "len", label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { key: "upper", label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { key: "lower", label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { key: "number", label: "A number", test: (v: string) => /\d/.test(v) },
] as const;

const strongPassword = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/\d/, "Add a number");

export const resetSchema = z.object({
  new_password: strongPassword,
});
export type ResetFormValues = z.infer<typeof resetSchema>;

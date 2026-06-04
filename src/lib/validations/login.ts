import { z } from "zod";

/** Admin login form schema — single source of truth (fe-form-builder). */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** 2FA code step. */
export const twoFaSchema = z.object({
  code: z
    .string()
    .min(4, "Enter the code sent to you")
    .regex(/^\d+$/, "Code must be digits only"),
});

export type TwoFaFormValues = z.infer<typeof twoFaSchema>;

import { passwordRules } from "@/lib/validations/password-reset";

/**
 * Live password-requirements checklist (rbac-admin-profile-fe AC2). Reuses the
 * shared `passwordRules` (≥10 / upper / lower / number). Announced as a live
 * region so a screen reader hears rules satisfied as the admin types.
 */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul aria-live="polite" className="space-y-1">
      {passwordRules.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.key} className={"flex items-center gap-2 text-xs " + (ok ? "text-green-700" : "text-gray-500")}>
            <span aria-hidden="true">{ok ? "✓" : "○"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminShell } from "@/components/shell/AdminShell";

/**
 * Layout for every authenticated admin route. The guard redirects to /login
 * without a token; the shell provides the sidebar + topbar chrome. Real
 * authorization is enforced by the backend per request.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}

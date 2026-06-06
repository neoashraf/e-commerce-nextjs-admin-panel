import { RolesView } from "@/components/roles/RolesView";

/** Roles list — /admin/roles (rbac-roles-permissions-fe). Gated by the shell
 * (rbac.role.read). */
export default function RolesPage() {
  return <RolesView />;
}

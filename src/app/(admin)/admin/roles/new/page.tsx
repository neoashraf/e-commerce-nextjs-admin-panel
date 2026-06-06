import { RoleEditor } from "@/components/roles/RoleEditor";

/** Create role — /admin/roles/new (rbac-roles-permissions-fe). */
export default function NewRolePage() {
  return <RoleEditor mode="create" />;
}

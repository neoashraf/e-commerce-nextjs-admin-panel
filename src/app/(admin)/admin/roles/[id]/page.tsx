import { EditRoleView } from "./EditRoleView";

/** Role editor — /admin/roles/<id> (rbac-roles-permissions-fe). */
export default function RoleDetailPage({ params }: { params: { id: string } }) {
  return <EditRoleView id={params.id} />;
}

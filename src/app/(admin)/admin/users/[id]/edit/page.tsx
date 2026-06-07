import { EditUserView } from "./EditUserView";

/** Edit admin — /admin/users/<id>/edit (rbac-admin-users-fe). */
export default function EditAdminPage({ params }: { params: { id: string } }) {
  return <EditUserView id={params.id} />;
}

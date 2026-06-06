import { EditAttributeView } from "./EditAttributeView";

/** Attribute editor — /admin/attributes/<id> (catalog-attributes-fe). */
export default function EditAttributePage({ params }: { params: { id: string } }) {
  return <EditAttributeView id={params.id} />;
}

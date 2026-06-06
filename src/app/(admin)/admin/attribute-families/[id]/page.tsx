import { EditFamilyView } from "./EditFamilyView";

/** Family editor — /admin/attribute-families/<id> (catalog-attribute-families-fe). */
export default function EditFamilyPage({ params }: { params: { id: string } }) {
  return <EditFamilyView id={params.id} />;
}

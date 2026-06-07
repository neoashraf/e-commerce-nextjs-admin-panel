import { EditCategoryView } from "./EditCategoryView";

/** Category editor — /admin/categories/<id> (catalog-categories-fe). */
export default function EditCategoryPage({ params }: { params: { id: string } }) {
  return <EditCategoryView id={params.id} />;
}

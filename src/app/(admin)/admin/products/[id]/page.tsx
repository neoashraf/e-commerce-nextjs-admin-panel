import { EditProductView } from "./EditProductView";

/** Product editor — /admin/products/<id> (catalog-product-editor-fe). */
export default function EditProductPage({ params }: { params: { id: string } }) {
  return <EditProductView id={params.id} />;
}

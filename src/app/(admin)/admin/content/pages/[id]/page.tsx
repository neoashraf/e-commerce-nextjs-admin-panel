import { EditPageView } from "./EditPageView";

/** CMS page editor — /admin/content/pages/<id> (cms-pages-fe). */
export default function EditCmsPage({ params }: { params: { id: string } }) {
  return <EditPageView id={params.id} />;
}

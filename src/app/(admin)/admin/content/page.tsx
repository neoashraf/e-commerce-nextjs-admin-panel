import { redirect } from "next/navigation";

/** /admin/content → Pages (the CMS landing). */
export default function ContentIndexPage() {
  redirect("/admin/content/pages");
}

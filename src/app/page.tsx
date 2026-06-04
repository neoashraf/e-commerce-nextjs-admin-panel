import { redirect } from "next/navigation";

/**
 * Root entry — the admin app has no public landing page. Send visitors to the
 * dashboard; the admin route group's guard bounces unauthenticated users to
 * /login.
 */
export default function Home() {
  redirect("/admin/dashboard");
}

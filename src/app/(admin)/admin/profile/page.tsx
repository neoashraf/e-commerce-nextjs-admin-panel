import type { Metadata } from "next";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = { title: "Profile & Security" };

/** Admin Profile & Security — /admin/profile (rbac-admin-profile-fe). */
export default function ProfilePage() {
  return <ProfileView />;
}

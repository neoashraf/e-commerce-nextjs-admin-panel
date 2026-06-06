"use client";

import { useMyProfile } from "@/lib/api/hooks/useMe";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { SecuritySection } from "@/components/profile/SecuritySection";
import { PermissionsList } from "@/components/profile/PermissionsList";

/**
 * Admin Profile & Security view (rbac-admin-profile-fe). Loads GET /admin/me and
 * renders the profile, security, and read-only permissions sections.
 */
export function ProfileView() {
  const { data: me, isLoading, isError, refetch } = useMyProfile();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }
  if (isError || !me) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-600">Couldn&apos;t load your profile.</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Profile &amp; Security</h1>
      <ProfileSection me={me} />
      <SecuritySection me={me} />
      <PermissionsList permissions={me.permissions} />
    </div>
  );
}

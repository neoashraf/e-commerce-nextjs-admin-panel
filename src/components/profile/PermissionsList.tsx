/**
 * Read-only "Your permissions" list (rbac-admin-profile-fe AC5, FR-RBAC-032).
 * Groups the effective permission keys by their module prefix (the part before
 * the first dot). Role/permissions are managed by a Super Admin — noted here.
 */
export function PermissionsList({ permissions }: { permissions: string[] }) {
  const groups = new Map<string, string[]>();
  for (const p of permissions) {
    const mod = p.split(".")[0] ?? "other";
    groups.set(mod, [...(groups.get(mod) ?? []), p]);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Your permissions</h2>
      <p className="mt-1 text-sm text-gray-500">
        Your role and permissions are managed by a Super Admin. Contact one to request changes.
      </p>
      {permissions.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No permissions assigned.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(groups.entries()).map(([mod, keys]) => (
            <div key={mod}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{mod}</p>
              <ul className="mt-1 space-y-0.5">
                {keys.map((k) => (
                  <li key={k} className="text-sm text-gray-700">{k}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

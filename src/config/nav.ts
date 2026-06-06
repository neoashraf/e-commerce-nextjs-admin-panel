/**
 * Admin sidebar navigation. Each item maps to an admin module (SRS 10–16 plus
 * admin-facing catalog/orders) and the RBAC permission that gates it
 * (docs/srs/16-rbac.md). The shell hides items the signed-in admin lacks
 * permission for; the backend still enforces access per request.
 *
 * Routes are placeholders for the foundation build — module pages are added
 * later under app/(admin)/admin/<segment>/.
 */

export interface NavItem {
  label: string;
  href: string;
  /** Permission key required to see this item (from GET /admin/me). */
  permission: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", permission: "dashboard.view" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", permission: "catalog.product.read" },
      { label: "Categories", href: "/admin/categories", permission: "catalog.category.read" },
      { label: "Attributes", href: "/admin/attributes", permission: "catalog.attribute.read" },
      { label: "Attribute Families", href: "/admin/attribute-families", permission: "catalog.attribute.read" },
      { label: "Inventory", href: "/admin/inventory", permission: "inventory.stock.read" },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", permission: "orders.order.read" },
      { label: "Customers", href: "/admin/customers", permission: "customers.customer.read" },
      { label: "Leads", href: "/admin/leads", permission: "leads.lead.read" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Promotions", href: "/admin/promotions", permission: "promotions.coupon.read" },
      { label: "Content", href: "/admin/content", permission: "content.page.read" },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/admin/reports", permission: "reports.view" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Admin Users", href: "/admin/users", permission: "rbac.admin_user.read" },
      { label: "Roles", href: "/admin/roles", permission: "rbac.role.read" },
      { label: "Audit Log", href: "/admin/audit", permission: "rbac.audit.read" },
    ],
  },
];

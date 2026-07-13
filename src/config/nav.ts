/**
 * Admin sidebar navigation. Each item maps to an admin module (SRS 10–16 plus
 * admin-facing catalog/orders) and the RBAC permission that gates it
 * (docs/srs/16-rbac.md). The shell hides items the signed-in admin lacks
 * permission for; the backend still enforces access per request.
 *
 * Routes are placeholders for the foundation build — module pages are added
 * later under app/(admin)/admin/<segment>/.
 */

import {
  BarChart3,
  BellRing,
  Boxes,
  CreditCard,
  FileText,
  FolderTree,
  History,
  Images,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  Mail,
  Package,
  Repeat,
  ScrollText,
  Shield,
  ShoppingCart,
  Tags,
  TicketPercent,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  /** Permission key required to see this item (from GET /admin/me). */
  permission: string;
  /** lucide icon shown in the sidebar (design-system §6). */
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", permission: "dashboard.view", icon: LayoutDashboard },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", permission: "catalog.product.read", icon: Package },
      { label: "Categories", href: "/admin/categories", permission: "catalog.category.read", icon: FolderTree },
      { label: "Attributes", href: "/admin/attributes", permission: "catalog.attribute.read", icon: Tags },
      { label: "Attribute Families", href: "/admin/attribute-families", permission: "catalog.attribute.read", icon: Layers },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock", href: "/admin/inventory", permission: "inventory.stock.read", icon: Boxes },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", permission: "orders.order.read", icon: ShoppingCart },
      // { label: "Exchanges", href: "/admin/exchanges", permission: "orders.exchange.read", icon: Repeat },
      { label: "Customers", href: "/admin/customers", permission: "customers.customer.read", icon: Users },
      { label: "Leads", href: "/admin/leads", permission: "leads.lead.read", icon: UserPlus },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Promotions", href: "/admin/promotions", permission: "promotions.coupon.read", icon: TicketPercent },
      { label: "Pages", href: "/admin/content/pages", permission: "content.page.manage", icon: FileText },
      { label: "Menus", href: "/admin/content/menus", permission: "content.menu.manage", icon: ListTree },
      { label: "Merchandising", href: "/admin/content/merchandising", permission: "content.banner.manage", icon: Images },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/admin/reports", permission: "reports.report.view", icon: BarChart3 },
    ],
  },
  {
    title: "Notifications",
    items: [
      { label: "Templates", href: "/admin/notifications", permission: "notifications.template.read", icon: Mail },
      // { label: "Delivery Log", href: "/admin/notifications/log", permission: "notifications.log.read", icon: History },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Admin Users", href: "/admin/users", permission: "rbac.admin_user.read", icon: Shield },
      { label: "Roles", href: "/admin/roles", permission: "rbac.role.read", icon: KeyRound },
      // { label: "Audit Log", href: "/admin/audit", permission: "rbac.audit.read", icon: ScrollText },
      { label: "Delivery", href: "/admin/settings/delivery", permission: "cart.settings.manage", icon: Truck },
      { label: "Payments", href: "/admin/settings/payments", permission: "payments.settings.manage", icon: CreditCard },
      { label: "Notifications", href: "/admin/settings/notifications", permission: "notifications.settings.manage", icon: BellRing },
      { label: "Two-factor", href: "/admin/settings/mfa", permission: "settings.setting.read", icon: Shield },
    ],
  },
];

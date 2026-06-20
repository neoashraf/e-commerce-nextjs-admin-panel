import {
  BarChart3,
  Boxes,
  CreditCard,
  type LucideIcon,
  Package,
  Search,
  ShoppingCart,
  TicketPercent,
  Users,
} from "lucide-react";
import type { ReportKey } from "@/lib/api/schemas/reports";

/**
 * Report catalog metadata — the single source of truth for the report nav and
 * each viewer's controls. Every report is permission-scoped on
 * `reports.report.view` (the enforced RBAC code; the contract names it
 * `reports.read`). Per-report `views`/`breakdown`/`topN`/`needsRange` describe
 * which controls the shared `ReportControls` shows.
 */

/** Enforced permission to see any report (RBAC catalog code, code-is-source-of-truth). */
export const REPORTS_VIEW_PERMISSION = "reports.report.view";
export const REPORTS_EXPORT_PERMISSION = "reports.report.export";
export const REPORTS_SCHEDULE_PERMISSION = "reports.report.schedule";

export interface SelectOption {
  value: string;
  label: string;
}

export interface ReportMeta {
  key: ReportKey;
  label: string;
  /** Report-type glyph shown in the Reports tab sub-nav (design-system §8.8). */
  icon: LucideIcon;
  description: string;
  /** Period range + bucket controls apply (sales/orders/products/customers/payments/promotions/search). */
  hasPeriod: boolean;
  /** Bucket selector (day/week/month) applies (sales only today). */
  hasBucket?: boolean;
  /** Breakdown dimension options (sales). */
  breakdowns?: SelectOption[];
  /** `view` toggle options (products/inventory/customers/search). */
  views?: SelectOption[];
  /** `metric` options (products). */
  metrics?: SelectOption[];
  /** Top-N ranking control applies. */
  hasTopN?: boolean;
  /** PDF export offered (CSV always). */
  pdf?: boolean;
}

const BUCKETS: SelectOption[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export const REPORT_CATALOG: ReportMeta[] = [
  {
    key: "sales",
    label: "Sales",
    icon: BarChart3,
    description: "Revenue, orders & AOV over time, with breakdowns.",
    hasPeriod: true,
    hasBucket: true,
    breakdowns: [
      { value: "none", label: "No breakdown" },
      { value: "payment_method", label: "By payment" },
      { value: "category", label: "By category" },
      { value: "delivery_zone", label: "By zone" },
    ],
    // TEMP (commented out per request, 2026-06-20): hides the "Export PDF" button
    // on the Sales report page. Re-enable by uncommenting. (Sales is the only
    // report with a PDF layout, so this is the only place PDF was offered.)
    // pdf: true,
  },
  {
    key: "orders",
    label: "Orders",
    icon: ShoppingCart,
    description: "Order counts & value by status; cancellation & return rates.",
    hasPeriod: true,
  },
  {
    key: "products",
    label: "Products",
    icon: Package,
    description: "Top sellers, by category, and slow movers.",
    hasPeriod: true,
    views: [
      { value: "top_sellers", label: "Top sellers" },
      { value: "by_category", label: "By category" },
      { value: "slow_movers", label: "Slow movers" },
    ],
    metrics: [
      { value: "units", label: "Units" },
      { value: "revenue", label: "Revenue" },
    ],
    hasTopN: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Boxes,
    description: "Stock levels, low/out of stock, and movement summary.",
    hasPeriod: false,
    views: [
      { value: "levels", label: "Levels" },
      { value: "low_stock", label: "Low stock" },
      { value: "out_of_stock", label: "Out of stock" },
      { value: "movement", label: "Movement" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    description: "New vs returning, repeat rate, and top lifetime value.",
    hasPeriod: true,
    views: [
      { value: "new_vs_returning", label: "New vs returning" },
      { value: "top_ltv", label: "Top LTV" },
    ],
    hasTopN: true,
  },
  {
    key: "payments",
    label: "Payments",
    icon: CreditCard,
    description: "Method split, paid online, COD collected & refunds.",
    hasPeriod: true,
  },
  {
    key: "promotions",
    label: "Promotions",
    icon: TicketPercent,
    description: "Per-coupon redemptions, discount given & attributed sales.",
    hasPeriod: true,
  },
  {
    key: "search",
    label: "Search insights",
    icon: Search,
    description: "Popular searches and zero-result queries.",
    hasPeriod: true,
    views: [
      { value: "popular", label: "Popular" },
      { value: "zero_results", label: "Zero results" },
    ],
    hasTopN: true,
  },
];

export function getReportMeta(key: string): ReportMeta | undefined {
  return REPORT_CATALOG.find((r) => r.key === key);
}

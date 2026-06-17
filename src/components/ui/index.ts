/**
 * Commerce Admin design-system primitives (design-system §8). Screens import
 * from here instead of hand-rolling Tailwind.
 */
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { Card, CardHeader, CardBody, CardFooter } from "./Card";
export { StatCard, AlertCounter } from "./StatCard";
export { Sparkline } from "./Sparkline";
export { Badge, StatusPill, DeltaChip } from "./Badge";
export type { BadgeTone } from "./Badge";
export {
  Table,
  THead,
  TBody,
  TH,
  TR,
  TD,
  TableTotalsRow,
  TablePagination,
} from "./Table";
export type { SortDir } from "./Table";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Select } from "./Select";
export type { SelectProps } from "./Select";
export { SegmentedControl } from "./SegmentedControl";
export type { SegmentOption } from "./SegmentedControl";
export { Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";
export { Skeleton, SkeletonRows } from "./Skeleton";
export { EmptyState, ErrorState } from "./EmptyState";
export { ChartCard } from "./ChartCard";
export type { LegendItem, ChartState } from "./ChartCard";
export { Drawer } from "./Drawer";
export { ConfirmDialog } from "./ConfirmDialog";
export { ToastViewport } from "./ToastViewport";

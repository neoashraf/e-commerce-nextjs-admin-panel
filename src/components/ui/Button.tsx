import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Button (design-system §8.1). Accent primary, neutral secondary, ghost
 * tertiary, destructive, and icon-only. Focus shows the accent ring.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "icon";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-600 text-accent-fg hover:bg-accent-700 disabled:bg-surface-subtle disabled:text-text-faint shadow-xs",
  secondary:
    "bg-surface border border-border-strong text-text hover:bg-surface-subtle disabled:text-text-faint",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-subtle disabled:text-text-faint",
  destructive:
    "bg-error text-white hover:bg-error/90 disabled:bg-surface-subtle disabled:text-text-faint shadow-xs",
  icon: "bg-transparent text-text-secondary hover:bg-surface-subtle disabled:text-text-faint",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Leading icon (rendered before the label; replaced by a spinner when loading). */
  leadingIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leadingIcon,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    const isIcon = variant === "icon";
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:shadow-none",
          isIcon ? ICON_SIZE[size] : SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leadingIcon
        )}
        {!isIcon && children}
        {isIcon && children}
      </button>
    );
  },
);

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  variant?: "success" | "warning" | "danger" | "info" | "muted";
  size?: "sm" | "xs";
  icon?: React.ReactNode;
  pulse?: boolean;
}

export function Badge({
  label,
  variant = "info",
  size = "sm",
  icon,
  pulse = false,
  className,
  ...props
}: BadgeProps) {
  const variantStyles = {
    success: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    danger: "bg-danger/20 text-danger border-danger/30",
    info: "bg-info/20 text-info border-info/30",
    muted: "bg-white/10 text-text-secondary border-white/10",
  };

  const sizeStyles = {
    xs: "text-[10px] px-2 py-0.5",
    sm: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              `bg-${variant}`
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              `bg-${variant}`
            )}
          />
        </span>
      )}
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}

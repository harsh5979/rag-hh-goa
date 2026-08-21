import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface GlowButtonProps extends Omit<HTMLMotionProps<"button">, "className"> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  className?: string;
}

export function GlowButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  disabled,
  ...props
}: GlowButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-medium rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500 overflow-hidden";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantStyles = {
    primary: "bg-brand-500 text-white hover:bg-brand-400 shadow-[var(--glow-primary)] hover:shadow-lg hover:shadow-brand-500/40",
    ghost: "bg-transparent text-text-primary hover:bg-white/10",
    danger: "bg-danger text-white hover:bg-danger/80 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || isLoading ? 1 : 0.96 }}
      className={cn(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        (disabled || isLoading) && "opacity-60 cursor-not-allowed shadow-none",
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span className={cn(isLoading && "opacity-80")}>{children as React.ReactNode}</span>
    </motion.button>
  );
}


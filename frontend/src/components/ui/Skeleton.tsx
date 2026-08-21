import React from "react";
import { cn } from "@/lib/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "full" | "lg" | "md";
}

export function Skeleton({ rounded = "md", className, ...props }: SkeletonProps) {
  const roundedStyles = {
    full: "rounded-full",
    lg: "rounded-2xl",
    md: "rounded-md",
  };

  return (
    <div
      className={cn(
        "bg-white/5 overflow-hidden relative",
        roundedStyles[rounded],
        className
      )}
      {...props}
    >
      {/* Shimmer effect */}
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}

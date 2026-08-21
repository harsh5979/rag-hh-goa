import React from 'react';
import { cn } from '@/lib/utils/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: "primary" | "accent" | "none";
}

export function GlassCard({ children, className, glowColor = "none", ...props }: GlassCardProps) {
  const glowClass = {
    primary: "shadow-[var(--glow-primary)]",
    accent: "shadow-[var(--glow-accent)]",
    none: ""
  }[glowColor];

  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 transition-all duration-300",
        "hover:border-white/20 hover:bg-white/5",
        glowClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

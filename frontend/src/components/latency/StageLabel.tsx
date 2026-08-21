import React from "react";
import { cn } from "@/lib/utils/cn";

interface StageLabelProps {
  name: string;
  ms: number;
  colorClass: string;
}

export function StageLabel({ name, ms, colorClass }: StageLabelProps) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", colorClass)} />
      <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{name}</span>
      <span className="text-xs font-mono font-medium text-text-primary">{ms}ms</span>
    </div>
  );
}

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import type { PipelineResponse } from "@/lib/api/types";

interface ModeBadgeProps {
  mode: PipelineResponse["generation_mode"];
  latencyMs?: number;
}

export function ModeBadge({ mode, latencyMs }: ModeBadgeProps) {
  const config: Record<string, { label: string; icon: string; variant: "info" | "warning" | "muted"; desc: string }> = {
    extractive: { label: "Extractive", icon: "⚡", variant: "info", desc: "Fast extractive QA. Bypassed Groq LLM." },
    groq: { label: "Groq", icon: "🧠", variant: "warning", desc: "Generated using Llama 3 on Groq LPU." },
    fallback: { label: "Fallback", icon: "🛡️", variant: "muted", desc: "Fallback LLM used due to timeout or refusal." },
  };

  const c = config[mode] || config.fallback;
  const label = latencyMs ? `${c.label} · ${latencyMs}ms` : c.label;

  return (
    <Tooltip content={<p className="w-48 text-center">{c.desc}</p>}>
      <span>
        <Badge label={label} icon={c.icon} variant={c.variant} />
      </span>
    </Tooltip>
  );
}

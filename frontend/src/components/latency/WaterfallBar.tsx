import React from "react";
import { motion } from "framer-motion";
import { StageLabel } from "./StageLabel";
import type { StageTiming } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/Skeleton";

export function WaterfallBar({ timings }: { timings: StageTiming | null }) {
  if (!timings) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 pb-12">
        <div className="flex flex-col gap-4">
          <Skeleton className="w-full h-3" rounded="full" />
          <div className="flex justify-between px-2">
             <Skeleton className="w-12 h-8" />
             <Skeleton className="w-12 h-8" />
             <Skeleton className="w-12 h-8" />
             <Skeleton className="w-12 h-8" />
          </div>
        </div>
      </div>
    );
  }

  // Calculate widths based on total
  const totalMs = timings.total_ms || 1;
  const stages = [
    { key: "stt", name: "STT", ms: timings.stt_ms || 0, color: "bg-warning", visible: (timings.stt_ms || 0) > 0 },
    { key: "embed", name: "Embed", ms: timings.embed_ms || 0, color: "bg-brand-accent", visible: true },
    { key: "retrieve", name: "Retrieve", ms: (timings.retrieve_dense_ms || 0) + (timings.retrieve_sparse_ms || 0), color: "bg-brand-400", visible: true },
    { key: "rerank", name: "Rerank", ms: timings.rerank_ms || 0, color: "bg-brand-700", visible: true },
    { key: "generate", name: "Generate", ms: timings.generate_ms || 0, color: "bg-success", visible: true },
    { key: "ground", name: "Grounding", ms: timings.grounding_ms || 0, color: "bg-info", visible: (timings.grounding_ms || 0) > 0 }
  ].filter(s => s.visible && (s.ms || 0) > 0);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-12 mt-4 relative z-10">
      <div className="flex items-center gap-4 mb-3">
        <h3 className="text-sm font-medium text-text-secondary">Pipeline Latency</h3>
        <span className="text-sm font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded border border-white/5">
          {timings.total_ms}ms total
        </span>
      </div>

      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex shadow-inner">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.key}
            className={stage.color}
            initial={{ width: 0 }}
            animate={{ width: `${(stage.ms / totalMs) * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.8, delay: i * 0.1 }}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-between mt-4 px-2 gap-y-4">
        {stages.map((stage) => (
          <StageLabel key={stage.key} name={stage.name} ms={stage.ms} colorClass={stage.color} />
        ))}
      </div>
    </div>
  );
}

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";

interface Stats {
  total: { p50: number; p70: number; p100: number };
  retrieve: { p50: number; p70: number; p100: number };
  generate: { p50: number; p70: number; p100: number };
}

export function P50P70P100Cards({ stats, className }: { stats: Stats; className?: string }) {
  const Card = ({ title, data, glow, color }: any) => (
    <GlassCard glowColor={glow} className="flex-1">
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${color}`}>{title}</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-muted text-sm">Total</span>
          <span className="font-mono font-medium text-white">{data.total}ms</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted text-sm">Retrieval</span>
          <span className="font-mono text-brand-400">{data.retrieve}ms</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted text-sm">Generation</span>
          <span className="font-mono text-success">{data.generate}ms</span>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      <Card title="P50 (Median)" data={{ total: stats.total.p50, retrieve: stats.retrieve.p50, generate: stats.generate.p50 }} glow="none" color="text-success" />
      <Card title="P70" data={{ total: stats.total.p70, retrieve: stats.retrieve.p70, generate: stats.generate.p70 }} glow="none" color="text-warning" />
      <Card title="P100 (Max)" data={{ total: stats.total.p100, retrieve: stats.retrieve.p100, generate: stats.generate.p100 }} glow="danger" color="text-danger" />
    </div>
  );
}

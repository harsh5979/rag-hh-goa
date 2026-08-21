import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PipelineResponse } from "@/lib/api/types";

export function LatencyChart({ history, className }: { history: PipelineResponse[]; className?: string }) {
  if (history.length === 0) {
    return (
      <GlassCard className={`flex items-center justify-center min-h-[300px] ${className}`}>
        <p className="text-text-muted">No query history yet. Make some queries to see latency trends.</p>
      </GlassCard>
    );
  }

  const data = history.map((h, i) => ({
    id: i + 1,
    generate: h.timings?.generate_ms || 0,
    retrieve: (h.timings?.retrieve_dense_ms || 0) + (h.timings?.retrieve_sparse_ms || 0),
    total: h.timings?.total_ms || 0,
  }));

  return (
    <GlassCard className={`min-h-[300px] ${className}`}>
      <h3 className="text-sm font-medium text-text-secondary mb-6">Latency Trends (ms)</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="id" hide />
            <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => `${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--glass-border)', borderRadius: '8px' }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="Total Latency"
              stroke="var(--brand-500)"
              fillOpacity={1}
              fill="url(#colorTotal)"
            />
            <Area
              type="monotone"
              dataKey="generate"
              name="Generation (Groq)"
              stroke="var(--success)"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="retrieve"
              name="Retrieval (Hybrid)"
              stroke="var(--brand-400)"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

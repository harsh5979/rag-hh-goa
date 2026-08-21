import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import type { GuardrailEvent } from "@/store/analyticsStore";

export function GuardrailTable({ events, className }: { events: GuardrailEvent[]; className?: string }) {
  return (
    <GlassCard className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-text-secondary">Guardrail Triggers (Last 50)</h3>
        <Badge label={`${events.length} events`} variant="muted" />
      </div>

      <div className="flex-1 overflow-auto pr-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-muted opacity-70">
            <span className="text-4xl mb-3">🛡️</span>
            <p>No guardrail events triggered yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-xl border ${event.severity === "danger" ? "bg-danger/5 border-danger/20" : "bg-warning/5 border-warning/20"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge 
                    label={event.type} 
                    variant={event.severity} 
                    size="xs" 
                  />
                  <span className="text-[10px] text-text-muted font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-text-primary mb-1 line-clamp-1 opacity-90">"{event.query}"</p>
                <p className="text-xs text-text-muted flex items-center gap-1.5">
                  <span className="text-[10px]">↳</span> {event.action}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

import React from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

export function RefusalCard({ reason }: { reason: string | null }) {
  return (
    <motion.div
      initial={{ x: 0 }}
      animate={{ x: [0, -8, 8, -6, 6, 0] }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard glowColor="accent" className="border-danger/30 bg-danger/5">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🚫</div>
          <div>
            <h3 className="text-lg font-bold text-danger mb-1">Request Blocked</h3>
            <p className="text-text-primary mb-3">
              {reason || "This query was blocked by the safety guardrails."}
            </p>
            <p className="text-sm text-text-secondary">
              Try asking a question related to technology, science, or topics present in the MSMARCO dataset.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

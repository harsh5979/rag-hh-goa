import React from "react";
import { Badge } from "@/components/ui/Badge";
import type { GuardrailFlags } from "@/lib/api/types";

export function GuardrailRow({ flags }: { flags: GuardrailFlags }) {
  if (!flags) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/5">
      <span className="text-xs font-medium text-text-muted">Guardrails:</span>
      
      {flags.input_safe ? (
        <Badge label="Safe" icon="✓" variant="success" />
      ) : (
        <Badge label="Unsafe Input" icon="✕" variant="danger" pulse />
      )}

      {flags.on_topic ? (
        <Badge label="On-Topic" icon="✓" variant="success" />
      ) : (
        <Badge label="Off-Topic" icon="✕" variant="warning" pulse />
      )}

      {flags.retrieval_confident ? (
        <Badge label="Confident" icon="✓" variant="success" />
      ) : (
        <Badge label="Low Confidence" icon="✕" variant="warning" />
      )}

      {flags.grounding_passed ? (
        <Badge label="Grounded" icon="✓" variant="success" />
      ) : (
        <Badge label="Hallucination Risk" icon="✕" variant="danger" pulse />
      )}
    </div>
  );
}

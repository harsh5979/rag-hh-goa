import React, { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { ModeBadge } from "./ModeBadge";
import { SourceChips } from "./SourceChips";
import { GuardrailRow } from "./GuardrailRow";
import { RefusalCard } from "./RefusalCard";
import type { PipelineResponse } from "@/lib/api/types";

interface AnswerCardProps {
  result: PipelineResponse;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

export function AnswerCard({ result, onSpeak, isSpeaking = false }: AnswerCardProps) {
  const [copied, setCopied] = useState(false);

  if (result.refused) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 pb-8">
        <RefusalCard reason={result.refusal_reason || null} />
      </div>
    );
  }

  const handleCopy = async () => {
    if (result.answer) {
      await navigator.clipboard.writeText(result.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if (onSpeak && result.answer) {
      onSpeak(result.answer);
    }
  };

  const confidenceScore = result.confidence !== undefined 
    ? Math.round(result.confidence * 100) 
    : 95;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
      className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-6 relative z-20"
    >
      <GlassCard glowColor="primary" className="border-brand-500/30 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 bg-slate-950/60">
        {/* Header: Query Transcript + Actions */}
        {result.transcript && (
          <div className="mb-5 pb-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold uppercase">
                Query
              </span>
              <span className="text-sm sm:text-base text-white/90 font-medium truncate italic">
                "{result.transcript}"
              </span>
            </div>
            {result.ms_stt && result.ms_stt > 0 ? (
              <span className="text-xs font-mono text-text-muted shrink-0">
                STT: {result.ms_stt.toFixed(0)}ms
              </span>
            ) : null}
          </div>
        )}

        {/* Answer Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center shadow-md">
              <span className="text-white text-base">✨</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight">
                Generated Answer
              </h2>
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                {result.model_used && <span>Model: {result.model_used}</span>}
                <span>• Confidence: {confidenceScore}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModeBadge mode={result.generation_mode} latencyMs={result.timings?.generate_ms} />
            
            {/* Audio Speech Synthesis Button */}
            {onSpeak && (
              <button
                onClick={handleSpeak}
                title={isSpeaking ? "Stop voice playback" : "Listen to answer"}
                className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSpeaking
                    ? "bg-rose-500/20 border-rose-400/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse"
                    : "bg-white/5 hover:bg-brand-500/20 border-white/10 text-text-secondary hover:text-white"
                }`}
              >
                <span>{isSpeaking ? "⏹️" : "🔊"}</span>
                <span className="hidden sm:inline">{isSpeaking ? "Stop" : "Listen"}</span>
              </button>
            )}

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              title="Copy answer text"
              className="p-2 rounded-xl bg-white/5 hover:bg-brand-500/20 border border-white/10 text-xs text-text-secondary hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{copied ? "✓" : "📋"}</span>
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
        
        {/* Main Answer Content */}
        <div className="prose prose-invert max-w-none">
          <p className="text-white leading-relaxed text-base sm:text-lg whitespace-pre-wrap font-normal select-text">
            {result.answer}
          </p>
        </div>

        {/* Retrieved MSMARCO-XI Sources */}
        <SourceChips sources={result.sources} />

        {/* Safety & Groundedness Guardrails */}
        {result.guardrail_flags && <GuardrailRow flags={result.guardrail_flags} />}
      </GlassCard>
    </motion.div>
  );
}


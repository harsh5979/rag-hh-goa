"use client";

import React from "react";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { LatencyChart } from "./LatencyChart";
import { P50P70P100Cards } from "./P50P70P100Cards";
import { GuardrailTable } from "./GuardrailTable";
import { GlassCard } from "@/components/ui/GlassCard";

export function AnalyticsView() {
  const { history, events, stats } = useAnalytics();

  return (
    <section className="w-full max-w-6xl mx-auto py-4 px-2 sm:px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white flex items-center gap-2">
            📊 System & Latency Analytics
          </h1>
          <p className="text-text-secondary mt-1 text-sm sm:text-base">
            HH Goa 2026 Task 2: P50/P70/P100 latency targets (&lt;200ms) and safety guardrail observability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-mono font-semibold">
            ⚡ Target: &lt; 200ms
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-mono font-semibold">
            📚 Dataset: MSMARCO-XI
          </div>
        </div>
      </div>

      {/* Task 2 Architectural Specifications Card */}
      <GlassCard glowColor="primary" className="p-6 bg-slate-950/60 border-brand-500/20">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>🛠️</span> Pipeline Architecture & Chunking Strategy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <span className="font-semibold text-brand-300 block">1. Speech-to-Text</span>
            <p className="text-text-secondary">Sarvam AI (Saaras) with Web Speech API instant interim fallback.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <span className="font-semibold text-cyan-300 block">2. Multi Chunking</span>
            <p className="text-text-secondary">Semantic boundary splitting + 20% overlap + metadata ID tags on MSMARCO-XI.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <span className="font-semibold text-amber-300 block">3. Hybrid Retrieval</span>
            <p className="text-text-secondary">FAISS Dense (all-MiniLM-L6-v2) + BM25 Sparse + Cross-Encoder Reranker.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <span className="font-semibold text-emerald-300 block">4. Harness & Guardrails</span>
            <p className="text-text-secondary">Groq Llama 3 waterfall + Toxicity, PII, Off-Topic & Groundedness checks.</p>
          </div>
        </div>
      </GlassCard>

      {/* P50 / P70 / P100 Metrics */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Latency Percentiles across Queries
        </h3>
        <P50P70P100Cards stats={stats} />
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LatencyChart history={history} className="col-span-1 lg:col-span-2" />
        <GuardrailTable events={events} className="col-span-1" />
      </div>
    </section>
  );
}


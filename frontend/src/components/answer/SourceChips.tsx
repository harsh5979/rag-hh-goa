import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Source } from "@/lib/api/types";

export function SourceChips({ sources }: { sources: Source[] }) {
  const [selectedSource, setSelectedSource] = useState<{ source: Source; index: number } | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          MSMARCO-XI Retrieved Passages ({sources.length}):
        </span>
        <span className="text-[11px] text-text-muted">Click passage to inspect context</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((source, idx) => {
          const id = source.passage_id || (source.metadata && source.metadata.id) || `Passage #${idx + 1}`;
          const scorePercent = typeof source.score === "number" ? Math.round(source.score * 100) : null;
          
          return (
            <motion.button
              key={`${id}-${idx}`}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedSource({ source, index: idx })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 text-brand-300 text-xs font-mono transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(108,99,255,0.25)]"
            >
              <span>📄</span>
              <span className="font-semibold">{id}</span>
              {scorePercent !== null && (
                <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20">
                  {scorePercent}%
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Expanded Passage Modal */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setSelectedSource(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-slate-900 border border-brand-500/30 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">
                      {selectedSource.source.passage_id || `Passage #${selectedSource.index + 1}`}
                    </h3>
                    <span className="text-xs text-brand-300">
                      Rerank Rank: #{selectedSource.index + 1}
                      {selectedSource.source.method ? ` • Method: ${selectedSource.source.method}` : ""}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap select-text">
                  {selectedSource.source.text}
                </p>
              </div>

              {selectedSource.source.metadata && Object.keys(selectedSource.source.metadata).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-text-muted uppercase">Metadata:</span>
                  <pre className="text-[11px] font-mono bg-black/40 p-3 rounded-lg text-brand-200 overflow-x-auto">
                    {JSON.stringify(selectedSource.source.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


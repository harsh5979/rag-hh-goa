import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";

interface TranscriptCardProps {
  text: string;
  confidence?: number;
  language?: string;
  isLoading?: boolean;
}

export function TranscriptCard({ text, confidence, language, isLoading }: TranscriptCardProps) {
  if (isLoading && !text) {
    return (
      <GlassCard className="w-full max-w-2xl mx-auto mt-8 border-brand-500/20">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
          <h3 className="text-sm font-medium text-text-secondary">Transcript</h3>
          <Skeleton className="w-16 h-6" rounded="full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-5/6 h-4" />
          <Skeleton className="w-4/6 h-4" />
        </div>
      </GlassCard>
    );
  }

  if (!text && !isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto mt-8"
    >
      <GlassCard glowColor="primary" className="border-brand-500/30">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-text-secondary">Transcript</h3>
            {language && <Badge label={language} variant="muted" />}
          </div>
          {confidence !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Confidence</span>
              <ProgressRing value={confidence * 100} size={32} strokeWidth={3} label={`${(confidence * 100).toFixed(0)}%`} colorClass={confidence > 0.8 ? "text-success" : "text-warning"} />
            </div>
          )}
        </div>
        
        <div className="min-h-[80px]">
          <p className="text-lg leading-relaxed text-text-primary">
            {text}
            <span className="inline-block w-2 h-5 ml-1 bg-brand-accent animate-pulse align-middle" />
          </p>
        </div>
        
      </GlassCard>
    </motion.div>
  );
}

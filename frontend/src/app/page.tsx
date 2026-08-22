"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceQuery } from "@/lib/hooks/useVoiceQuery";
import { useTextQuery } from "@/lib/hooks/useTextQuery";
import PixelCanvas from "@/components/ui/PixelCanvas";
import type { PipelineResponse } from "@/lib/api/types";

/* ━━━━━━━━━━━━━━━━━━━━ THEME TOKENS ━━━━━━━━━━━━━━━━━━━━ */
const T = {
  bgVoid: "#060810",
  bgBase: "#080B14",
  bgSurface: "#0E131F",
  bgElevated: "#141A29",
  bgInput: "#0B0F19",
  brand: "#6C63FF",
  brandLight: "#8B7FFF",
  brandDim: "rgba(108,99,255,0.12)",
  brandBdr: "rgba(108,99,255,0.3)",
  brandGlow: "rgba(108,99,255,0.4)",
  emerald: "#10B981",
  emeraldDim: "rgba(16,185,129,0.12)",
  emeraldBdr: "rgba(16,185,129,0.3)",
  accent: "#38BDF8",
  purple: "#A855F7",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#F8FAFC",
  textMain: "#F8FAFC",
  textSec: "#94A3B8",
  textMuted: "#64748B",
  textFaint: "rgba(148,163,184,0.45)",
  glass: "rgba(255,255,255,0.035)",
  glassBdr: "rgba(255,255,255,0.08)",
  sep: "rgba(148,163,184,0.2)",
};

const CHUNK_COUNT = 3273;
const LATENCY_BUDGET_MS = 200;

/* Multilingual Domain Suggestion Queries across 11 Indic Languages */
const SUGGESTIONS = [
  { lang: "EN", label: "What was the Manhattan Project?", query: "What was the Manhattan Project?" },
  { lang: "HI", label: "प्रकाश संश्लेषण क्या है?", query: "प्रकाश संश्लेषण क्या है?" },
  { lang: "GU", label: "સૂર્યમંડળમાં કેટલા ગ્રહો છે?", query: "સૂર્યમંડળમાં કેટલા ગ્રહો છે?" },
  { lang: "MR", label: "सूर्यमालेत किती ग्रह आहेत?", query: "सूर्यमालेत किती ग्रह आहेत?" },
];

/* ━━━━━━━━━━━━━━━━━━━━ SARVAM MANDALA EMBLEM SVG ━━━━━━━━━━━━━━━━━━━━ */
function SarvamMandala({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block" }}
    >
      <circle cx="50" cy="50" r="12" stroke={T.brandLight} strokeWidth="2.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <g key={i} transform={`rotate(${angle}, 50, 50)`}>
          <path
            d="M50 18 C44 28, 44 38, 50 48 C56 38, 56 28, 50 18 Z"
            stroke="url(#mandalaGrad)"
            strokeWidth="2"
            fill="rgba(108,99,255,0.06)"
          />
        </g>
      ))}
      <defs>
        <linearGradient id="mandalaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={T.accent} />
          <stop offset="50%" stopColor={T.brand} />
          <stop offset="100%" stopColor={T.emerald} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ INLINE RESULT CARD (CLEAN & MINIMAL) ━━━━━━━━━━━━━━━━━━━━ */
function InlineResultCard({
  result, query, onClose, onSpeak, isSpeaking, onStopSpeaking,
}: {
  result: PipelineResponse; query: string; onClose: () => void; onSpeak?: (text: string) => void; isSpeaking?: boolean; onStopSpeaking?: () => void;
}) {
  const [showChunks, setShowChunks] = useState(false);
  const totalMs = result.timings?.total_ms ?? result.ms_total ?? 0;
  const formattedLatency = totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${Math.round(totalMs)}ms`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        width: "100%",
        background: "rgba(11, 15, 25, 0.92)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${T.glassBdr}`,
        borderRadius: 12,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
      }}
    >
      {/* ─── Top Bar: Latency & Actions ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, fontFamily: "monospace", color: T.accent,
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            padding: "2px 8px", borderRadius: 4, fontWeight: 700,
          }}>
            <span>⚡</span>
            <span>{formattedLatency}</span>
          </div>
        </div>

        {/* Actions (Speak / Stop & Close) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onSpeak && result.answer && (
            <button
              type="button"
              onClick={() => (isSpeaking ? onStopSpeaking?.() : onSpeak(result.answer))}
              style={{
                background: isSpeaking ? "rgba(239,68,68,0.15)" : "rgba(108,99,255,0.12)",
                border: `1px solid ${isSpeaking ? "rgba(239,68,68,0.35)" : T.brandBdr}`,
                borderRadius: 5,
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                color: isSpeaking ? T.danger : T.brandLight,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {isSpeaking ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                  </svg>
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  <span>Listen</span>
                </>
              )}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close answer"
            style={{
              background: "rgba(255,255,255,0.05)", border: `1px solid ${T.glassBdr}`,
              color: T.textMuted, borderRadius: 5,
              fontSize: 13, cursor: "pointer", padding: "3px 8px", lineHeight: 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.textMain)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Query Echo ─── */}
      {query && (
        <div style={{
          fontSize: 13, color: T.textSec, fontStyle: "italic",
          borderLeft: `2px solid ${T.brand}`, paddingLeft: 10,
        }}>
          "{query}"
        </div>
      )}

      {/* ─── Answer Text ─── */}
      <div style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: T.textMain,
        fontWeight: 400,
      }}>
        {result.answer}
      </div>

      {/* ─── Sources Toggle ─── */}
      {result.sources && result.sources.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4, borderTop: `1px solid ${T.glassBdr}` }}>
          <button
            onClick={() => setShowChunks((v) => !v)}
            style={{
              background: "transparent",
              border: `1px solid ${T.glassBdr}`,
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 11,
              fontFamily: "monospace",
              color: T.textMuted,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {showChunks ? "▲ Hide retrieved passages" : `▼ View ${result.sources.length} sources`}
          </button>
        </div>
      )}

      {/* ─── Expandable Source Chunks ─── */}
      <AnimatePresence>
        {showChunks && result.sources && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}
          >
            {result.sources.map((s, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${T.glassBdr}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: T.textSec,
                  lineHeight: 1.55,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: T.textMuted, marginBottom: 4 }}>
                  <span style={{ color: T.brandLight, fontWeight: 700 }}>SOURCE CHUNK #{idx + 1}</span>
                  <span>score: {s.score.toFixed(3)}</span>
                </div>
                <div>{s.text}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InlineResultCardSkeleton({ query }: { query?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      style={{
        width: "100%",
        background: "rgba(11, 15, 25, 0.92)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${T.glassBdr}`,
        borderRadius: 12,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
      }}
    >
      {/* ─── Top Bar Placeholder ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 14, height: 14, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }} className="animate-pulse" />
          <div style={{ width: 45, height: 12, background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        </div>
        <div style={{ width: 18, height: 18, background: "rgba(255,255,255,0.08)", borderRadius: 3 }} className="animate-pulse" />
      </div>

      {/* ─── Query Echo Skeleton ─── */}
      {query && (
        <div style={{ fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
          "{query}"
        </div>
      )}

      {/* ─── Answer Skeleton Lines ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.7, marginTop: 4 }}>
        <div style={{ height: 14, width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        <div style={{ height: 14, width: "95%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        <div style={{ height: 14, width: "70%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
      </div>

      {/* ─── Generation Indicator ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${T.brand}`, borderTopColor: "transparent" }} className="animate-spin" />
        <span style={{ fontSize: 11, fontFamily: "monospace", color: T.brandLight, fontWeight: 600 }}>RETRIEVING & SYNTHESIZING MULTILINGUAL ANSWER...</span>
      </div>
    </motion.div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ MAIN PAGE ━━━━━━━━━━━━━━━━━━━━ */
export default function VoiceRagPage() {
  const [inputVal, setInputVal] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const voice = useVoiceQuery();
  const text = useTextQuery();

  const isVoiceActive = voice.isRecognizing || voice.recorderState === "recognizing";
  const isLoading = voice.isLoading || text.isLoading;
  const result = voice.result || text.result;

  const submit = useCallback(async (queryToSubmit: string) => {
    const q = queryToSubmit.trim();
    if (!q || isLoading) return;
    setSubmittedQuery(q);
    setInputVal("");

    voice.unlockAudio();
    voice.clearResult?.();

    await text.search(q);
  }, [isLoading, text, voice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(inputVal);
  };

  const clearAll = useCallback(() => {
    setInputVal("");
    setSubmittedQuery("");
    text.clearResult();
    voice.clearResult?.();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [text, voice]);

  // Sync live microphone transcript into the input bar in real-time
  useEffect(() => {
    if (voice.liveTranscript) {
      setInputVal(voice.liveTranscript);
    }
  }, [voice.liveTranscript]);

  const displayQuery = submittedQuery || result?.transcript || voice.liveTranscript || "";

  return (
    <div style={{
      width: "100vw",
      minHeight: "100dvh",
      background: T.bgVoid,
      color: T.textMain,
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-inter), -apple-system, sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>

      {/* ══════ INTERACTIVE AMBIENT BACKGROUND CANVAS ══════ */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        opacity: 0.92,
        pointerEvents: "auto",
      }}>
        <PixelCanvas />
      </div>

      {/* Subtle radial dark overlay for high contrast readability while keeping pixel art vivid */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        background: "radial-gradient(ellipse 85% 65% at 50% 35%, rgba(6,8,16,0.3) 0%, rgba(6,8,16,0.78) 100%)",
        pointerEvents: "none",
      }} />

      {/* ══════ TOP APP BAR ══════ */}
      <header style={{
        position: "relative", zIndex: 20, flexShrink: 0, height: 48,
        borderBottom: `1px solid ${T.glassBdr}`,
        background: "rgba(6,8,16,0.85)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
      }}>
        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isLoading ? T.warning : T.emerald,
            boxShadow: `0 0 10px ${isLoading ? T.warning : T.emerald}`,
            display: "block",
          }} className={isLoading ? "animate-pulse" : ""} />
          <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textSec, letterSpacing: 0.8, fontWeight: 600 }}>
            {isLoading ? "processing pipeline…" : `${CHUNK_COUNT.toLocaleString()} indexed chunks`}
          </span>
        </div>

        <span style={{ color: T.sep, fontSize: 13 }}>·</span>

        <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textMuted, letterSpacing: 0.8 }}>
          11 Indic Languages Supported
        </span>

        <div style={{ flex: 1 }} />

        {/* Team badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontFamily: "monospace", letterSpacing: 1.5,
            textTransform: "uppercase", fontWeight: 800,
            background: `linear-gradient(90deg, ${T.brand}, ${T.purple}, ${T.emerald})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            AlphaCODERS
          </span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: T.textFaint, letterSpacing: 1, textTransform: "uppercase" }}>
            · HH GOA 2026
          </span>
        </div>
      </header>

      {/* ══════ MAIN CENTERED STUDIO CONTAINER ══════ */}
      <main style={{
        position: "relative",
        zIndex: 10,
        flex: 1,
        width: "100%",
        maxWidth: 780,
        margin: "0 auto",
        padding: "36px 20px 60px",
        display: "flex",
        flexDirection: "column",
        justifyContent: result || isLoading ? "flex-start" : "center",
        alignItems: "center",
        gap: 20,
        minHeight: "calc(100dvh - 48px)",
      }}>

        {/* ─── Sarvam Mandala Emblem & Centered Header ─── */}
        <motion.div
          animate={{ scale: result || isLoading ? 0.92 : 1, y: result || isLoading ? 0 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}
        >
          <motion.div
            whileHover={{ rotate: 180, scale: 1.08 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            style={{ cursor: "pointer", filter: "drop-shadow(0 0 16px rgba(108,99,255,0.35))" }}
          >
            <SarvamMandala size={48} />
          </motion.div>

          <h1 style={{
            fontSize: "clamp(26px, 3.2vw, 36px)",
            fontWeight: 800,
            letterSpacing: -0.8,
            lineHeight: 1.1,
            color: T.textMain,
            margin: 0,
            fontFamily: "var(--font-space-grotesk), sans-serif",
            background: "linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            VoiceRAG Studio
          </h1>

          <p style={{
            fontSize: 13,
            color: T.textSec,
            maxWidth: 520,
            lineHeight: 1.5,
            margin: 0,
          }}>
            Speak or ask questions across <strong>11 Indic Languages</strong> with ultra-low sub-200ms document retrieval & Sarvam voice synthesis.
          </p>
        </motion.div>

        {/* ─── Centered Search & Voice Input Box ─── */}
        <form onSubmit={handleSubmit} style={{ width: "100%", position: "relative" }}>
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            background: "rgba(14, 19, 31, 0.95)",
            backdropFilter: "blur(20px)",
            border: `1.5px solid ${isVoiceActive ? T.brand : "rgba(255, 255, 255, 0.12)"}`,
            borderRadius: 12,
            padding: "8px 10px 8px 12px",
            boxShadow: isVoiceActive ? `0 0 30px ${T.brandGlow}` : "0 8px 30px rgba(0,0,0,0.4)",
            transition: "all 0.25s ease",
          }}>
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={voice.toggle}
              aria-label="Toggle voice recording"
              title={isVoiceActive ? "Stop voice recording" : "Click to speak in any language"}
              style={{
                background: isVoiceActive ? "rgba(239,68,68,0.2)" : "rgba(108,99,255,0.15)",
                border: `1px solid ${isVoiceActive ? T.danger : T.brandBdr}`,
                borderRadius: 8,
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                marginRight: 10,
                transition: "all 0.2s",
                flexShrink: 0,
                color: isVoiceActive ? T.danger : T.brandLight,
                boxShadow: isVoiceActive ? "0 0 14px rgba(239,68,68,0.5)" : "none",
              }}
            >
              {isVoiceActive ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              )}
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={isVoiceActive ? "Listening to your voice..." : "Ask a question in any language (e.g. Hindi, Gujarati, Tamil, English)..."}
              disabled={isLoading}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: T.textMain,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />

            {/* Clear button */}
            {inputVal.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.textMuted,
                  fontSize: 15,
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                ✕
              </button>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!inputVal.trim() || isLoading}
              style={{
                background: inputVal.trim() && !isLoading ? T.brand : "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: 8,
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputVal.trim() && !isLoading ? "pointer" : "default",
                transition: "all 0.2s",
                flexShrink: 0,
                boxShadow: inputVal.trim() && !isLoading ? `0 0 15px ${T.brandGlow}` : "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={inputVal.trim() && !isLoading ? "#FFF" : T.textMuted} strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Voice Listening Active Banner */}
          {isVoiceActive && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginTop: 8, padding: "8px 14px",
                background: "rgba(108,99,255,0.12)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${T.brandBdr}`,
                borderRadius: 8,
                fontSize: 12,
                color: T.textSec,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: T.brandLight,
                  boxShadow: `0 0 10px ${T.brandLight}`,
                }} className="animate-pulse" />
                <span style={{ fontWeight: 700, color: T.textMain }}>Listening…</span>
                <span style={{ color: T.textMuted, fontStyle: voice.liveTranscript ? "italic" : "normal" }}>
                  {voice.liveTranscript ? `"${voice.liveTranscript}"` : "Speak now into your microphone"}
                </span>
              </div>
              <button
                type="button"
                onClick={voice.stopRecording}
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: T.danger,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ⏹ STOP & SEARCH
              </button>
            </motion.div>
          )}
        </form>

        {/* ─── Suggestion Chips (Centered - Only shown when no answer is active) ─── */}
        {!result && !isLoading && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, width: "100%" }}>
            {(showAllSuggestions ? SUGGESTIONS : SUGGESTIONS.slice(0, 4)).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => submit(item.query)}
                style={{
                  background: "rgba(14, 19, 31, 0.85)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${T.glassBdr}`,
                  borderRadius: 6,
                  padding: "6px 11px",
                  fontSize: 12,
                  color: T.textSec,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.brandBdr;
                  e.currentTarget.style.color = T.textMain;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.glassBdr;
                  e.currentTarget.style.color = T.textSec;
                  e.currentTarget.style.transform = "translateY(0px)";
                }}
              >
                <span style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  padding: "2px 4px",
                  borderRadius: 3,
                  fontWeight: 700,
                  background: item.lang === "HI" ? "rgba(245,158,11,0.15)" : item.lang === "GU" ? "rgba(16,185,129,0.15)" : "rgba(108,99,255,0.15)",
                  color: item.lang === "HI" ? T.warning : item.lang === "GU" ? T.success : T.brandLight,
                  border: `1px solid ${item.lang === "HI" ? "rgba(245,158,11,0.3)" : item.lang === "GU" ? "rgba(16,185,129,0.3)" : "rgba(108,99,255,0.3)"}`,
                }}>
                  {item.lang}
                </span>
                <span>{item.label}</span>
              </button>
            ))}

            {/* Expand / Collapse Button */}
            {SUGGESTIONS.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllSuggestions((v) => !v)}
                style={{
                  background: "rgba(108,99,255,0.1)",
                  border: `1px solid ${T.brandBdr}`,
                  borderRadius: 6,
                  padding: "6px 11px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: T.brandLight,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 600,
                }}
              >
                <span>{showAllSuggestions ? "▴ less" : `+${SUGGESTIONS.length - 4} languages ▾`}</span>
              </button>
            )}
          </div>
        )}

        {/* ─── Centered Inline Result Card ─── */}
        <div style={{ width: "100%", marginTop: 6 }}>
          <AnimatePresence mode="wait">
            {isLoading && (
              <InlineResultCardSkeleton key="skeleton" query={displayQuery} />
            )}
            {!isLoading && result && (
              <InlineResultCard
                key="result"
                result={result}
                query={displayQuery}
                onClose={clearAll}
                onSpeak={voice.speakAnswer}
                isSpeaking={voice.isSpeakingAnswer}
                onStopSpeaking={voice.stopSpeaking}
              />
            )}
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}


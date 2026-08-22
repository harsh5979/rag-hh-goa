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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      style={{
        width: "100%",
        background: "rgba(14, 19, 31, 0.95)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${T.glassBdr}`,
        borderRadius: 8,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* ─── Top Bar: Latency & Actions ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "monospace", color: T.textMuted }}>
          <span style={{ color: T.accent }}>⚡</span>
          <span>{formattedLatency}</span>
        </div>

        {/* Actions (Speak / Stop & Close) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>


          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close answer"
            style={{
              background: "transparent", border: "none", color: T.textMuted,
              fontSize: 15, cursor: "pointer", padding: "0 4px", lineHeight: 1,
              transition: "color 0.15s",
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
        <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
          "{query}"
        </div>
      )}

      {/* ─── Answer Text ─── */}
      <div style={{
        fontSize: 14,
        lineHeight: 1.65,
        color: T.textMain,
        fontWeight: 400,
      }}>
        {result.answer}
      </div>

      {/* ─── Sources Toggle ─── */}
      {result.sources && result.sources.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 2 }}>
          <button
            onClick={() => setShowChunks((v) => !v)}
            style={{
              background: "transparent",
              border: `1px solid ${T.glassBdr}`,
              borderRadius: 4,
              padding: "2px 7px",
              fontSize: 10,
              fontFamily: "monospace",
              color: T.textMuted,
              cursor: "pointer",
            }}
          >
            {showChunks ? "▲ hide sources" : `▼ sources (${result.sources.length})`}
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
            style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}
          >
            {result.sources.map((s, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${T.glassBdr}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 11,
                  color: T.textSec,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "monospace", color: T.textMuted, marginBottom: 3 }}>
                  <span>SOURCE #{idx + 1}</span>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      style={{
        width: "100%",
        background: "rgba(14, 19, 31, 0.95)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${T.glassBdr}`,
        borderRadius: 8,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* ─── Top Bar Placeholder ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 12, height: 12, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }} className="animate-pulse" />
          <div style={{ width: 30, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        </div>
        <div style={{ width: 15, height: 15, background: "rgba(255,255,255,0.08)", borderRadius: 3 }} className="animate-pulse" />
      </div>

      {/* ─── Query Echo Skeleton ─── */}
      {query && (
        <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
          "{query}"
        </div>
      )}

      {/* ─── Answer Skeleton Lines ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.7, marginTop: 4 }}>
        <div style={{ height: 12, width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        <div style={{ height: 12, width: "95%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
        <div style={{ height: 12, width: "70%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} className="animate-pulse" />
      </div>

      {/* ─── Generation Indicator ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${T.brand}`, borderTopColor: "transparent" }} className="animate-spin" />
        <span style={{ fontSize: 10, fontFamily: "monospace", color: T.brandLight }}>GENERATING RESPONSE...</span>
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
    setInputVal(""); // Clear input box to hide X and Send buttons

    // Unlock audio context and clear previous
    voice.unlockAudio();
    voice.clearResult?.();

    const res = await text.search(q);
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
    }}>

      {/* ══════ TOP APP BAR ══════ */}
      <header style={{
        position: "relative", zIndex: 30, flexShrink: 0, height: 46,
        borderBottom: `1px solid ${T.glassBdr}`,
        background: "rgba(6,8,16,0.92)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
      }}>
        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: isLoading ? T.warning : T.emerald,
            boxShadow: `0 0 8px ${isLoading ? T.warning : T.emerald}`,
            display: "block",
          }} className={isLoading ? "animate-pulse" : ""} />
          <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textSec, letterSpacing: 0.8, fontWeight: 600 }}>
            {isLoading ? "processing pipeline…" : `${CHUNK_COUNT.toLocaleString()} indexed chunks`}
          </span>
        </div>

        <span style={{ color: T.sep, fontSize: 13 }}>·</span>

        <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textMuted, letterSpacing: 0.8 }}>
          ai4bharat/MSMARCO-XI (11 Indic Languages · HI · GU · TA · TE · BN · MR · KN · ML · PA · OR · EN)
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

      {/* ══════ DUAL PANEL STUDIO LAYOUT ══════ */}
      <div style={{
        flex: 1,
        display: "flex",
        width: "100%",
        height: "calc(100dvh - 46px)",
        overflow: "hidden",
      }}>

        {/* ─── LEFT PANEL: VIBRANT INTERACTIVE PIXEL ART CANVAS ─── */}
        <div style={{
          flex: "1 1 50%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 24px",
          borderRight: `1px solid ${T.glassBdr}`,
          background: "linear-gradient(135deg, #051410 0%, #030a12 100%)",
        }}>
          {/* High-res Interactive Canvas */}
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}>
            <PixelCanvas />
          </div>

          {/* Floating Canvas Badges */}
          <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontFamily: "monospace", letterSpacing: 1.2,
              textTransform: "uppercase", color: T.emerald,
              background: "rgba(6, 20, 16, 0.85)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${T.emeraldBdr}`,
              padding: "4px 9px", borderRadius: 4, fontWeight: 700,
            }}>
              ● VoiceRAG Studio
            </span>
          </div>

          {/* Bottom Art Description Tag */}
          <div style={{
            position: "relative", zIndex: 10,
            background: "rgba(8, 14, 22, 0.85)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${T.glassBdr}`,
            padding: "10px 14px",
            borderRadius: 6,
            maxWidth: 340,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMain, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
              <span>VoiceRAG Studio</span>
              <span style={{
                fontSize: 10, fontFamily: "monospace",
                background: `linear-gradient(90deg, ${T.brand}, ${T.purple}, ${T.emerald})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
                letterSpacing: 1,
              }}>
                BY AlphaCODERS
              </span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
              End-to-end voice transcription, sub-200ms document retrieval, and native speech synthesis across 11 Indic languages.
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: STANDARD STUDIO QUERY INTERFACE ─── */}
        <div style={{
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "24px 28px 24px",
          overflowY: "auto",
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(108,99,255,0.05) 0%, transparent 70%), #080B14",
        }}>
          <div style={{ width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ─── Sarvam Mandala Emblem & Header ─── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
              <motion.div
                whileHover={{ rotate: 180, scale: 1.05 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                style={{ cursor: "pointer" }}
              >
                <SarvamMandala size={36} />
              </motion.div>

              <h1 style={{
                fontSize: "clamp(22px, 2.5vw, 30px)",
                fontWeight: 800,
                letterSpacing: -0.6,
                lineHeight: 1.1,
                color: T.textMain,
                margin: 0,
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}>
                VoiceRAG Studio
              </h1>

              <p style={{
                fontSize: 12,
                color: T.textMuted,
                maxWidth: 440,
                lineHeight: 1.4,
                margin: 0,
              }}>
                Ask any question across <strong>11 Indic Languages</strong> with sub-200ms retrieval & Sarvam voice synthesis.
              </p>
            </div>

            {/* ─── Search & Voice Input Box (Standard Clean Corners) ─── */}
            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                background: T.bgInput,
                border: `1px solid ${isVoiceActive ? T.brand : T.glassBdr}`,
                borderRadius: 8,
                padding: "5px 8px 5px 10px",
                boxShadow: isVoiceActive ? `0 0 20px ${T.brandGlow}` : "0 4px 18px rgba(0,0,0,0.3)",
                transition: "all 0.2s",
              }}>
                {/* Voice Mic Button */}
                <button
                  type="button"
                  onClick={voice.toggle}
                  aria-label="Toggle voice recording"
                  title={isVoiceActive ? "Stop voice recording" : "Click to speak in any language"}
                  style={{
                    background: isVoiceActive ? T.danger : "rgba(108,99,255,0.12)",
                    border: `1px solid ${isVoiceActive ? T.danger : T.brandBdr}`,
                    borderRadius: 6,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    marginRight: 8,
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{isVoiceActive ? "⏹" : "🎙"}</span>
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={isVoiceActive ? "Listening to your voice..." : "Ask a question in any language..."}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: T.textMain,
                    fontSize: 13,
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
                      fontSize: 14,
                      cursor: "pointer",
                      padding: "0 6px",
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
                    background: inputVal.trim() && !isLoading ? T.brand : "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: 6,
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: inputVal.trim() && !isLoading ? "pointer" : "default",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={inputVal.trim() && !isLoading ? "#FFF" : T.textMuted} strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              {/* Voice Listening Active Banner */}
              {isVoiceActive && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 6, padding: "6px 12px",
                  background: "rgba(108,99,255,0.08)",
                  border: `1px solid ${T.brandBdr}`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: T.textSec,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: T.brandLight,
                      boxShadow: `0 0 8px ${T.brandLight}`,
                    }} className="animate-pulse" />
                    <span style={{ fontWeight: 600, color: T.textMain }}>Listening…</span>
                    <span style={{ color: T.textMuted, fontStyle: voice.liveTranscript ? "italic" : "normal" }}>
                      {voice.liveTranscript ? `"${voice.liveTranscript}"` : "Speak now in any language"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={voice.stopRecording}
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 9,
                      fontFamily: "monospace",
                      color: T.danger,
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ⏹ STOP & SEARCH
                  </button>
                </div>
              )}
            </form>

            {/* ─── Suggestion Chips (Initially 3 + Expandable +5 More) ─── */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 5 }}>
              {(showAllSuggestions ? SUGGESTIONS : SUGGESTIONS.slice(0, 3)).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => submit(item.query)}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${T.glassBdr}`,
                    borderRadius: 5,
                    padding: "4px 8px",
                    fontSize: 11,
                    color: T.textSec,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = T.brandBdr;
                    e.currentTarget.style.color = T.textMain;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.glassBdr;
                    e.currentTarget.style.color = T.textSec;
                  }}
                >
                  <span style={{
                    fontSize: 8.5,
                    fontFamily: "monospace",
                    padding: "1px 3px",
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
              <button
                type="button"
                onClick={() => setShowAllSuggestions((v) => !v)}
                style={{
                  background: "rgba(108,99,255,0.08)",
                  border: `1px solid ${T.brandBdr}`,
                  borderRadius: 5,
                  padding: "4px 8px",
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
                <span>{showAllSuggestions ? "▴ less" : `+${SUGGESTIONS.length - 3} languages ▾`}</span>
              </button>
            </div>

            {/* ─── Inline Result Card ─── */}
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
        </div>

      </div>
    </div>
  );
}

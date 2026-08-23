"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceQuery } from "@/lib/hooks/useVoiceQuery";
import { useTextQuery } from "@/lib/hooks/useTextQuery";
import PixelCanvas from "@/components/ui/PixelCanvas";
import type { PipelineResponse } from "@/lib/api/types";
import type { IndicLanguageCode } from "@/lib/voice/types";
import { getIndicDisplayPreview, detectLanguageClient, isIndicScript } from "@/lib/utils/indicDetector";

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
  emeraldLight: "#34D399",
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
  { lang: "GU", langCode: "gu-IN" as const, label: "સૂર્યમંડળમાં કેટલા ગ્રહો છે?", query: "સૂર્યમંડળમાં કેટલા ગ્રહો છે?" },
  { lang: "HI", langCode: "hi-IN" as const, label: "प्रकाश संश्लेषण क्या है?", query: "प्रकाश संश्लेषण क्या है?" },
  { lang: "EN", langCode: "en-IN" as const, label: "What was the Manhattan Project?", query: "What was the Manhattan Project?" },
  { lang: "MR", langCode: "mr-IN" as const, label: "सूर्यमालेत किती मुख्य ग्रह आहेत?", query: "सूर्यमालेत किती मुख्य ग्रह आहेत?" },
  { lang: "TA", langCode: "ta-IN" as const, label: "ஒளிச்சேர்க்கை என்றால் என்ன?", query: "ஒளிச்சேர்க்கை என்றால் என்ன?" },
  { lang: "TE", langCode: "te-IN" as const, label: "సూర్య మండలంలో ఎన్ని గ్రహాలు ఉన్నాయి?", query: "సూర్య మండలంలో ఎన్ని గ్రహాలు ఉన్నాయి?" },
  { lang: "BN", langCode: "bn-IN" as const, label: "সালোকসংশ্লেষ প্রক্রিয়া কি?", query: "সালোকসংশ্লেষ প্রক্রিয়া কি?" },
  { lang: "KN", langCode: "kn-IN" as const, label: "ಸೌರವ್ಯೂಹದಲ್ಲಿ ಎಷ್ಟು ಗ್ರಹಗಳಿವೆ?", query: "ಸೌರವ್ಯೂಹದಲ್ಲಿ ಎಷ್ಟು ಗ್ರಹಗಳಿವೆ?" },
  { lang: "ML", langCode: "ml-IN" as const, label: "പ്രകാശസംശ്ലേഷണം എന്നാൽ എന്ത്?", query: "പ്രകാശസംശ്ലേഷണം എന്നാൽ എന്ത്?" },
  { lang: "PA", langCode: "pa-IN" as const, label: "ਸੂਰਜੀ ਮੰਡਲ ਵਿੱਚ ਕਿੰਨੇ ਗ੍ਰਹਿ ਹਨ?", query: "ਸੂਰਜੀ ਮੰਡਲ ਵਿੱਚ ਕਿੰਨੇ ਗ੍ਰਹਿ ਹਨ?" },
  { lang: "OR", langCode: "or-IN" as const, label: "ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?", query: "ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?" },
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

/* ━━━━━━━━━━━━━━━━━━━━ SPOKEN ANSWER TEXT (SMOOTH LUMINOUS HIGHLIGHT) ━━━━━━━━━━━━━━━━━━━━ */
function SpokenAnswerText({
  answer,
  isSpeaking,
  speechProgress,
}: {
  answer: string;
  isSpeaking: boolean;
  speechProgress?: number;
}) {
  const words = React.useMemo(() => answer.split(/\s+/).filter(Boolean), [answer]);

  // Active word progression during audio playback
  const activeWordIdx = isSpeaking && typeof speechProgress === "number" && speechProgress > 0
    ? Math.min(words.length - 1, Math.floor(speechProgress * words.length))
    : -1;

  if (!isSpeaking || activeWordIdx < 0) {
    return (
      <div style={{
        fontSize: 15,
        lineHeight: 1.75,
        color: T.textMain,
        fontWeight: 400,
        wordBreak: "break-word",
      }}>
        {answer}
      </div>
    );
  }

  return (
    <div style={{
      fontSize: 15,
      lineHeight: 1.75,
      fontWeight: 400,
      wordBreak: "break-word",
    }}>
      {words.map((word, idx) => {
        const isCurrent = isSpeaking && idx === activeWordIdx;
        const isPast = isSpeaking && idx < activeWordIdx;
        const isFuture = isSpeaking && idx > activeWordIdx;

        return (
          <span
            key={idx}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              transition: "color 0.14s ease, text-shadow 0.14s ease",
              color: isCurrent
                ? "#38BDF8"
                : isPast
                  ? "#F8FAFC"
                  : isFuture
                    ? "#94A3B8"
                    : T.textMain,
              fontWeight: isCurrent ? 600 : 400,
              textShadow: isCurrent
                ? "0 0 10px rgba(56, 189, 248, 0.75)"
                : "none",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ INLINE RESULT CARD (CLEAN & MINIMAL) ━━━━━━━━━━━━━━━━━━━━ */
function InlineResultCard({
  result, query, onClose, onSpeak, isSpeaking, onStopSpeaking, speechProgress,
}: {
  result: PipelineResponse; query: string; onClose: () => void; onSpeak?: (text: string) => void; isSpeaking?: boolean; onStopSpeaking?: () => void; speechProgress?: number;
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
      {/* ─── Top Bar: Latency & Close ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontFamily: "monospace", color: T.accent,
          background: "rgba(56, 189, 248, 0.08)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          padding: "3px 8px", borderRadius: 4, fontWeight: 700,
        }}>
          <span>⚡</span>
          <span>{formattedLatency}</span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close answer"
          style={{
            background: "rgba(255,255,255,0.05)", border: `1px solid ${T.glassBdr}`,
            color: T.textMuted, borderRadius: 5,
            fontSize: 13, cursor: "pointer", padding: "4px 8px", lineHeight: 1,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.textMain)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
        >
          ✕
        </button>
      </div>

      {/* ─── Query Echo ─── */}
      {(() => {
        const queryToShow = result?.query || result?.transcript || query;
        if (!queryToShow) return null;
        return (
          <div style={{
            fontSize: 13, color: T.textSec, fontStyle: "italic",
            borderLeft: `2px solid ${T.brand}`, paddingLeft: 10,
          }}>
            "{queryToShow}"
          </div>
        );
      })()}

      {/* ─── Answer Text with Real-Time Audio Word-by-Word Highlight ─── */}
      <SpokenAnswerText answer={result.answer} isSpeaking={Boolean(isSpeaking)} speechProgress={speechProgress} />

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

// ── Safe Client-Side Language Detection & Preview Fallbacks ───────────────────
function safeDetectLanguage(text: string, fallback: IndicLanguageCode = "en-IN"): IndicLanguageCode {
  try {
    if (typeof detectLanguageClient === "function") {
      return detectLanguageClient(text, fallback);
    }
  } catch {}
  return fallback;
}

function safeIndicPreview(text: string, targetLang?: IndicLanguageCode): string {
  try {
    if (typeof getIndicDisplayPreview === "function") {
      return getIndicDisplayPreview(text, targetLang);
    }
  } catch {}
  return text;
}

function InlineResultCardSkeleton({ query, targetLang }: { query?: string; targetLang?: IndicLanguageCode }) {
  const q = query || "";
  const detectedLang = safeDetectLanguage(q, targetLang || "en-IN");
  const indicPreview = safeIndicPreview(q, targetLang);
  const langLabel = detectedLang === "hi-IN" ? "HI" : detectedLang === "gu-IN" ? "GU" : detectedLang === "ta-IN" ? "TA" : detectedLang === "te-IN" ? "TE" : detectedLang.split("-")[0].toUpperCase();

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
      {/* ─── Top Bar with Live Indic Language Badge ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10,
            fontFamily: "monospace",
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 4,
            background: detectedLang === "hi-IN" ? "rgba(245,158,11,0.2)" : detectedLang === "gu-IN" ? "rgba(16,185,129,0.2)" : "rgba(108,99,255,0.2)",
            color: detectedLang === "hi-IN" ? T.warning : detectedLang === "gu-IN" ? T.success : T.brandLight,
            border: `1px solid ${detectedLang === "hi-IN" ? "rgba(245,158,11,0.4)" : detectedLang === "gu-IN" ? "rgba(16,185,129,0.4)" : "rgba(108,99,255,0.4)"}`,
          }}>
            🇮🇳 {langLabel}
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textMuted }}>
            Real-Time Multilingual Synthesis
          </span>
        </div>
      </div>

      {/* ─── Query Echo Skeleton (Instant Native Script Preview) ─── */}
      {q && (
        <div style={{
          borderLeft: `2.5px solid ${detectedLang === "hi-IN" ? T.warning : detectedLang === "gu-IN" ? T.success : T.brandLight}`,
          paddingLeft: 10,
          margin: "2px 0",
        }}>
          <div style={{ fontSize: 14, color: T.textMain, fontWeight: 600 }}>
            "{indicPreview || q}"
          </div>
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
  const [selectedLang, setSelectedLang] = useState<IndicLanguageCode>("auto");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const voice = useVoiceQuery(selectedLang);
  const text = useTextQuery();

  // Restore persisted language on mount safely
  useEffect(() => {
    try {
      const saved = localStorage.getItem("voicerag_lang") as IndicLanguageCode;
      if (saved) {
        setSelectedLang(saved);
        voice.setLanguage(saved);
      }
    } catch {}
  }, []);

  const isVoiceActive = voice.isRecognizing || voice.recorderState === "recognizing";
  const isLoading = voice.isLoading || text.isLoading;
  const result = voice.result || text.result;

  const handleSelectLang = useCallback((lang: IndicLanguageCode) => {
    setSelectedLang(lang);
    voice.setLanguage(lang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("voicerag_lang", lang);
      } catch {}
    }
  }, [voice]);

  const submit = useCallback(async (queryToSubmit: string, langCode?: IndicLanguageCode) => {
    const q = queryToSubmit.trim();
    if (!q || isLoading) return;

    if (langCode) {
      handleSelectLang(langCode);
    }

    setSubmittedQuery(q);
    setInputVal(""); // Clear input field so it's immediately ready for the next question

    voice.unlockAudio();
    voice.clearResult?.();

    const res = await text.search(q);
    if (res) {
      const normalizedQuery = res.query || res.transcript;
      if (normalizedQuery && normalizedQuery !== q) {
        setSubmittedQuery(normalizedQuery);
      }
      if (res.answer) {
        voice.speakAnswer(res.answer, langCode || (res.language as IndicLanguageCode) || selectedLang);
      }
    }
  }, [isLoading, selectedLang, text, voice, handleSelectLang]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(inputVal);
  };

  const handleToggleVoice = useCallback(() => {
    if (!isVoiceActive) {
      setSubmittedQuery("");
      setInputVal("");
      text.clearResult();
      voice.clearResult?.();
    }
    voice.toggle();
  }, [isVoiceActive, text, voice]);

  const clearAll = useCallback(() => {
    setInputVal("");
    setSubmittedQuery("");
    text.clearResult();
    voice.clearResult?.();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [text, voice]);

  // Sync live microphone transcript into the input bar in real-time (when locked to a specific language or native script)
  useEffect(() => {
    if (voice.liveTranscript) {
      // If specific language is selected (e.g. Hindi, Gujarati, Marathi), sync live
      if (selectedLang !== "auto") {
        setInputVal(voice.liveTranscript);
      } else {
        // In Auto mode, only sync if it already contains native Indic Unicode characters to prevent English flashing
        const hasIndicScript = /[\u0900-\u0D7F]/.test(voice.liveTranscript);
        if (hasIndicScript) {
          setInputVal(voice.liveTranscript);
        }
      }
    }
  }, [voice.liveTranscript, selectedLang]);

  // When voice query finishes with high-precision STT transcript, sync to result card and clear input bar
  useEffect(() => {
    if (voice.result) {
      const q = voice.result.transcript || voice.result.query || voice.liveTranscript;
      if (q) {
        setSubmittedQuery(q);
        setInputVal(""); // Reset input bar for next question
      }
    }
  }, [voice.result, voice.liveTranscript]);

  const displayQuery = (
    result?.transcript ||
    result?.query ||
    submittedQuery ||
    voice.liveTranscript ||
    inputVal ||
    ""
  ).trim();

  return (
    <div style={{
      width: "100vw",
      minHeight: "100dvh",
      background: "linear-gradient(180deg, #041410 0%, #020C09 100%)",
      color: T.textMain,
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-inter), -apple-system, sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* ══════ TOP APP BAR ══════ */}
      <header style={{
        position: "relative", zIndex: 30, flexShrink: 0, height: 46,
        borderBottom: `1px solid ${T.glassBdr}`,
        background: "rgba(6,8,16,0.92)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
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
            {isLoading ? "processing…" : `${CHUNK_COUNT.toLocaleString()} chunks`}
          </span>
        </div>

        <span className="top-bar-sub" style={{ color: T.sep, fontSize: 13 }}>·</span>

        <span className="top-bar-sub" style={{ fontSize: 11, fontFamily: "monospace", color: T.textMuted, letterSpacing: 0.8 }}>
          11 Indic Languages
        </span>

        <div style={{ flex: 1 }} />

        {/* Team badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontFamily: "monospace", letterSpacing: 1.5,
            textTransform: "uppercase", fontWeight: 800,
            color: T.brandLight,
          }}>
            AlphaCODERS
          </span>
          <span className="top-bar-sub" style={{ fontSize: 9, fontFamily: "monospace", color: T.textFaint, letterSpacing: 1, textTransform: "uppercase" }}>
            · HH GOA 2026
          </span>
        </div>
      </header>

      {/* ══════ DUAL PANEL STUDIO LAYOUT ══════ */}
      <div className="studio-layout">

        {/* ─── LEFT PANEL: VIBRANT INTERACTIVE PIXEL ART CANVAS ─── */}
        <div className="canvas-panel">
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
          <div className="canvas-art-desc" style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            zIndex: 10,
            background: "rgba(8, 14, 22, 0.88)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${T.glassBdr}`,
            padding: "12px 16px",
            borderRadius: 8,
            maxWidth: 380,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textMain, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>VoiceRAG Studio</span>
              <span style={{
                fontSize: 10.5, fontFamily: "monospace",
                color: T.brandLight,
                fontWeight: 800,
                letterSpacing: 1.2,
              }}>
                BY AlphaCODERS
              </span>
            </div>
            <div className="canvas-art-desc-sub" style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.45 }}>
              End-to-end voice transcription, sub-200ms document retrieval, and native speech synthesis across 11 Indic languages.
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: STANDARD STUDIO QUERY INTERFACE ─── */}
        <div className="studio-panel">
          <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ─── Sarvam Mandala Emblem & Header ─── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
              <motion.div
                whileHover={{ rotate: 180, scale: 1.06 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                style={{ cursor: "pointer" }}
              >
                <SarvamMandala size={38} />
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
                maxWidth: 460,
                lineHeight: 1.4,
                margin: 0,
              }}>
                Ask any question across <strong>11 Indic Languages</strong> with ultra-low sub-200ms retrieval & Sarvam voice synthesis.
              </p>
            </div>

            {/* ─── Language Quick Switcher Bar (Gujarati, Hindi, English, Auto) ─── */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              background: "rgba(11, 15, 25, 0.8)",
              border: `1px solid ${T.glassBdr}`,
              borderRadius: 10,
              padding: "5px 8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, overflowX: "auto" }}>
                {[
                  { code: "auto" as const, label: "🌐 Auto" },
                  { code: "gu-IN" as const, label: "🇮🇳 ગુજરાતી" },
                  { code: "hi-IN" as const, label: "🇮🇳 हिन्दी" },
                  { code: "en-IN" as const, label: "🇬🇧 English" },
                  { code: "mr-IN" as const, label: "🇮🇳 मराठी" },
                ].map((l) => {
                  const isActive = selectedLang === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleSelectLang(l.code)}
                      style={{
                        background: isActive ? "rgba(108, 99, 255, 0.25)" : "transparent",
                        border: `1px solid ${isActive ? T.brandLight : "transparent"}`,
                        color: isActive ? "#FFFFFF" : T.textMuted,
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        fontWeight: isActive ? 700 : 500,
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>

              {/* Dropdown for specific language selection across all 11 Indic languages */}
              <select
                value={selectedLang}
                onChange={(e) => handleSelectLang(e.target.value as IndicLanguageCode)}
                aria-label="Select target language"
                style={{
                  background: "rgba(14, 19, 31, 0.95)",
                  border: `1px solid ${T.glassBdr}`,
                  color: T.textSec,
                  borderRadius: 6,
                  padding: "3px 6px",
                  fontSize: 10.5,
                  outline: "none",
                  cursor: "pointer",
                  maxWidth: 135,
                }}
              >
                <option value="auto">🌐 Auto-Detect</option>
                <option value="gu-IN">🇮🇳 ગુજરાતી (Gujarati)</option>
                <option value="hi-IN">🇮🇳 हिन्दी (Hindi)</option>
                <option value="en-IN">🇬🇧 English</option>
                <option value="mr-IN">🇮🇳 मराठी (Marathi)</option>
                <option value="ta-IN">🇮🇳 தமிழ் (Tamil)</option>
                <option value="te-IN">🇮🇳 తెలుగు (Telugu)</option>
                <option value="bn-IN">🇮🇳 বাংলা (Bengali)</option>
                <option value="kn-IN">🇮🇳 ಕನ್ನಡ (Kannada)</option>
                <option value="ml-IN">🇮🇳 മലയാളം (Malayalam)</option>
                <option value="pa-IN">🇮🇳 ਪੰਜਾਬੀ (Punjabi)</option>
                <option value="or-IN">🇮🇳 ଓଡ଼ିଆ (Odia)</option>
              </select>
            </div>

            {/* ─── Search & Voice Input Box (100% Auto-Language Recognition) ─── */}
            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                background: T.bgInput,
                border: `1.5px solid ${isVoiceActive ? "rgba(239,68,68,0.7)" : T.glassBdr}`,
                borderRadius: 12,
                padding: "8px 10px",
                boxShadow: isVoiceActive ? "0 0 24px rgba(239, 68, 68, 0.25), inset 0 0 12px rgba(239, 68, 68, 0.08)" : "0 4px 18px rgba(0,0,0,0.3)",
                transition: "all 0.25s ease",
              }}>
                {/* Voice Mic / Glowing Stop Button */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  aria-label="Toggle voice recording"
                  title={isVoiceActive ? "Click to stop recording" : `Click to speak (${selectedLang === "auto" ? "Auto-detect language" : selectedLang})`}
                  style={{
                    position: "relative",
                    background: isVoiceActive
                      ? "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)"
                      : "linear-gradient(135deg, rgba(108,99,255,0.25) 0%, rgba(108,99,255,0.1) 100%)",
                    border: `1.5px solid ${isVoiceActive ? "#FCA5A5" : T.brandBdr}`,
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    marginRight: 10,
                    transition: "all 0.25s ease",
                    flexShrink: 0,
                    color: isVoiceActive ? "#FFFFFF" : T.brandLight,
                    boxShadow: isVoiceActive ? "0 0 16px rgba(239, 68, 68, 0.6)" : "0 2px 8px rgba(108, 99, 255, 0.15)",
                  }}
                >
                  {isVoiceActive ? (
                    <>
                      <span className="animate-ping" style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: "2px solid rgba(239, 68, 68, 0.6)",
                        pointerEvents: "none",
                      }} />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="5" width="14" height="14" rx="2.5" />
                      </svg>
                    </>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="8" y1="22" x2="16" y2="22" />
                    </svg>
                  )}
                </button>

                {/* Text input with dynamic real-time voice feedback */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={
                    isVoiceActive
                      ? voice.speechDetected
                        ? "🎙️ Voice detected... listening (speak your question)"
                        : `🔴 Listening... speak in ${selectedLang === "gu-IN" ? "Gujarati (ગુજરાતી)" : selectedLang === "hi-IN" ? "Hindi (हिन्दी)" : "any language"}`
                      : selectedLang === "gu-IN"
                        ? "ગુજરાતીમાં પ્રશ્ન પૂછો અથવા બોલવા માટે માઇક પર ક્લિક કરો..."
                        : selectedLang === "hi-IN"
                          ? "हिन्दी में प्रश्न पूछें या बोलने के लिए माइक पर क्लिक करें..."
                          : "Ask any question in any language or click mic to speak..."
                  }
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: isVoiceActive ? (voice.speechDetected ? "#38BDF8" : "#E2E8F0") : T.textMain,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    fontWeight: isVoiceActive ? 600 : 400,
                    transition: "color 0.2s ease",
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
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: inputVal.trim() && !isLoading ? "pointer" : "default",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inputVal.trim() && !isLoading ? "#FFF" : T.textMuted} strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              {/* Dynamic Live Audio Equalizer & Real-Time Status Bar */}
              {isVoiceActive && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                    padding: "7px 12px",
                    background: "rgba(10, 16, 28, 0.95)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${voice.speechDetected ? "rgba(16, 185, 129, 0.5)" : "rgba(108, 99, 255, 0.4)"}`,
                    borderRadius: 8,
                    boxShadow: voice.speechDetected
                      ? "0 8px 24px rgba(16, 185, 129, 0.25)"
                      : "0 8px 24px rgba(108, 99, 255, 0.2)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {/* Live Equalizer Frequency Bars */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 16 }}>
                      {[0.6, 1.4, 0.8, 1.6, 1.0, 1.5, 0.7, 1.2].map((f, i) => {
                        const lvl = voice.audioLevel || (voice.speechDetected ? 20 : 6);
                        const h = Math.max(3, Math.min(16, lvl * f * 0.24));
                        return (
                          <div
                            key={i}
                            style={{
                              width: 3,
                              height: h,
                              background: voice.speechDetected
                                ? "linear-gradient(180deg, #34D399 0%, #10B981 100%)"
                                : "linear-gradient(180deg, #818CF8 0%, #38BDF8 100%)",
                              borderRadius: 2,
                              transition: "height 0.07s ease, background 0.2s ease",
                            }}
                          />
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {voice.speechDetected ? (
                        <span style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          fontWeight: 800,
                          color: T.emeraldLight,
                          background: "rgba(16, 185, 129, 0.2)",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          letterSpacing: 0.5,
                        }}>
                          ● SPEECH ACTIVE
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: T.textMuted,
                          background: "rgba(255,255,255,0.05)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}>
                          LISTENING
                        </span>
                      )}
                      <span className="hidden sm:inline" style={{ fontSize: 11, color: T.textSec, fontStyle: "italic" }}>
                        Auto-detects speech & stops automatically
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={voice.stopRecording}
                    style={{
                      background: "rgba(239,68,68,0.2)",
                      border: "1px solid rgba(239,68,68,0.5)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#FCA5A5",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.35)";
                      e.currentTarget.style.color = "#FFFFFF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                      e.currentTarget.style.color = "#FCA5A5";
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} className="animate-pulse" />
                    Done Speaking ↵
                  </button>
                </motion.div>
              )}
            </form>

            {/* ─── Suggestion Chips (Clean 2-Chip Default + Organized Expand) ─── */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              maxWidth: 600,
              margin: "0 auto",
              width: "100%",
            }}>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                width: "100%",
              }}>
                {(showAllSuggestions ? SUGGESTIONS : SUGGESTIONS.slice(0, 2)).map((item) => (
                  <button
                    key={item.lang + item.label}
                    type="button"
                    onClick={() => submit(item.query, item.langCode)}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${T.glassBdr}`,
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 11.5,
                      color: T.textSec,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.brandBdr;
                      e.currentTarget.style.color = T.textMain;
                      e.currentTarget.style.background = "rgba(108,99,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.glassBdr;
                      e.currentTarget.style.color = T.textSec;
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }}
                  >
                    <span style={{
                      fontSize: 9,
                      fontFamily: "monospace",
                      padding: "1px 4px",
                      borderRadius: 3,
                      fontWeight: 700,
                      background: item.lang === "HI" ? "rgba(245,158,11,0.15)" : item.lang === "GU" ? "rgba(16,185,129,0.15)" : item.lang === "TA" || item.lang === "TE" ? "rgba(56,189,248,0.15)" : "rgba(108,99,255,0.15)",
                      color: item.lang === "HI" ? T.warning : item.lang === "GU" ? T.success : item.lang === "TA" || item.lang === "TE" ? T.accent : T.brandLight,
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
                    background: showAllSuggestions ? "rgba(108,99,255,0.18)" : "rgba(108,99,255,0.08)",
                    border: `1px solid ${T.brandBdr}`,
                    borderRadius: 6,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: T.brandLight,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 700,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(108,99,255,0.22)";
                    e.currentTarget.style.color = "#FFFFFF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = showAllSuggestions ? "rgba(108,99,255,0.18)" : "rgba(108,99,255,0.08)";
                    e.currentTarget.style.color = T.brandLight;
                  }}
                >
                  <span>{showAllSuggestions ? "▴ Show Less" : `+${SUGGESTIONS.length - 2} Indic Languages ▾`}</span>
                </button>
              </div>
            </div>

            {/* ─── Inline Result Card ─── */}
            <AnimatePresence mode="wait">
              {isLoading && (
                <InlineResultCardSkeleton key="skeleton" query={displayQuery} targetLang={selectedLang} />
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
                  speechProgress={voice.speechProgress}
                />
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>
    </div>
  );
}


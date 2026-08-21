import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import type { RecorderState } from "@/lib/hooks/useVoiceRecorder";

interface MicOrbProps {
  state: RecorderState;
  onToggle: () => void;
  liveTranscript?: string;
  disabled?: boolean;
  audioLevel?: number;
  speechDetected?: boolean;
  silenceCountdown?: number | null;
}

export function MicOrb({
  state,
  onToggle,
  liveTranscript,
  disabled,
  audioLevel = 0,
  speechDetected = false,
  silenceCountdown = null,
}: MicOrbProps) {
  const isRecognizing = state === "recognizing";
  const isProcessing = state === "processing";

  // Dynamic scale from audio energy (between 1.0 and 1.35)
  const energyScale = isRecognizing ? 1 + Math.min(0.35, (audioLevel / 255) * 1.5) : 1;

  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing acoustic aura */}
        {isRecognizing && (
          <>
            <motion.div
              animate={{ 
                scale: [1 * energyScale, 1.35 * energyScale, 1 * energyScale], 
                opacity: [0.35, 0.75, 0.35] 
              }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="absolute w-56 h-56 rounded-full bg-gradient-to-r from-rose-500/30 to-brand-500/30 blur-2xl pointer-events-none"
            />
            <motion.div
              animate={{ 
                scale: [1, 1.2 * energyScale, 1], 
                opacity: [0.4, 0.8, 0.4] 
              }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.15 }}
              className="absolute w-44 h-44 rounded-full border-2 border-rose-400/40 pointer-events-none"
            />
            <div className="absolute w-52 h-52 rounded-full border border-brand-accent/40 animate-ping opacity-50 pointer-events-none" />
          </>
        )}

        {/* Main Interactive Mic Orb */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggle}
          disabled={disabled || isProcessing}
          style={{ transform: `scale(${energyScale})` }}
          className={cn(
            "relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer outline-none border",
            isRecognizing
              ? "bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-500 border-rose-300 shadow-[0_0_50px_rgba(244,63,94,0.7)]"
              : isProcessing
              ? "bg-brand-900/80 border-brand-400/50 shadow-[0_0_40px_rgba(108,99,255,0.5)] cursor-wait"
              : "bg-gradient-to-tr from-brand-600 via-brand-500 to-cyan-400 border-white/25 shadow-[0_0_40px_rgba(108,99,255,0.45)] hover:shadow-[0_0_65px_rgba(108,99,255,0.75)]"
          )}
          aria-label={isRecognizing ? "Stop voice listening" : "Start voice recognition"}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider">
                Thinking
              </span>
            </div>
          ) : isRecognizing ? (
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.0 }}
              className="flex flex-col items-center gap-1.5"
            >
              {/* Active Audio Wave Graphic / Stop Icon */}
              <div className="w-8 h-8 rounded-lg bg-white shadow-lg flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-sm bg-rose-600" />
              </div>
              <span className="text-[10px] font-mono text-white font-bold tracking-wider uppercase drop-shadow">
                Stop
              </span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <svg
                className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-md"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          )}
        </motion.button>
      </div>

      {/* State Label & Auto-silence Banner */}
      <div className="text-center space-y-2 max-w-lg">
        <div className="text-sm font-semibold tracking-wide">
          {isRecognizing ? (
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-2 text-rose-400 font-mono text-sm sm:text-base">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                {speechDetected ? "Speech detected • Listening..." : "Listening... (Speak your question)"}
              </span>
              <span className="text-xs text-text-muted">
                {silenceCountdown !== null
                  ? `Pausing detected... Sending in ${silenceCountdown}s (or click to send immediately)`
                  : "Auto-sends when you finish speaking, or click to stop"}
              </span>
            </div>
          ) : isProcessing ? (
            <span className="text-cyan-400 font-mono animate-pulse text-sm sm:text-base">
              ⚡ Transcribing & Retrieving via RAG Pipeline...
            </span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-white font-medium text-base">
                Click microphone to ask your question
              </span>
              <span className="text-xs text-text-muted">
                Hands-free voice recognition with auto-send on silence
              </span>
            </div>
          )}
        </div>

        {/* Live Interim Transcript Bubble */}
        <AnimatePresence>
          {isRecognizing && liveTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="max-w-md mx-auto px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl text-sm text-white font-medium shadow-xl"
            >
              <div className="flex items-center gap-2 text-xs text-brand-300 mb-1 font-mono uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Live Transcript:
              </div>
              <p className="italic">"{liveTranscript}"</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


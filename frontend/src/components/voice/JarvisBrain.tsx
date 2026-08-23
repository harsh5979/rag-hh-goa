"use client";
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecorderState } from "@/lib/hooks/useVoiceRecorder";
import type { VoiceState } from "@/lib/voice/types";

interface JarvisBrainProps {
  state: VoiceState | RecorderState;
  onToggle: () => void;
  audioLevel?: number;
  speechDetected?: boolean;
  silenceCountdown?: number | null;
  disabled?: boolean;
}

export function JarvisBrain({
  state,
  onToggle,
  audioLevel = 0,
  speechDetected = false,
  silenceCountdown = null,
  disabled = false,
}: JarvisBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  const isRecognizing = state === "recognizing" || state === "listening" || state === "requesting_permission" || state === "connecting";
  const isProcessing = state === "processing" || state === "speaking";
  const isActive = isRecognizing || isProcessing;

  // Energy factor: 0 to 1
  const energy = Math.min(1, (audioLevel / 255) * 2.5);

  // Canvas neural circuit animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = Array.from({ length: 18 }, (_, i) => ({
      x: 80 + Math.cos((i / 18) * Math.PI * 2) * (30 + Math.random() * 40),
      y: 80 + Math.sin((i / 18) * Math.PI * 2) * (30 + Math.random() * 40),
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
    }));

    const draw = (t: number) => {
      timeRef.current = t;
      ctx.clearRect(0, 0, 160, 160);

      const pulse = isActive ? 0.5 + energy * 0.5 : 0.3;

      // Draw connection lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 60) {
            const alpha = (1 - dist / 60) * pulse * 0.6;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = isActive
              ? `rgba(251, 191, 36, ${alpha})`
              : `rgba(251, 191, 36, ${alpha * 0.4})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node) => {
        const glow = Math.sin(t * node.speed * 60 + node.phase) * 0.5 + 0.5;
        const r = 2.5 + glow * 2;
        const alpha = 0.5 + glow * 0.5;

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? `rgba(251, 191, 36, ${alpha * pulse})`
          : `rgba(251, 191, 36, ${alpha * 0.3})`;
        ctx.fill();

        // Glow
        if (isActive) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245, 158, 11, ${0.04 * glow * pulse})`;
          ctx.fill();
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, energy]);

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 200, height: 200 }}>
      {/* Outer glow rings */}
      {isActive && (
        <>
          <motion.div
            animate={{
              scale: [1, 1.4 + energy * 0.3, 1],
              opacity: [0.15, 0.45 + energy * 0.3, 0.15],
            }}
            transition={{ repeat: Infinity, duration: 2.0, ease: "easeInOut" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 240,
              height: 240,
              background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)",
            }}
          />
          <motion.div
            animate={{
              scale: [1, 1.2 + energy * 0.2, 1],
              opacity: [0.2, 0.5 + energy * 0.2, 0.2],
            }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.3 }}
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: 190,
              height: 190,
              borderColor: "rgba(251,191,36,0.4)",
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0.15 }}
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: 155,
              height: 155,
              borderColor: `rgba(245, 158, 11, ${0.3 + energy * 0.5})`,
              boxShadow: `0 0 ${20 + energy * 40}px rgba(245,158,11,0.3)`,
            }}
          />
        </>
      )}

      {/* Idle soft pulse */}
      {!isActive && (
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Brain button */}
      <motion.button
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        onClick={onToggle}
        disabled={disabled && isProcessing}
        style={{
          width: 148,
          height: 148,
          borderRadius: "50%",
          position: "relative",
          zIndex: 10,
          cursor: isProcessing ? "wait" : "pointer",
          background: isActive
            ? "radial-gradient(circle at 35% 35%, #fbbf24 0%, #f59e0b 35%, #d97706 65%, #92400e 100%)"
            : "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.6) 0%, rgba(245,158,11,0.4) 40%, rgba(120,80,10,0.3) 100%)",
          boxShadow: isActive
            ? `0 0 0 2px rgba(251,191,36,0.6), 0 0 ${30 + energy * 60}px rgba(245,158,11,0.7), 0 0 80px rgba(251,191,36,0.3)`
            : "0 0 0 1.5px rgba(251,191,36,0.25), 0 0 30px rgba(245,158,11,0.15)",
          border: "none",
          outline: "none",
          overflow: "hidden",
        }}
        aria-label={isRecognizing ? "Stop recording" : "Start voice input"}
      >
        {/* Neural canvas */}
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            opacity: isActive ? 1 : 0.5,
          }}
        />

        {/* Center icon overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {isProcessing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "2.5px solid rgba(255,255,255,0.15)",
                  borderTopColor: "white",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                THINKING
              </span>
            </>
          ) : isRecognizing ? (
            <>
              {/* Stop square */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: "rgba(0,0,0,0.7)",
                  boxShadow: "0 0 8px rgba(0,0,0,0.5)",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                STOP
              </span>
            </>
          ) : (
            <>
              <svg
                width={32}
                height={32}
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(0,0,0,0.8)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <span
                style={{
                  fontSize: 8,
                  fontFamily: "monospace",
                  color: "rgba(0,0,0,0.75)",
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                SPEAK
              </span>
            </>
          )}
        </div>
      </motion.button>

      {/* Status label below */}
      <div
        style={{
          position: "absolute",
          bottom: -32,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        }}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.span
              key="processing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#fbbf24",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              ⚡ RAG PIPELINE RUNNING...
            </motion.span>
          ) : isRecognizing ? (
            <motion.span
              key="listening"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: speechDetected ? "#fbbf24" : "rgba(251,191,36,0.6)",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {silenceCountdown !== null
                ? `SENDING IN ${silenceCountdown}s...`
                : speechDetected
                ? "● VOICE DETECTED"
                : "● LISTENING..."}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(251,191,36,0.4)",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              TAP TO SPEAK
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

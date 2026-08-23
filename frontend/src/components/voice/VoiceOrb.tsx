"use client";
/**
 * VoiceOrb — Fractal geometric canvas orb.
 * No emoji, no circle button. A morphing polygon / Sierpiński-inspired
 * mesh that pulses and deforms based on audio energy.
 */
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecorderState } from "@/lib/hooks/useVoiceRecorder";
import type { VoiceState } from "@/lib/voice/types";

interface VoiceOrbProps {
  state: VoiceState | RecorderState;
  onToggle: () => void;
  audioLevel?: number;
  speechDetected?: boolean;
  silenceCountdown?: number | null;
  disabled?: boolean;
}

const BRAND   = "#6C63FF";
const ACCENT  = "#38BDF8";
const PURPLE  = "#A855F7";
const IDLE_C  = "rgba(108,99,255,0.45)";

/** Generate N evenly-spaced points on a circle of radius r centred at (cx,cy) */
function ring(n: number, cx: number, cy: number, r: number, phaseOff = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + phaseOff;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export function VoiceOrb({
  state,
  onToggle,
  audioLevel = 0,
  speechDetected = false,
  silenceCountdown = null,
  disabled = false,
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const tRef      = useRef<number>(0);

  const isRecognizing = state === "recognizing" || state === "listening" || state === "requesting_permission" || state === "connecting";
  const isProcessing  = state === "processing" || state === "speaking";
  const isActive      = isRecognizing || isProcessing;
  const energy        = Math.min(1, audioLevel / 200);

  /* ── Canvas fractal-mesh animation ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 180, H = 180, cx = 90, cy = 90;

    const draw = (now: number) => {
      tRef.current = now * 0.001; // seconds
      const t = tRef.current;
      const e = energy;

      ctx.clearRect(0, 0, W, H);

      /* ── outer glow disk ── */
      const gd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      if (isActive) {
        gd.addColorStop(0,   `rgba(108,99,255,${0.12 + e * 0.18})`);
        gd.addColorStop(0.5, `rgba(168,85,247,${0.06 + e * 0.08})`);
        gd.addColorStop(1,   "rgba(0,0,0,0)");
      } else {
        gd.addColorStop(0, "rgba(108,99,255,0.05)");
        gd.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.fillStyle = gd;
      ctx.fill();

      /* ── Three concentric polygon rings ── */
      const rings = [
        { n: 6,  r: 28 + e * 8,  spd: 0.25, color: BRAND,  lw: 1.2 },
        { n: 9,  r: 48 + e * 12, spd: -0.18, color: PURPLE, lw: 0.8 },
        { n: 12, r: 68 + e * 16, spd: 0.12,  color: ACCENT, lw: 0.6 },
      ];

      rings.forEach(({ n, r, spd, color, lw }) => {
        // Morph radius with sine per vertex
        const pts = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + t * spd;
          const morph = Math.sin(t * 1.7 + i * 1.1) * (4 + e * 8);
          return {
            x: cx + Math.cos(a) * (r + morph),
            y: cy + Math.sin(a) * (r + morph),
          };
        });

        const alpha = isActive ? 0.6 + e * 0.4 : 0.2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = isActive ? lw * 1.6 : lw;
        ctx.stroke();

        /* ── vertex dots ── */
        pts.forEach((p, i) => {
          const dotAlpha = isActive
            ? 0.5 + Math.sin(t * 2 + i) * 0.4
            : 0.15;
          const dotR = isActive ? 1.8 + e * 1.5 : 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.round(dotAlpha * 255).toString(16).padStart(2, "0");
          ctx.fill();
        });
      });

      /* ── Cross-ring connector lines (Sierpiński-like) ── */
      if (isActive) {
        const inner = ring(6, cx, cy, 28 + e * 8, t * 0.25);
        const outer = ring(12, cx, cy, 68 + e * 16, t * 0.12);

        // Connect every inner vertex to 2 nearest outer vertices
        inner.forEach((ip, ii) => {
          for (let k = 0; k < 2; k++) {
            const oi = (ii * 2 + k) % outer.length;
            const op = outer[oi];
            ctx.beginPath();
            ctx.moveTo(ip.x, ip.y);
            ctx.lineTo(op.x, op.y);
            ctx.strokeStyle = `rgba(108,99,255,${0.08 + e * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      }

      /* ── Central core dot ── */
      const coreR = isActive ? 5 + e * 7 : 3;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2);
      if (isActive) {
        coreGrad.addColorStop(0, BRAND);
        coreGrad.addColorStop(0.5, PURPLE);
        coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        coreGrad.addColorStop(0, IDLE_C);
        coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#fff" : IDLE_C;
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, energy]);

  return (
    <div
      style={{
        position: "relative",
        width: 200,
        height: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Animated outer pulsing ring */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="ring"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 0.4 + energy * 0.3, 0],
              scale:   [0.85, 1.35 + energy * 0.2, 0.85],
            }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: `1px solid ${BRAND}`,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Clickable canvas orb */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={onToggle}
        disabled={disabled && isProcessing}
        aria-label={isRecognizing ? "Stop recording" : "Start voice input"}
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "transparent",
          border: `1.5px solid ${isActive ? BRAND + "80" : "rgba(108,99,255,0.2)"}`,
          cursor: isProcessing ? "wait" : "pointer",
          position: "relative",
          padding: 0,
          outline: "none",
          boxShadow: isActive
            ? `0 0 0 1px ${BRAND}40, 0 0 ${30 + energy * 50}px rgba(108,99,255,0.4), 0 0 60px rgba(168,85,247,0.15)`
            : "0 0 0 1px rgba(108,99,255,0.1), 0 0 20px rgba(108,99,255,0.08)",
          transition: "box-shadow 0.3s, border-color 0.3s",
        }}
      >
        <canvas
          ref={canvasRef}
          width={180}
          height={180}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            borderRadius: "50%",
          }}
        />
      </motion.button>

      {/* Status label */}
      <div
        style={{
          position: "absolute",
          bottom: -28,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        }}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.span
              key="proc"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
                color: BRAND, textTransform: "uppercase", fontWeight: 700,
              }}
            >
              ⚡ PROCESSING…
            </motion.span>
          ) : isRecognizing ? (
            <motion.span
              key="listen"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
                color: speechDetected ? PURPLE : "rgba(108,99,255,0.6)",
                textTransform: "uppercase", fontWeight: 700,
              }}
            >
              {silenceCountdown !== null
                ? `SENDING IN ${silenceCountdown}s`
                : speechDetected
                ? "● VOICE DETECTED"
                : "● LISTENING"}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
                color: "rgba(108,99,255,0.4)", textTransform: "uppercase", fontWeight: 600,
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

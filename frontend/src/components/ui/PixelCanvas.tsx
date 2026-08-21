"use client";

import React, { useEffect, useRef } from "react";

interface Pixel {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
  baseAlpha: number;
  currentAlpha: number;
  noisePhase: number;
}

export default function PixelCanvas({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const mouse = {
      x: -1000,
      y: -1000,
      radius: 95,
      isActive: false,
    };

    const TILE_SIZE = 4;
    let pixels: Pixel[] = [];

    // Authentic Sarvam Indus Palette Generator (Lush emerald hills, sunny moss, deep river azure & foam)
    function generateLandscapeColor(normX: number, normY: number): [number, number, number, number] {
      // 1. Top Section: Sunlit Canopy & Forest Green (0.0 to 0.45)
      if (normY < 0.45) {
        const noise = Math.sin(normX * 12 + normY * 8) * 0.5 + Math.cos(normX * 6 - normY * 10) * 0.5;
        if (normY < 0.18) {
          // Upper forest canopy
          const r = Math.floor(45 + noise * 25);
          const g = Math.floor(105 + noise * 40);
          const b = Math.floor(55 + noise * 30);
          return [r, g, b, 0.92];
        } else {
          // Sunlit lush emerald & bright chartreuse moss
          const r = Math.floor(75 + noise * 35);
          const g = Math.floor(155 + noise * 55);
          const b = Math.floor(65 + noise * 40);
          return [r, g, b, 0.95];
        }
      }
      // 2. Middle Section: River Bank & Water Transition (0.45 to 0.62)
      else if (normY < 0.62) {
        const noise = Math.sin(normX * 14 + normY * 12) * 0.5 + 0.5;
        if (normY > 0.50 && normY < 0.58 && normX > 0.15 && normX < 0.85) {
          // River foam & white-blue rapids reflection (matching Sarvam Indus central reflection)
          const r = Math.floor(180 + noise * 60);
          const g = Math.floor(215 + noise * 35);
          const b = Math.floor(235 + noise * 20);
          return [r, g, b, 0.98];
        } else {
          // Rich turquoise river water
          const r = Math.floor(35 + noise * 30);
          const g = Math.floor(140 + noise * 45);
          const b = Math.floor(175 + noise * 45);
          return [r, g, b, 0.95];
        }
      }
      // 3. Bottom Section: Deep River Azure & Reflection Pool (0.62 to 1.0)
      else {
        const wave = Math.cos(normX * 10 - normY * 14) * 0.5 + 0.5;
        if (normY > 0.82) {
          // Deep teal-black river bed
          const r = Math.floor(18 + wave * 22);
          const g = Math.floor(70 + wave * 35);
          const b = Math.floor(105 + wave * 45);
          return [r, g, b, 0.92];
        } else {
          // Flowing cerulean blue river
          const r = Math.floor(30 + wave * 30);
          const g = Math.floor(115 + wave * 45);
          const b = Math.floor(165 + wave * 55);
          return [r, g, b, 0.96];
        }
      }
    }

    function initGrid() {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = canvas.width = rect.width;
      height = canvas.height = rect.height;
      pixels = [];

      const cols = Math.ceil(width / TILE_SIZE);
      const rows = Math.ceil(height / TILE_SIZE);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const posX = c * TILE_SIZE;
          const posY = r * TILE_SIZE;
          const normX = c / cols;
          const normY = r / rows;

          const [red, green, blue, alpha] = generateLandscapeColor(normX, normY);

          pixels.push({
            x: posX,
            y: posY,
            originX: posX,
            originY: posY,
            vx: 0,
            vy: 0,
            size: TILE_SIZE - 0.8,
            r: red,
            g: green,
            b: blue,
            baseAlpha: alpha,
            currentAlpha: alpha,
            noisePhase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    initGrid();

    // Mouse handlers on container
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.isActive = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.isActive = false;
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);

    const resizeObserver = new ResizeObserver(() => {
      initGrid();
    });
    resizeObserver.observe(container);

    let time = 0;
    const SPRING = 0.12;
    const DAMPING = 0.82;

    function animate() {
      time += 0.025;
      ctx.clearRect(0, 0, width, height);

      const pLen = pixels.length;
      for (let i = 0; i < pLen; i++) {
        const p = pixels[i];

        // 1. Mouse Displacement & Luminescence
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius && mouse.isActive) {
          const force = (1 - dist / mouse.radius) * 16;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle) * force;
          p.vy -= Math.sin(angle) * force;
          p.currentAlpha = 1.0;
        } else {
          p.currentAlpha += (p.baseAlpha - p.currentAlpha) * 0.08;
        }

        // 2. Ambient subtle breeze motion
        const breezeX = Math.sin(time + p.noisePhase) * 0.6;
        const breezeY = Math.cos(time * 0.7 + p.noisePhase) * 0.6;

        // 3. Spring back
        const homeDx = p.originX + breezeX - p.x;
        const homeDy = p.originY + breezeY - p.y;

        p.vx += homeDx * SPRING;
        p.vy += homeDy * SPRING;
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx;
        p.y += p.vy;

        // 4. Render Tile with high-res crisp edges
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.currentAlpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "crosshair",
        }}
      />
      {/* Glossy corner highlight overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

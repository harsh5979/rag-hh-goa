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

interface MouseState {
  x: number;
  y: number;
  radius: number;
  isActive: boolean;
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

    const mouse: MouseState = {
      x: -1000,
      y: -1000,
      radius: 110,
      isActive: false,
    };

    const TILE_SIZE = 4;
    let pixels: Pixel[] = [];

    // Pristine Sarvam Indus Palette (Lush emerald hills, sunlit moss, shimmering turquoise river & jade depths)
    function generateLandscapeColor(normX: number, normY: number): [number, number, number, number] {
      // 1. Top Section: Sunlit Emerald Forest & Bright Moss (0.0 to 0.42)
      if (normY < 0.42) {
        const noise = Math.sin(normX * 10 + normY * 8) * 0.5 + Math.cos(normX * 6 - normY * 12) * 0.5;
        if (normY < 0.16) {
          // Sunlit canopy top
          const r = Math.floor(16 + noise * 20);
          const g = Math.floor(135 + noise * 45);
          const b = Math.floor(75 + noise * 30);
          return [r, g, b, 0.92];
        } else {
          // Lush vibrant emerald & sunny chartreuse moss
          const r = Math.floor(25 + noise * 35);
          const g = Math.floor(185 + noise * 50);
          const b = Math.floor(95 + noise * 40);
          return [r, g, b, 0.96];
        }
      }
      // 2. Middle Section: River Foam, Shimmer & Rapids (0.42 to 0.65)
      else if (normY < 0.65) {
        const noise = Math.sin(normX * 14 + normY * 10) * 0.5 + 0.5;
        if (normY > 0.48 && normY < 0.56 && normX > 0.15 && normX < 0.85) {
          // Central river foam & sunlit reflection
          const r = Math.floor(180 + noise * 55);
          const g = Math.floor(240 + noise * 15);
          const b = Math.floor(245 + noise * 10);
          return [r, g, b, 0.98];
        } else {
          // Brilliant turquoise river water
          const r = Math.floor(14 + noise * 25);
          const g = Math.floor(180 + noise * 45);
          const b = Math.floor(190 + noise * 45);
          return [r, g, b, 0.95];
        }
      }
      // 3. Bottom Section: Deep Jade & Cerulean River Bed (0.65 to 1.0)
      else {
        const wave = Math.cos(normX * 8 - normY * 12) * 0.5 + 0.5;
        if (normY > 0.84) {
          // Deep teal-jade river bed
          const r = Math.floor(10 + wave * 18);
          const g = Math.floor(105 + wave * 35);
          const b = Math.floor(135 + wave * 45);
          return [r, g, b, 0.92];
        } else {
          // Deep flowing cerulean-jade
          const r = Math.floor(12 + wave * 22);
          const g = Math.floor(145 + wave * 45);
          const b = Math.floor(175 + wave * 50);
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

    // Mouse & touch handlers on window so hover works anywhere on screen
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.isActive = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canvas || !e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.touches[0].clientX - rect.left;
      mouse.y = e.touches[0].clientY - rect.top;
      mouse.isActive = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.isActive = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    const resizeObserver = new ResizeObserver(() => {
      initGrid();
    });
    resizeObserver.observe(container);

    let time = 0;
    const SPRING = 0.14;
    const DAMPING = 0.84;

    function animate() {
      if (!ctx) return;
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
          const force = (1 - dist / mouse.radius) * 18;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle) * force;
          p.vy -= Math.sin(angle) * force;
          p.currentAlpha = 1.0;
        } else {
          p.currentAlpha += (p.baseAlpha - p.currentAlpha) * 0.08;
        }

        // 2. Ambient subtle breeze motion
        const breezeX = Math.sin(time + p.noisePhase) * 0.7;
        const breezeY = Math.cos(time * 0.7 + p.noisePhase) * 0.7;

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
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
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

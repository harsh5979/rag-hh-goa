"use client";

import React from "react";
import { motion } from "framer-motion";

export function BackgroundAnimation() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-void">
      {/* Dynamic Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} 
      />

      {/* Floating Animated Cosmic Gradient Blobs */}
      <motion.div
        animate={{
          x: [-40, 60, -20, -40],
          y: [-30, 40, -50, -30],
          scale: [1, 1.25, 0.9, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 18,
          ease: "easeInOut",
        }}
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-brand-500/20 via-purple-600/15 to-transparent blur-[120px]"
      />

      <motion.div
        animate={{
          x: [50, -40, 30, 50],
          y: [40, -60, 20, 40],
          scale: [1.1, 0.85, 1.2, 1.1],
        }}
        transition={{
          repeat: Infinity,
          duration: 22,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute top-1/3 -right-32 w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-cyan-500/20 via-brand-600/15 to-transparent blur-[140px]"
      />

      <motion.div
        animate={{
          x: [-20, 50, -40, -20],
          y: [60, -30, 50, 60],
          scale: [0.95, 1.2, 1, 0.95],
        }}
        transition={{
          repeat: Infinity,
          duration: 25,
          ease: "easeInOut",
          delay: 4,
        }}
        className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-pink-600/15 via-brand-500/15 to-transparent blur-[130px]"
      />

      {/* Center ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-brand-500/5 blur-[160px] rounded-full" />
    </div>
  );
}

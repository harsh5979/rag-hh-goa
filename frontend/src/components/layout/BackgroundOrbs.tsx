"use client";

import React from "react";

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Orb 1: Indigo */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full mix-blend-screen animate-[orbit-blob_20s_infinite_linear]"
        style={{
          background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(108,99,255,0) 70%)',
          filter: 'blur(60px)',
          willChange: 'transform'
        }}
      />
      
      {/* Orb 2: Purple */}
      <div 
        className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] rounded-full mix-blend-screen animate-[orbit-blob_25s_infinite_linear_reverse]"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0) 70%)',
          filter: 'blur(60px)',
          willChange: 'transform'
        }}
      />

      {/* Orb 3: Cyan */}
      <div 
        className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] rounded-full mix-blend-screen animate-[orbit-blob_30s_infinite_linear]"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0) 70%)',
          filter: 'blur(80px)',
          willChange: 'transform'
        }}
      />
    </div>
  );
}

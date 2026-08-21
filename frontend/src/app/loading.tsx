import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-base">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-white/5 border-t-brand-500 animate-spin" />
        <div className="w-10 h-10 absolute rounded-full border-4 border-transparent border-t-brand-accent animate-[spin_1.5s_linear_infinite_reverse]" />
      </div>
      <p className="mt-6 font-medium text-text-secondary animate-pulse">Initializing VoiceRAG...</p>
    </div>
  );
}

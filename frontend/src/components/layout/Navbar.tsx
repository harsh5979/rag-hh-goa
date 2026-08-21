"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 h-16 z-50 transition-all duration-300",
        scrolled ? "bg-base/80 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center shadow-[var(--glow-primary)]">
            <span className="text-white font-bold text-sm">◈</span>
          </div>
          <span className="font-display font-bold text-xl tracking-tight gradient-text hidden sm:block">
            VoiceRAG
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Badge label="English" variant="muted" icon="🌐" />
          <Badge label="Live" variant="success" pulse />
        </div>
      </div>
    </header>
  );
}

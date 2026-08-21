"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type TabType = "voice" | "search" | "analytics";

interface TabBarProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "voice", label: "Voice", icon: "🎤" },
    { id: "search", label: "Search", icon: "🔍" },
    { id: "analytics", label: "Analytics", icon: "📊" },
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      <div className="glass rounded-full p-1.5 flex items-center gap-1 relative z-20">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative px-6 py-2.5 text-sm font-medium rounded-full transition-colors outline-none",
                isActive ? "text-white" : "text-text-secondary hover:text-text-primary hover:bg-white/5"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 bg-brand-500 rounded-full shadow-[var(--glow-primary)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <span>{tab.icon}</span>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

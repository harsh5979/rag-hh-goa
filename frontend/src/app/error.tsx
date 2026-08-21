"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowButton } from "@/components/ui/GlowButton";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base p-4">
      <GlassCard glowColor="accent" className="max-w-md w-full border-danger/20 text-center">
        <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl text-danger">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-secondary mb-6">{error.message || "An unexpected error occurred."}</p>
        <GlowButton variant="danger" onClick={() => reset()} className="w-full">
          Try Again
        </GlowButton>
      </GlassCard>
    </div>
  );
}

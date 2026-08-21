import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface AudioWaveformProps {
  isActive: boolean;
  analyserNode?: AnalyserNode | null;
}

const BAR_COUNT = 32;

export function AudioWaveform({ isActive, analyserNode }: AudioWaveformProps) {
  const [dataArray, setDataArray] = useState<Uint8Array>(new Uint8Array(BAR_COUNT));
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isActive || !analyserNode) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const arr = new Uint8Array(analyserNode.frequencyBinCount);
    
    const update = () => {
      analyserNode.getByteFrequencyData(arr);
      
      // Map to 32 bars, smooth out lower frequencies
      const step = Math.floor(arr.length / BAR_COUNT);
      const newArray = new Uint8Array(BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        newArray[i] = arr[i * step];
      }
      
      setDataArray(newArray);
      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, analyserNode]);

  return (
    <div className="flex items-center justify-center gap-1 h-16 w-full max-w-sm mx-auto">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        // If active, height is driven by frequency data. If idle, it's 4px but animated gently.
        let height = 4;
        let opacity = 0.3;
        
        if (isActive) {
          const val = dataArray[i] || 0;
          height = Math.max(4, (val / 255) * 64);
          opacity = Math.max(0.3, val / 255);
        }

        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full bg-brand-accent transition-all duration-75",
              !isActive && "animate-[wave-bar_1.5s_ease-in-out_infinite]"
            )}
            style={{ 
              height: `${height}px`,
              opacity,
              animationDelay: !isActive ? `${i * 0.05}s` : undefined
            }}
          />
        );
      })}
    </div>
  );
}

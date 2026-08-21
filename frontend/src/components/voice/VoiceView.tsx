"use client";

import React from "react";
import { MicOrb } from "./MicOrb";
import { AudioWaveform } from "./AudioWaveform";
import { TranscriptCard } from "./TranscriptCard";
import { useVoiceQuery } from "@/lib/hooks/useVoiceQuery";

export function VoiceView() {
  const {
    recorderState,
    analyser,
    liveTranscript,
    audioLevel,
    speechDetected,
    silenceCountdown,
    toggle,
    isRecognizing,
    isProcessing,
  } = useVoiceQuery();

  return (
    <section className="flex flex-col items-center gap-8 py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto w-full">
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
          Ask anything. <span className="gradient-text">Speak naturally.</span>
        </h1>
        <p className="text-text-secondary text-base sm:text-lg max-w-lg mx-auto">
          Powered by Sarvam AI and Llama 3 for instant hybrid RAG over the MSMARCO-XI dataset.
        </p>
      </div>

      <div className="mt-4 mb-2">
        <MicOrb
          state={recorderState}
          onToggle={toggle}
          liveTranscript={liveTranscript}
          audioLevel={audioLevel}
          speechDetected={speechDetected}
          silenceCountdown={silenceCountdown}
        />
      </div>

      <div className="w-full max-w-md h-12 flex items-center justify-center">
        <AudioWaveform isActive={isRecognizing} analyserNode={analyser} />
      </div>

      {isProcessing && (
        <TranscriptCard text={liveTranscript} isLoading={true} />
      )}
    </section>
  );
}


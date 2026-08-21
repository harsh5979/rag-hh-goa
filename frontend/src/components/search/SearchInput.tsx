import React, { useState } from "react";
import { GlowButton } from "@/components/ui/GlowButton";

interface SearchInputProps {
  isLoading: boolean;
  onSearch: (text: string) => void;
}

export function SearchInput({ isLoading, onSearch }: SearchInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-text-muted group-focus-within:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your question about MSMARCO..."
        className="block w-full pl-11 pr-24 py-4 bg-input/50 backdrop-blur-md border border-white/10 rounded-2xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-500/50 focus:bg-input transition-all duration-300 shadow-inner"
        disabled={isLoading}
      />
      <div className="absolute inset-y-0 right-2 flex items-center">
        <GlowButton type="submit" isLoading={isLoading} size="sm" variant="primary" disabled={!value.trim()}>
          Search
        </GlowButton>
      </div>
    </form>
  );
}

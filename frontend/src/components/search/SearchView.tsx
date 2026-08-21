"use client";

import React from "react";
import { SearchInput } from "./SearchInput";
import { useTextQuery } from "@/lib/hooks/useTextQuery";

export function SearchView() {
  const { isLoading, search } = useTextQuery();

  return (
    <section className="w-full max-w-3xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
          Search the Knowledge Base
        </h1>
        <p className="text-text-secondary">
          Enter a text query to trigger the hybrid dense + sparse retrieval pipeline.
        </p>
      </div>

      <SearchInput isLoading={isLoading} onSearch={search} />
    </section>
  );
}

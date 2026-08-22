import { useState } from "react";
import { queryApi } from "@/lib/api/queryApi";
import { useAnalyticsStore } from "@/store/analyticsStore";
import type { PipelineResponse } from "@/lib/api/types";

export function useTextQuery() {
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addResult } = useAnalyticsStore();

  const search = async (text: string) => {
    if (!text.trim()) {
      setResult(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await queryApi.sendTextQuery(text);
      setResult(res);
      addResult(res, text);
      return res;
    } catch (err: any) {
      console.error("Text query failed:", err);
      setError(err?.message || "Failed to search query. Please try again.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return {
    result,
    error,
    isLoading,
    search,
    sendQuery: search,
    setResult,
    clearResult,
  };
}

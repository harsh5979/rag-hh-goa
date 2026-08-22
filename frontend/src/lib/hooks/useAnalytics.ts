import { useAnalyticsStore } from "@/store/analyticsStore";

export function useAnalytics() {
  const history = useAnalyticsStore((state) => state.history);
  const events = useAnalyticsStore((state) => state.events);

  // Calculate stats dynamically
  const calculatePercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  };

  const totals = history.map((h) => h.timings?.total_ms || 0).filter((v): v is number => typeof v === "number");
  const retrieves = history.map((h) => (h.timings?.retrieve_dense_ms || 0) + (h.timings?.retrieve_sparse_ms || 0)).filter((v): v is number => typeof v === "number");
  const generates = history.map((h) => h.timings?.generate_ms || 0).filter((v): v is number => typeof v === "number");

  const stats = {
    total: {
      p50: calculatePercentile(totals, 50),
      p70: calculatePercentile(totals, 70),
      p100: calculatePercentile(totals, 100),
    },
    retrieve: {
      p50: calculatePercentile(retrieves, 50),
      p70: calculatePercentile(retrieves, 70),
      p100: calculatePercentile(retrieves, 100),
    },
    generate: {
      p50: calculatePercentile(generates, 50),
      p70: calculatePercentile(generates, 70),
      p100: calculatePercentile(generates, 100),
    }
  };

  return {
    history,
    events,
    stats,
  };
}

"use client";

/**
 * Lazy-loaded Recharts wrapper.
 *
 * Recharts is ~8MB and only used on Dashboard, Analytics, Weight, and Sleep pages.
 * By lazy-loading it, we avoid parsing this massive library on initial app startup,
 * which is the single biggest perf improvement for slow Windows laptops.
 *
 * Usage: import from "@/components/ui/LazyRecharts" instead of "recharts"
 */

import * as React from "react";

// We load the recharts module ONCE, cache it, and all consumers share it.

type RechartsModuleType = typeof import("recharts");

let cachedModule: RechartsModuleType | null = null;
let modulePromise: Promise<RechartsModuleType> | null = null;

function loadRecharts(): Promise<RechartsModuleType> {
  if (cachedModule) return Promise.resolve(cachedModule);
  if (!modulePromise) {
    modulePromise = import("recharts").then((mod) => {
      cachedModule = mod;
      return mod;
    });
  }
  return modulePromise;
}

/**
 * Preload recharts module in the background. Call this early
 * (e.g., on Dashboard mount or on hover) to start loading before
 * the charts actually render.
 */
export function preloadRecharts(): void {
  loadRecharts();
}

// ─── Wrapper: renders children only after recharts is loaded ────────────────

type LazyRechartsProps = {
  children: (recharts: RechartsModuleType) => React.ReactNode;
  fallback?: React.ReactNode;
};

/**
 * Render-prop wrapper that provides the recharts module once loaded.
 *
 * @example
 * <LazyRechartsProvider fallback={<ChartSkeleton />}>
 *   {(rc) => (
 *     <rc.ResponsiveContainer width="100%" height={200}>
 *       <rc.RadarChart data={data}>
 *         <rc.Radar dataKey="score" />
 *       </rc.RadarChart>
 *     </rc.ResponsiveContainer>
 *   )}
 * </LazyRechartsProvider>
 */
export function LazyRechartsProvider({ children, fallback }: LazyRechartsProps) {
  const [mod, setMod] = React.useState<RechartsModuleType | null>(cachedModule);

  React.useEffect(() => {
    if (cachedModule) {
      setMod(cachedModule);
      return;
    }
    loadRecharts().then(setMod);
  }, []);

  if (!mod) {
    return <>{fallback ?? <div style={{ minHeight: 200 }} />}</>;
  }

  return <>{children(mod)}</>;
}

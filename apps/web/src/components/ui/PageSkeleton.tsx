"use client";

export default function PageSkeleton() {
  return (
    <div className="w-full px-2 py-2 sm:px-4 sm:py-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="mt-3 h-4 w-64 rounded bg-white/5" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="tp-panel p-5 sm:p-6">
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="mt-4 h-40 rounded bg-white/[0.02]" />
        </div>
        <div className="tp-panel p-5 sm:p-6">
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="mt-4 h-40 rounded bg-white/[0.02]" />
        </div>
      </div>
    </div>
  );
}

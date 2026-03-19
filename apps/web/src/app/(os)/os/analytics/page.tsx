"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const AnalyticsClient = dynamic(() => import("./AnalyticsClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}

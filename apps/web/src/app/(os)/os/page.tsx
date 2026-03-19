"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const Dashboard = dynamic(() => import("../Dashboard"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function OSPage() {
  return <Dashboard />;
}

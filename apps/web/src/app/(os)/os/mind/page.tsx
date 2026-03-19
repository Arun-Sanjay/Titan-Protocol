"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const MindClient = dynamic(() => import("./MindClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function MindPage() {
  return <MindClient />;
}

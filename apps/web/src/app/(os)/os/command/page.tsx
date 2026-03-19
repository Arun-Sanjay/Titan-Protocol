"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const CommandCenterClient = dynamic(() => import("./CommandCenterClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function CommandCenterPage() {
  return <CommandCenterClient />;
}

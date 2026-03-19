"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const GeneralClient = dynamic(() => import("./GeneralClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function GeneralPage() {
  return <GeneralClient />;
}

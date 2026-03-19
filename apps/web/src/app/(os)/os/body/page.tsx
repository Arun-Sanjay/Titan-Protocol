"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const BodyClient = dynamic(() => import("./BodyClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function BodyPage() {
  return <BodyClient />;
}

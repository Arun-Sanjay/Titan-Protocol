"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/ui/PageSkeleton";

const MoneyClient = dynamic(() => import("./MoneyClient"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function MoneyPage() {
  return <MoneyClient />;
}

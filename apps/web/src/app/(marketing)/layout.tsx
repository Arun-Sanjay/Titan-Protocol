import "../globals.css";
import "./marketing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Titan Protocol",
  description: "Neon/HUD life gamification system",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" data-theme="marketing">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="h-screen overflow-hidden antialiased font-sans">
        <div className="tp-marketing tp-marketing-root">{children}</div>
      </body>
    </html>
  );
}

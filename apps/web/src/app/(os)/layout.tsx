import "../globals.css";
import "./os.css";
import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-cyber",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Titan Protocol",
  description: "Neon/HUD life gamification system",
};

export default function OSLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" data-theme="hud">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`tp-os tp-os-flat min-h-screen antialiased font-sans ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

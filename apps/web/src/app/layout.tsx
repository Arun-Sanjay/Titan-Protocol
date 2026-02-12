import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Titan Protocol",
  description: "Neon/HUD life gamification system",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

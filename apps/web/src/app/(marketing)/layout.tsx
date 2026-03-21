import "../globals.css";
import "./marketing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Titan Protocol",
  description: "The operating system for human performance.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" data-theme="marketing">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="h-screen overflow-hidden antialiased" style={{ overflowX: 'hidden' }}>
        <div className="tp-marketing tp-marketing-root">{children}</div>
      </body>
    </html>
  );
}

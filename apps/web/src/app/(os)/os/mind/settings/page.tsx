import Link from "next/link";

export default function MindSettingsPage() {
  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="hud-title text-2xl font-bold md:text-3xl">Mind Settings</h1>
        <Link href="/os/mind" className="chrome-btn px-3 py-1.5 text-sm text-white">
          Back
        </Link>
      </header>
      <article className="chrome-panel p-5 text-sm text-white/70">Mind settings placeholder</article>
    </main>
  );
}

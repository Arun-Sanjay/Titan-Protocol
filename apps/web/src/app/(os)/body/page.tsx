import Link from "next/link";

export default function BodyCommandCentrePage() {
  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Body Command Centre</h1>
          <p className="mt-2 text-sm text-white/70">Cycle day and consistency overview.</p>
        </div>
        <Link href="/os/body/settings" className="chrome-btn px-3 py-1.5 text-sm text-white">
          Body Settings
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="chrome-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-white/60">Calendar</p>
          <div className="mt-4 rounded-xl border border-white/12 bg-black/25 p-6 text-sm text-white/65">
            Calendar placeholder
          </div>
        </article>

        <article className="chrome-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-white/60">Today Tasks</p>
          <div className="mt-4 rounded-xl border border-white/12 bg-black/25 p-6 text-sm text-white/65">
            Today tasks placeholder
          </div>
        </article>
      </section>
    </main>
  );
}

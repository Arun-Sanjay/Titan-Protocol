import Link from "next/link";

export default function BodyNutritionPage() {
  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Nutrition</p>
        </div>
        <div className="tp-tabs">
          <Link href="/os/body" className="tp-tab">
            Body Engine
          </Link>
          <Link href="/os/body/nutrition" className="tp-tab is-active">
            Nutrition
          </Link>
        </div>
      </div>

      <section className="tp-panel p-5 sm:p-6">
        <div className="tp-panel-head">
          <p className="tp-kicker">Nutrition</p>
          <p className="tp-muted">Coming soon</p>
        </div>
        <p className="mt-3 text-sm text-white/60">This section will host your daily nutrition logs.</p>
      </section>
    </main>
  );
}

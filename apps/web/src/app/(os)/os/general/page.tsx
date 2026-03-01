import Link from "next/link";

export default function GeneralTodayPage() {
  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <section className="tp-panel p-6">
        <h1 className="tp-title text-3xl font-bold md:text-4xl">GENERAL ENGINE</h1>
        <p className="mt-3 text-sm text-white/70">Not set up yet.</p>
        <Link href="/os" className="tp-button mt-5 inline-flex px-4 py-2 text-sm text-white">
          Back to Dashboard
        </Link>
      </section>
    </main>
  );
}

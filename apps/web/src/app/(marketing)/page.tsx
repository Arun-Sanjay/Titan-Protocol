import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="titan-hero">
      {/* Gradient glow art — decorative background */}
      <div className="titan-glow" aria-hidden="true">
        <div className="titan-glow-orb titan-glow-orb-1" />
        <div className="titan-glow-orb titan-glow-orb-2" />
        <div className="titan-glow-orb titan-glow-orb-3" />
      </div>

      {/* Content */}
      <div className="titan-content">
        <p className="titan-wordmark">TITAN PROTOCOL</p>
        <h1 className="titan-headline">
          Your life.
          <br />
          Systematized.
        </h1>
        <p className="titan-tagline">
          The operating system for human performance.
        </p>
        <Link href="/os?onboarding=1" className="titan-cta">
          Enter Titan OS
          <span className="titan-cta-arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>
    </main>
  );
}

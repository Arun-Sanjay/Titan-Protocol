"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Mini Components ──────────────────────────────────────────────────────────

function EngineCard({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div
      className="rounded-xl p-3.5 text-center"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2))",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <span className="text-2xl">{icon}</span>
      <p className="text-xs font-semibold text-white/90 mt-1.5 tracking-wide">{name}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{desc}</p>
    </div>
  );
}

function MiniTaskRow({ stars, label, pts }: { stars: string; label: string; pts: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-lg"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.15))",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-white/70 text-xs">{stars}</span>
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <span className="text-[10px] text-white/30 font-medium tracking-wider uppercase">{pts}</span>
    </div>
  );
}

function MiniGrid() {
  const colors = [
    0.1, 0.3, 0.7, 0.9, 0.4, 0.2, 0.8,
    0.5, 0.1, 0.6, 0.3, 0.9, 0.7, 0.4,
    0.8, 0.6, 0.2, 0.5, 1.0, 0.3, 0.7,
  ];
  return (
    <div className="grid grid-cols-7 gap-1.5 max-w-[180px] mx-auto">
      {colors.map((c, i) => (
        <div
          key={i}
          className="w-[18px] h-[18px] rounded"
          style={{
            background: `rgba(255, 255, 255, ${c * 0.15})`,
            border: `1px solid rgba(255, 255, 255, ${c * 0.08})`,
            boxShadow: c > 0.6 ? `0 0 ${c * 8}px rgba(255,255,255,${c * 0.08})` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Step Content ─────────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center">
      <div
        className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        ◈
      </div>
      <h2 className="text-2xl font-bold text-white mt-5 tracking-wide">Welcome to Titan Protocol</h2>
      <p className="text-sm text-white/40 mt-3 max-w-sm mx-auto leading-relaxed">
        Your personal operating system for building discipline, tracking progress, and becoming your best self.
      </p>
    </div>
  );
}

function StepEngines() {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-white/50">
        Your Life Stack
      </p>
      <h2 className="text-xl font-bold text-white mt-2 tracking-wide">The Four Engines</h2>
      <div className="grid grid-cols-2 gap-3 mt-5 max-w-sm mx-auto">
        <EngineCard icon="💪" name="Body" desc="Fitness, sleep, nutrition" />
        <EngineCard icon="🧠" name="Mind" desc="Learning, reading, focus" />
        <EngineCard icon="💰" name="Money" desc="Expenses, income, budgets" />
        <EngineCard icon="⚡" name="General" desc="Daily habits & routines" />
      </div>
    </div>
  );
}

function StepScoring() {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-white/50">
        How It Works
      </p>
      <h2 className="text-xl font-bold text-white mt-2 tracking-wide">Scoring System</h2>
      <div className="mt-5 space-y-2 max-w-sm mx-auto">
        <MiniTaskRow stars="★★" label="Main task" pts="2 pts" />
        <MiniTaskRow stars="★" label="Secondary task" pts="1 pt" />
      </div>
      <div className="mt-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between text-[10px] text-white/35 mb-1.5 px-1">
          <span>Daily progress</span>
          <span className="text-white/60">60%+ = consistent day</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: "65%",
              background: "linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.7))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StepHabits() {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-white/50">
        Build Discipline
      </p>
      <h2 className="text-xl font-bold text-white mt-2 tracking-wide">Daily Habits</h2>
      <div className="mt-6">
        <MiniGrid />
      </div>
      <p className="text-sm text-white/40 mt-5 leading-relaxed">
        Build streaks. Track daily. Watch your consistency grow.
      </p>
    </div>
  );
}

function StepReady() {
  return (
    <div className="text-center">
      <div
        className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        ✓
      </div>
      <h2 className="text-2xl font-bold text-white mt-5 tracking-wide">You&apos;re All Set</h2>
      <p className="text-sm text-white/40 mt-3 max-w-sm mx-auto leading-relaxed">
        Start by exploring your dashboard. Press{" "}
        <kbd
          className="px-1.5 py-0.5 rounded text-white/60 text-xs"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          ⌘K
        </kbd>{" "}
        for quick navigation.
      </p>
    </div>
  );
}

const STEPS = [StepWelcome, StepEngines, StepScoring, StepHabits, StepReady];
const STEP_COUNT = STEPS.length;

// ─── Onboarding Hook ─────────────────────────────────────────────────────────

const STORAGE_KEY = "titan.onboarding.complete";

export function useOnboarding() {
  const [isComplete, setIsComplete] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setIsComplete(stored === "true");
  }, []);

  function markComplete() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsComplete(true);
  }

  function reset() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setIsComplete(false);
  }

  return { isComplete, markComplete, reset };
}

// ─── Wizard Component ─────────────────────────────────────────────────────────

type Props = {
  onComplete: () => void;
};

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);

  const isLast = step === STEP_COUNT - 1;
  const StepComponent = STEPS[step];

  function handleNext() {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  function handleSkip() {
    onComplete();
  }

  function handleDotClick(idx: number) {
    setDirection(idx > step ? 1 : -1);
    setStep(idx);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(24px)",
      }}
    >
      <div
        className="w-full max-w-lg mx-4 p-8 rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.3) 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: STEP_COUNT }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleDotClick(idx)}
              className="rounded-full transition-all duration-300 cursor-pointer"
              style={{
                width: idx === step ? 24 : 8,
                height: 8,
                backgroundColor:
                  idx === step
                    ? "rgba(255,255,255,0.85)"
                    : idx < step
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.08)",
              }}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-white/30 hover:text-white/60 transition-colors px-4 py-2"
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-white/20 hover:text-white/40 transition-colors px-3 py-2"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-[11px] font-medium tracking-[0.14em] uppercase transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.9)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.24)";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))";
              }}
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-center text-[10px] text-white/15 mt-6 tracking-wider uppercase">
          {step + 1} / {STEP_COUNT}
        </p>
      </div>
    </div>
  );
}

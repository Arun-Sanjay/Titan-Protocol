"use client";

import * as React from "react";

// ─── Achievement Toast ───────────────────────────────────────────────────────

export type AchievementToast = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

type CelebrationContextType = {
  showAchievement: (toast: Omit<AchievementToast, "id">) => void;
  triggerConfetti: () => void;
};

const CelebrationContext = React.createContext<CelebrationContextType>({
  showAchievement: () => {},
  triggerConfetti: () => {},
});

export function useCelebration() {
  return React.useContext(CelebrationContext);
}

// ─── Confetti Particle ───────────────────────────────────────────────────────

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
};

const CONFETTI_COLORS = [
  "#34d399",
  "#60a5fa",
  "#f87171",
  "#fbbf24",
  "#a78bfa",
  "#ec4899",
  "#22d3ee",
];

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const animFrameRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate particles
    const particles: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        id: i,
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    particlesRef.current = particles;

    let elapsed = 0;

    function animate() {
      if (!ctx || !canvas) return;
      elapsed++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 120);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < 120) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[10001]"
    />
  );
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast: AchievementToast;
  onDismiss: (id: string) => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-in"
      style={{
        background:
          "linear-gradient(135deg, rgba(52, 211, 153, 0.12) 0%, rgba(52, 211, 153, 0.04) 100%)",
        border: "1px solid rgba(52, 211, 153, 0.25)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.3s ease-out",
      }}
    >
      <span className="text-2xl shrink-0">{toast.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#34d399] tracking-wider uppercase">
          Achievement Unlocked
        </p>
        <p className="text-sm font-medium text-white/90 mt-0.5">{toast.title}</p>
        <p className="text-[11px] text-white/50">{toast.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = React.useState<AchievementToast[]>([]);
  const [confettiActive, setConfettiActive] = React.useState(false);

  const showAchievement = React.useCallback(
    (toast: Omit<AchievementToast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);

      // Also trigger confetti for achievements
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 2500);

      // Play a celebration sound
      try {
        const ctx = new AudioContext();
        // Quick celebratory chord
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + i * 0.08 + 0.6,
          );
          osc.start(ctx.currentTime + i * 0.08);
          osc.stop(ctx.currentTime + i * 0.08 + 0.6);
        });
      } catch {
        // Audio not available
      }
    },
    [],
  );

  const triggerConfetti = React.useCallback(() => {
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 2500);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo(
    () => ({ showAchievement, triggerConfetti }),
    [showAchievement, triggerConfetti],
  );

  return (
    <CelebrationContext.Provider value={value}>
      {children}

      {/* Confetti overlay */}
      <ConfettiCanvas active={confettiActive} />

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </CelebrationContext.Provider>
  );
}

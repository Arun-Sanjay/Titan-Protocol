"use client";

import * as React from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { useTheme } from "./ThemeProvider";

interface ScoreGaugeProps {
  value: number; // 0-100
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Circular SVG score gauge with animated fill and glow.
 * On "cyberpunk" theme: renders glowing cyan ring.
 * On "hud" theme: renders flat text score (existing style).
 */
export function ScoreGauge({
  value,
  size = 200,
  label,
  className = "",
}: ScoreGaugeProps) {
  const { theme } = useTheme();

  // Flat fallback for non-cyberpunk themes
  if (theme !== "cyberpunk") {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <span className="tx-score-main" style={{ fontSize: `clamp(2rem, 4vw, 3.2rem)` }}>
          {value.toFixed(1)}%
        </span>
        {label && <span className="tp-muted text-xs mt-1">{label}</span>}
      </div>
    );
  }

  const strokeWidth = 6;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animated spring for the value
  const springValue = useSpring(0, { stiffness: 60, damping: 20 });
  const strokeDashoffset = useTransform(
    springValue,
    (v: number) => circumference - (v / 100) * circumference,
  );
  const displayValue = useTransform(springValue, (v: number) => Math.round(v));
  const [displayNum, setDisplayNum] = React.useState(0);

  React.useEffect(() => {
    springValue.set(Math.min(100, Math.max(0, value)));
  }, [value, springValue]);

  React.useEffect(() => {
    const unsubscribe = displayValue.on("change", (v) => setDisplayNum(v as number));
    return unsubscribe;
  }, [displayValue]);

  return (
    <div className={`score-gauge ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="score-gauge-svg"
      >
        {/* Outer glow filter */}
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.6)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 1)" />
            <stop offset="100%" stopColor="rgba(96, 165, 250, 0.8)" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
          className="score-gauge-track"
        />

        {/* Subtle tick marks */}
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1={center}
            y1={strokeWidth}
            x2={center}
            y2={strokeWidth + 6}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={1}
            transform={`rotate(${deg} ${center} ${center})`}
          />
        ))}

        {/* Animated progress ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          transform={`rotate(-90 ${center} ${center})`}
          filter="url(#gauge-glow)"
        />

        {/* Inner decorative ring */}
        <circle
          cx={center}
          cy={center}
          r={radius - 14}
          fill="none"
          stroke="rgba(56, 189, 248, 0.06)"
          strokeWidth={1}
        />
      </svg>

      {/* Center content */}
      <div className="score-gauge-center">
        <span className="score-gauge-number">{displayNum}</span>
        {label && <span className="score-gauge-label">{label}</span>}
      </div>
    </div>
  );
}

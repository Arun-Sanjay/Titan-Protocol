"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useIsMobile } from "../../hooks/useIsMobile";

const OS_PEERS = ["/os/body", "/os/mind", "/os/money", "/os/general"];

function getDirection(prev: string, next: string): "right" | "left" | "fade" {
  if (prev === next) return "fade";

  if (OS_PEERS.some((p) => prev.startsWith(p)) && OS_PEERS.some((p) => next.startsWith(p))) {
    return "fade";
  }

  const prevDepth = prev.split("/").filter(Boolean).length;
  const nextDepth = next.split("/").filter(Boolean).length;

  if (nextDepth > prevDepth) return "right";
  if (nextDepth < prevDepth) return "left";
  return "fade";
}

const MOBILE_EASE = [0.32, 0.72, 0, 1] as const;

function useDirection(pathname: string): "right" | "left" | "fade" {
  const [state, setState] = React.useState<{ prev: string; direction: "right" | "left" | "fade" }>({
    prev: pathname,
    direction: "fade",
  });

  React.useEffect(() => {
    setState((s) => ({
      prev: pathname,
      direction: getDirection(s.prev, pathname),
    }));
  }, [pathname]);

  return state.direction;
}

export function PageTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const direction = useDirection(pathname);

  if (reduceMotion) {
    return <>{children}</>;
  }

  // Desktop: keep original fade-up
  if (!isMobile) {
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Mobile: directional slide
  const xOffset = direction === "right" ? "18%" : direction === "left" ? "-18%" : 0;
  const exitX = direction === "right" ? "-18%" : direction === "left" ? "18%" : 0;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: xOffset }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: exitX }}
        transition={{ duration: 0.25, ease: MOBILE_EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

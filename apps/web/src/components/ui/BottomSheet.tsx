"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const controls = useAnimationControls();
  const sheetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      controls.set({ y: 0 });
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, controls]);

  const handleDragEnd = React.useCallback(
    (_: unknown, info: { velocity: { y: number }; offset: { y: number } }) => {
      if (info.velocity.y > 500 || info.offset.y > 150) {
        onClose();
      } else {
        controls.start({ y: 0, transition: { type: "spring", damping: 28, stiffness: 300 } });
      }
    },
    [onClose, controls]
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="tx-bottom-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className="tx-bottom-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{ y: controls ? undefined : 0 }}
          >
            {/* Drag handle area — only this area captures drag gestures */}
            <motion.div
              className="tx-bottom-sheet-drag"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDrag={(_, info) => {
                if (info.offset.y > 0) {
                  sheetRef.current?.style.setProperty("transform", `translateY(${info.offset.y}px)`);
                }
              }}
              onDragEnd={(_, info) => {
                if (sheetRef.current) {
                  sheetRef.current.style.removeProperty("transform");
                }
                handleDragEnd(_, info);
              }}
              style={{ touchAction: "none" }}
            >
              <div className="tx-bottom-sheet-handle" />
              {title && (
                <p className="tx-bottom-sheet-title">{title}</p>
              )}
            </motion.div>
            {/* Scrollable content area — touch-action: pan-y allows native scrolling */}
            <div
              className="tx-bottom-sheet-content"
              style={{
                overflowY: "auto",
                touchAction: "pan-y",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

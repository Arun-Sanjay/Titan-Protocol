"use client";

import * as React from "react";
import { BottomSheet } from "./BottomSheet";
import { useIsMobile } from "../../hooks/useIsMobile";

type MobileModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function MobileModal({ open, onClose, title, children }: MobileModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    );
  }

  if (!open) return null;

  return (
    <div className="tx-modal" onClick={onClose}>
      <div className="tx-modal-panel" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="tx-modal-header">
            <p className="tx-kicker">{title}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

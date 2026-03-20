"use client";

import * as React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#050607",
            color: "rgba(245, 248, 255, 0.92)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(210, 216, 230, 0.62)",
                marginBottom: 8,
              }}
            >
              System Error
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "rgba(210, 216, 230, 0.62)",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Titan Protocol encountered an unexpected error. Your data is safe
              in local storage.
            </p>
            <pre
              style={{
                fontSize: 12,
                color: "rgba(222, 107, 125, 0.9)",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                overflow: "auto",
                maxHeight: 120,
                textAlign: "left",
              }}
            >
              {this.state.error?.message ?? "Unknown error"}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255, 255, 255, 0.26)",
                background: "rgba(12, 14, 18, 0.55)",
                color: "rgba(245, 248, 255, 0.92)",
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

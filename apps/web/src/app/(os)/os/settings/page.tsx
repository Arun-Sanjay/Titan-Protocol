"use client";

import * as React from "react";
import {
  exportAllData,
  importAllData,
  downloadJson,
  getLastBackupTime,
  setLastBackupTime,
} from "@/lib/backup";
import { useOnboarding } from "@/components/onboarding/OnboardingWizard";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { TitanTheme } from "@/lib/theme";

export default function SettingsPage() {
  // ── Backup state ──────────────────────────────────────────────────────────
  const [lastBackup, setLastBackup] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Theme ────────────────────────────────────────────────────────────────
  const { theme, setTheme } = useTheme();

  // ── Onboarding ────────────────────────────────────────────────────────────
  const { reset: resetOnboarding } = useOnboarding();

  React.useEffect(() => {
    setLastBackup(getLastBackupTime());
  }, []);

  // ── Backup handlers ───────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const json = await exportAllData();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(json, `titan-backup-${date}.json`);
      setLastBackupTime();
      setLastBackup(getLastBackupTime());
      setStatus("Backup exported successfully.");
    } catch (err) {
      console.error(err);
      setStatus("Export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.tables || typeof parsed.tables !== "object") {
        throw new Error("Invalid backup file format");
      }

      const tableNames = Object.keys(parsed.tables);
      const totalRows = tableNames.reduce(
        (sum, name) =>
          sum + (Array.isArray(parsed.tables[name]) ? parsed.tables[name].length : 0),
        0,
      );

      const confirmed = window.confirm(
        `This backup contains ${tableNames.length} tables and ${totalRows} rows.\n\nImporting will REPLACE all existing data. This cannot be undone.\n\nContinue?`,
      );

      if (!confirmed) {
        setStatus("Import cancelled.");
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const result = await importAllData(text);
      setStatus(
        `Import complete: ${result.tablesImported} tables, ${result.rowsImported} rows restored.`,
      );
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatus(
        err instanceof Error ? `Import failed: ${err.message}` : "Import failed.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formattedLastBackup = React.useMemo(() => {
    if (!lastBackup) return null;
    try {
      return new Date(lastBackup).toLocaleString();
    } catch {
      return lastBackup;
    }
  }, [lastBackup]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header>
        <p className="tp-kicker">Configuration</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">SETTINGS</h1>
      </header>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-4">Appearance</p>
        <div className="flex gap-3">
          {(
            [
              {
                key: "hud" as TitanTheme,
                label: "Black Metallic",
                desc: "Clean silver-on-black, minimal glow",
                gradient: "linear-gradient(135deg, #0b0b0b 0%, #1a1a1a 50%, #0b0b0b 100%)",
              },
              {
                key: "cyberpunk" as TitanTheme,
                label: "Cyberpunk",
                desc: "Cyan accents, neon glow, dense HUD",
                gradient: "linear-gradient(135deg, #050607 0%, #0c1a2a 50%, #050607 100%)",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTheme(opt.key)}
              className="flex-1 rounded-xl border p-4 text-left transition-all duration-150"
              style={{
                borderColor:
                  theme === opt.key
                    ? opt.key === "cyberpunk"
                      ? "rgba(56, 189, 248, 0.5)"
                      : "rgba(255, 255, 255, 0.3)"
                    : "rgba(255, 255, 255, 0.08)",
                background: opt.gradient,
                boxShadow:
                  theme === opt.key
                    ? opt.key === "cyberpunk"
                      ? "0 0 20px rgba(56, 189, 248, 0.15)"
                      : "0 0 20px rgba(255, 255, 255, 0.05)"
                    : "none",
              }}
            >
              <span
                className="mb-1 block text-sm font-semibold"
                style={{
                  color:
                    theme === opt.key
                      ? opt.key === "cyberpunk"
                        ? "#38bdf8"
                        : "rgba(245, 248, 255, 0.92)"
                      : "rgba(245, 248, 255, 0.6)",
                }}
              >
                {opt.label}
              </span>
              <span className="block text-xs" style={{ color: "rgba(210, 216, 230, 0.5)" }}>
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Data Backup & Restore ──────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-4">Data Backup &amp; Restore</p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="tp-button inline-flex w-auto px-5"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export Data"}
          </button>

          <button
            type="button"
            className="tp-button inline-flex w-auto px-5"
            onClick={handleImportClick}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import Data"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {formattedLastBackup && (
          <p className="tp-muted mt-4 text-sm">Last backup: {formattedLastBackup}</p>
        )}

        {status && <p className="body-label mt-3 text-sm">{status}</p>}

        <p className="tp-muted mt-4 text-xs">
          Warning: Importing a backup will replace ALL existing data in Titan Protocol.
          Make sure to export your current data first if you want to keep it.
        </p>
      </section>

      {/* ── Onboarding ─────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-4">Onboarding</p>
        <button
          type="button"
          className="tp-button tp-button-inline"
          onClick={() => {
            resetOnboarding();
            window.location.reload();
          }}
        >
          Replay Onboarding Tutorial
        </button>
        <p className="tp-muted mt-2 text-xs">
          Re-show the welcome wizard on next page load.
        </p>
      </section>
    </div>
  );
}

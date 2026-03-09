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

export default function SettingsPage() {
  // ── Backup state ──────────────────────────────────────────────────────────
  const [lastBackup, setLastBackup] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

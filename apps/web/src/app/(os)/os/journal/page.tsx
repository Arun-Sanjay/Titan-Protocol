"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../../../lib/db";
import { todayISO } from "../../../../lib/date";
import { saveEntry, deleteEntry, searchEntries } from "../../../../lib/journal";
import { MobileSubNav, TRACK_TABS } from "../../components/MobileSubNav";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function formatDateDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function previewText(content: string, maxLen = 50): string {
  const single = content.replace(/\n/g, " ").trim();
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen) + "...";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JournalPage() {
  const today = React.useMemo(() => todayISO(), []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [editorContent, setEditorContent] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState<
    "Saved" | "Saving..." | "No content"
  >("No content");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    Array<{ dateKey: string; content: string; updatedAt: number }>
  >([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Refs for debounce
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isLoadingRef = React.useRef(false);

  // ── Reactive queries ───────────────────────────────────────────────────────

  // Current entry for selected date
  const currentEntry = useLiveQuery(
    () => db.journal_entries.get(selectedDate),
    [selectedDate],
  );

  // Recent entries (last 30 with content)
  const recentEntries =
    useLiveQuery(
      () =>
        db.journal_entries
          .orderBy("dateKey")
          .reverse()
          .filter((e) => e.content.trim().length > 0)
          .limit(30)
          .toArray(),
      [],
    ) ?? [];

  // ── Sync editor with DB entry ──────────────────────────────────────────────

  React.useEffect(() => {
    isLoadingRef.current = true;
    if (currentEntry !== undefined) {
      if (currentEntry) {
        setEditorContent(currentEntry.content);
        setSaveStatus(currentEntry.content.trim() ? "Saved" : "No content");
      } else {
        setEditorContent("");
        setSaveStatus("No content");
      }
    }
    // Small delay to prevent the useEffect from triggering auto-save
    const t = setTimeout(() => {
      isLoadingRef.current = false;
    }, 50);
    return () => clearTimeout(t);
  }, [currentEntry]);

  // ── Auto-save with debounce ────────────────────────────────────────────────

  const handleContentChange = React.useCallback(
    (value: string) => {
      setEditorContent(value);

      // Don't auto-save while loading an entry
      if (isLoadingRef.current) return;

      if (!value.trim()) {
        setSaveStatus("No content");
        // If content was cleared, delete the entry
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          await deleteEntry(selectedDate);
          setSaveStatus("No content");
        }, 500);
        return;
      }

      setSaveStatus("Saving...");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await saveEntry(selectedDate, value);
        setSaveStatus("Saved");
      }, 500);
    },
    [selectedDate],
  );

  // Cleanup timers
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ── Search with debounce ───────────────────────────────────────────────────

  React.useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchEntries(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, [searchQuery]);

  // ── Date navigation ────────────────────────────────────────────────────────

  function goToPreviousDay() {
    setSelectedDate((d) => shiftDate(d, -1));
  }

  function goToNextDay() {
    setSelectedDate((d) => shiftDate(d, 1));
  }

  function goToDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSearchQuery("");
  }

  // ── Determine which list to show in sidebar ────────────────────────────────

  const sidebarEntries = searchQuery.trim() ? searchResults : recentEntries;
  const sidebarLabel = searchQuery.trim()
    ? `Search Results (${searchResults.length})`
    : "Recent Entries";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <MobileSubNav tabs={TRACK_TABS} />
      {/* Header */}
      <header>
        <p className="tp-kicker">Daily Notes</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">JOURNAL</h1>
      </header>

      {/* Main layout: sidebar + editor */}
      <div className="mt-6 flex gap-4" style={{ minHeight: 520 }}>
        {/* ── Sidebar: recent entries ─────────────────────────────────── */}
        <aside
          className="tp-panel flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: 240 }}
        >
          {/* Search input */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#34d399]/50"
              />
            </div>
          </div>

          {/* Entries list */}
          <div className="flex-1 overflow-y-auto">
            <p className="tp-kicker px-3 pt-3 pb-1">{sidebarLabel}</p>

            {isSearching && (
              <p className="tp-muted px-3 py-2 text-xs">Searching...</p>
            )}

            {!isSearching && sidebarEntries.length === 0 && (
              <p className="tp-muted px-3 py-4 text-xs text-center">
                {searchQuery.trim() ? "No results found." : "No entries yet."}
              </p>
            )}

            <div className="space-y-0.5 px-1.5 pb-2">
              {sidebarEntries.map((entry) => {
                const isActive = entry.dateKey === selectedDate;
                return (
                  <button
                    key={entry.dateKey}
                    type="button"
                    onClick={() => goToDate(entry.dateKey)}
                    className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                      isActive
                        ? "bg-[#34d399]/10 border border-[#34d399]/20"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <p
                      className={`text-xs font-medium ${
                        isActive ? "text-[#34d399]" : "text-white/60"
                      }`}
                    >
                      {entry.dateKey}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5 truncate">
                      {previewText(entry.content)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Editor area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Date navigation */}
          <div className="tp-panel p-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousDay}
              className="tp-button tp-button-inline text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous Day
            </button>

            <div className="text-center">
              <p className="text-sm font-medium text-white/90">
                {formatDateDisplay(selectedDate)}
              </p>
              {selectedDate === today && (
                <p className="text-xs text-[#34d399] mt-0.5">Today</p>
              )}
            </div>

            <button
              type="button"
              onClick={goToNextDay}
              className="tp-button tp-button-inline text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              Next Day
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Editor */}
          <div className="tp-panel mt-3 flex-1 flex flex-col p-4">
            {/* Status bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    saveStatus === "Saved"
                      ? "text-[#34d399]"
                      : saveStatus === "Saving..."
                        ? "text-amber-400"
                        : "text-white/30"
                  }`}
                >
                  {saveStatus === "Saved" && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {saveStatus}
                </span>
              </div>
              <span className="text-xs text-white/30">
                {wordCount(editorContent)}{" "}
                {wordCount(editorContent) === 1 ? "word" : "words"}
              </span>
            </div>

            {/* Textarea */}
            <textarea
              value={editorContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your thoughts for the day..."
              className="flex-1 w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-sm text-white font-mono leading-relaxed resize-none placeholder:text-white/20 focus:outline-none focus:border-[#34d399]/30"
              style={{ minHeight: 400 }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  listBudgets,
  addBudget,
  updateBudget,
  deleteBudget,
  getBudgetSpending,
  getBudgetSummary,
  type BudgetSpending,
} from "@/lib/budgets";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_SUGGESTIONS = [
  "Food",
  "Transport",
  "Rent",
  "Groceries",
  "Utilities",
  "Health",
  "Education",
  "Bills",
  "Entertainment",
  "Dining Out",
  "Shopping",
  "Travel",
  "Gaming",
  "Other",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  // ── Data subscriptions ────────────────────────────────────────────────────
  const budgets = useLiveQuery(() => listBudgets(), []);
  const moneyTx = useLiveQuery(() => db.money_tx.count(), []);

  // ── Computed spending ─────────────────────────────────────────────────────
  const [spending, setSpending] = React.useState<BudgetSpending[]>([]);
  const [summary, setSummary] = React.useState({
    totalLimit: 0,
    totalSpent: 0,
    percent: 0,
  });

  React.useEffect(() => {
    getBudgetSpending().then(setSpending);
    getBudgetSummary().then(setSummary);
  }, [budgets, moneyTx]);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [showModal, setShowModal] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");
  const [newLimit, setNewLimit] = React.useState("");

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editLimit, setEditLimit] = React.useState("");

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleAdd() {
    const cat = newCategory.trim();
    const limit = Number(newLimit);
    if (!cat || !Number.isFinite(limit) || limit <= 0) return;
    await addBudget(cat, limit);
    setNewCategory("");
    setNewLimit("");
    setShowModal(false);
  }

  async function handleUpdate(id: number) {
    const limit = Number(editLimit);
    if (!Number.isFinite(limit) || limit <= 0) return;
    await updateBudget(id, limit);
    setEditingId(null);
    setEditLimit("");
  }

  async function handleDelete(id: number) {
    await deleteBudget(id);
  }

  function startEdit(id: number, currentLimit: number) {
    setEditingId(id);
    setEditLimit(String(currentLimit));
  }

  // ── Progress bar color ────────────────────────────────────────────────────
  function barColor(percent: number): string {
    if (percent >= 100) return "#ef4444"; // red
    if (percent >= 80) return "#f97316"; // orange
    if (percent >= 60) return "#eab308"; // yellow
    return "#34d399"; // green
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <p className="tp-kicker">Money Engine</p>
        <h1 className="tp-title">Budgets</h1>
        <p className="tp-subtitle mt-1">
          Set monthly spending limits per category.
        </p>
      </header>

      {/* Summary */}
      {budgets && budgets.length > 0 && (
        <div className="mt-6 tp-panel p-5">
          <p className="tp-kicker mb-3">Monthly Overview</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">
                ${summary.totalSpent.toLocaleString()}
              </p>
              <p className="tp-muted text-[11px] mt-1">Spent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                ${summary.totalLimit.toLocaleString()}
              </p>
              <p className="tp-muted text-[11px] mt-1">Budget</p>
            </div>
            <div>
              <p
                className="text-2xl font-bold"
                style={{ color: barColor(summary.percent) }}
              >
                {summary.percent}%
              </p>
              <p className="tp-muted text-[11px] mt-1">Used</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded bg-white/5">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(100, summary.percent)}%`,
                backgroundColor: barColor(summary.percent),
              }}
            />
          </div>
        </div>
      )}

      {/* Budget list */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="tp-kicker">Budget Categories</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="tp-button tp-button-inline"
          >
            + Add Budget
          </button>
        </div>

        {spending.length === 0 ? (
          <div className="body-empty">
            No budgets set. Add categories to start tracking.
          </div>
        ) : (
          <div className="grid gap-3">
            {spending.map((item) => {
              const isEditing = editingId === item.budget.id;
              return (
                <div key={item.budget.id} className="tp-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white/90">
                          {item.budget.category}
                        </p>
                        <p className="text-xs text-white/50">
                          ${item.spent.toLocaleString()} / $
                          {item.budget.monthlyLimit.toLocaleString()}
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded bg-white/5">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, item.percent)}%`,
                            backgroundColor: barColor(item.percent),
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-white/40">
                          ${item.remaining.toLocaleString()} remaining
                        </p>
                        <p
                          className="text-[10px] font-semibold"
                          style={{ color: barColor(item.percent) }}
                        >
                          {item.percent}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="body-input w-20 text-xs"
                            value={editLimit}
                            onChange={(e) => setEditLimit(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleUpdate(item.budget.id!);
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.budget.id!)}
                            className="text-[#34d399] text-xs px-1"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(item.budget.id!, item.budget.monthlyLimit)
                          }
                          className="text-white/30 hover:text-white/60 text-xs transition-colors"
                          title="Edit limit"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.budget.id!)}
                        className="text-white/30 hover:text-red-400 text-xs transition-colors"
                        title="Delete budget"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Budget Modal */}
      {showModal && (
        <div
          className="body-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">New Budget</p>
            <h2 className="text-lg font-semibold text-white/90 mb-4">
              Set a Monthly Spending Limit
            </h2>

            <div className="space-y-4">
              <div>
                <label className="body-label">Category</label>
                <input
                  type="text"
                  className="body-input"
                  placeholder="e.g. Food"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  list="budget-categories"
                  autoFocus
                />
                <datalist id="budget-categories">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="body-label">Monthly Limit ($)</label>
                <input
                  type="number"
                  className="body-input"
                  placeholder="500"
                  min={1}
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                className="tp-button inline-flex w-auto px-5"
                disabled={!newCategory.trim() || !newLimit}
              >
                Add Budget
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="tp-button tp-button-inline inline-flex w-auto px-5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

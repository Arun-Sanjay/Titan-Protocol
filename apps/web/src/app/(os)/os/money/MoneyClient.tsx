"use client";

import * as React from "react";

import type { MoneyLoan, MoneyTx } from "../../../../lib/db";
import { ThreeMonthCalendar } from "../../../../components/calendar/ThreeMonthCalendar";
import { assertDateISO, monthBounds, todayISO } from "../../../../lib/date";
import { formatMoney, type MoneyCurrency } from "../../../../lib/money_format";
import {
  addBorrowed,
  addExpense,
  addIncome,
  addRepayment,
  computeDayTotals,
  computeMonthTotals,
  computeOutstandingBorrowed,
  deleteLoan,
  deleteTx,
  getMoneyStartDate,
  listLoans,
  listTxByDate,
  listTxByRange,
  updateLoan,
  updateTx,
} from "../../../../lib/money";

type ModalType = "expense" | "income" | "borrowed" | "repayment" | "edit-tx" | "edit-loan";

type CategoryBucket = "need" | "want";

const NEED_CATEGORIES = [
  "Food",
  "Transport",
  "Rent",
  "Groceries",
  "Utilities",
  "Health",
  "Education",
  "Bills",
  "Family",
  "Other Need",
];

const WANT_CATEGORIES = [
  "Entertainment",
  "Dining Out",
  "Shopping",
  "Travel",
  "Dating/Social",
  "Gaming",
  "Luxury/Style",
  "Gadgets",
  "Other Want",
];

const INCOME_CATEGORIES = ["Salary", "Borrowed", "Other Income"];

type TxDraft = {
  type: "expense" | "income" | "borrowed" | "repayment";
  amount: string;
  dateISO: string;
  category: string;
  bucket: CategoryBucket;
  note: string;
  lender: string;
  dueISO: string;
  loanId: string | null;
};

type LoanDraft = {
  id: string;
  lender: string;
  amount: string;
  dateISO: string;
  dueISO: string;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function bucketForCategory(category: string): CategoryBucket | null {
  if (NEED_CATEGORIES.includes(category)) return "need";
  if (WANT_CATEGORIES.includes(category)) return "want";
  return null;
}

function normalizeExpenseCategory(category: string | null | undefined, bucket: CategoryBucket | null | undefined) {
  const safeCategory = category ?? "";
  if (NEED_CATEGORIES.includes(safeCategory) || WANT_CATEGORIES.includes(safeCategory)) {
    return { category: safeCategory, bucket: bucketForCategory(safeCategory) ?? bucket ?? "need" };
  }
  if (bucket === "want") return { category: "Other Want", bucket: "want" as const };
  return { category: "Other Need", bucket: "need" as const };
}

function normalizeIncomeCategory(category: string | null | undefined) {
  const safeCategory = category ?? "";
  if (INCOME_CATEGORIES.includes(safeCategory)) return safeCategory;
  return "Other Income";
}

function getRangeFromOffset(monthOffset: number) {
  const base = addMonths(startOfMonth(new Date()), monthOffset);
  const start = toDateKey(startOfMonth(addMonths(base, -1)));
  const end = toDateKey(endOfMonth(addMonths(base, 1)));
  return { start, end };
}

function txLabel(tx: MoneyTx) {
  switch (tx.type) {
    case "expense":
      return tx.category ? `Expense • ${tx.category}` : "Expense";
    case "income":
      return tx.category ? `Income • ${tx.category}` : "Income";
    case "borrowed":
      return "Borrowed";
    case "repayment":
      return "Repayment";
    default:
      return tx.type;
  }
}

function txTone(tx: MoneyTx) {
  if (tx.type === "expense" || tx.type === "repayment") return "text-red-200";
  return "text-emerald-200";
}

function txIcon(tx: MoneyTx) {
  switch (tx.type) {
    case "expense":
      return "−";
    case "income":
      return "+";
    case "borrowed":
      return "⇧";
    case "repayment":
      return "↩";
    default:
      return "•";
  }
}

const EMPTY_DRAFT: TxDraft = {
  type: "expense",
  amount: "",
  dateISO: todayISO(),
  category: "Food",
  bucket: "need",
  note: "",
  lender: "",
  dueISO: "",
  loanId: null,
};

export default function MoneyClient({ initialDate }: { initialDate: string | null }) {
  const todayKey = React.useMemo(() => todayISO(), []);
  const initialDateKey = React.useMemo(() => {
    if (initialDate) {
      try {
        return assertDateISO(initialDate);
      } catch (err) {
        console.error(err);
      }
    }
    return todayKey;
  }, [initialDate, todayKey]);

  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(initialDateKey);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [startDateISO, setStartDateISO] = React.useState<string>(todayKey);
  const [currency, setCurrency] = React.useState<MoneyCurrency>("USD");
  const [dayTx, setDayTx] = React.useState<MoneyTx[]>([]);
  const [monthTotals, setMonthTotals] = React.useState({
    spent: 0,
    income: 0,
    net: 0,
    needs: 0,
    wants: 0,
    categories: {} as Record<string, number>,
  });
  const [dayTotals, setDayTotals] = React.useState({ spent: 0, income: 0, net: 0 });
  const [outstandingBorrowed, setOutstandingBorrowed] = React.useState(0);
  const [loans, setLoans] = React.useState<MoneyLoan[]>([]);
  const [scoreByDate, setScoreByDate] = React.useState<Record<string, number>>({});
  const [modal, setModal] = React.useState<ModalType | null>(null);
  const [txDraft, setTxDraft] = React.useState<TxDraft>(() => ({ ...EMPTY_DRAFT, dateISO: initialDateKey }));
  const [loanDraft, setLoanDraft] = React.useState<LoanDraft | null>(null);
  const [editingTx, setEditingTx] = React.useState<MoneyTx | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dataTick, setDataTick] = React.useState(0);

  const monthKey = React.useMemo(() => selectedDateISO, [selectedDateISO]);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.currency") : null;
    if (stored && (stored === "USD" || stored === "EUR" || stored === "GBP" || stored === "INR")) {
      setCurrency(stored);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("money.currency", currency);
  }, [currency]);

  React.useEffect(() => {
    let mounted = true;
    async function loadDay() {
      if (!selectedDateISO) return;
      let safeDate: string;
      try {
        safeDate = assertDateISO(selectedDateISO);
      } catch (err) {
        console.error(err);
        return;
      }
      const [tx, totals] = await Promise.all([listTxByDate(safeDate), computeDayTotals(safeDate)]);
      if (!mounted) return;
      setDayTx(tx);
      setDayTotals(totals);
    }
    loadDay();
    return () => {
      mounted = false;
    };
  }, [selectedDateISO, dataTick]);

  React.useEffect(() => {
    let mounted = true;
    async function loadMonth() {
      if (!monthKey) return;
      const totals = await computeMonthTotals(monthKey);
      if (!mounted) return;
      setMonthTotals(totals);
    }
    loadMonth();
    return () => {
      mounted = false;
    };
  }, [monthKey, dataTick]);

  React.useEffect(() => {
    let mounted = true;
    async function loadLoans() {
      const [loanRows, outstanding, earliest] = await Promise.all([
        listLoans("unpaid"),
        computeOutstandingBorrowed(),
        getMoneyStartDate(),
      ]);
      if (!mounted) return;
      setLoans(loanRows);
      setOutstandingBorrowed(outstanding);
      setStartDateISO(earliest);
    }
    loadLoans();
    return () => {
      mounted = false;
    };
  }, [dataTick]);

  React.useEffect(() => {
    let mounted = true;
    async function loadCalendarScores() {
      const { start, end } = getRangeFromOffset(monthOffset);
      const tx = await listTxByRange(start, end);
      const map: Record<string, number> = {};
      tx.forEach((row) => {
        if (!row.dateISO) return;
        map[row.dateISO] = 100;
      });
      if (mounted) setScoreByDate(map);
    }
    loadCalendarScores();
    return () => {
      mounted = false;
    };
  }, [monthOffset, dataTick]);

  function openModal(type: TxDraft["type"], seed?: Partial<TxDraft>) {
    setFormError(null);
    setEditingTx(null);
    setLoanDraft(null);
    const nextDraft: TxDraft = {
      ...EMPTY_DRAFT,
      dateISO: selectedDateISO,
      type,
      ...seed,
    };
    if (type === "income") {
      nextDraft.category = INCOME_CATEGORIES[0];
    }
    if (type === "expense") {
      const normalized = normalizeExpenseCategory(nextDraft.category, nextDraft.bucket);
      nextDraft.category = normalized.category;
      nextDraft.bucket = normalized.bucket;
    }
    if (type === "repayment") {
      nextDraft.category = "Debt Repayment";
    }
    setTxDraft(nextDraft);
    setModal(type);
  }

  async function handleSaveTx() {
    setFormError(null);
    const amount = Number(txDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Amount must be a valid number.");
      return;
    }
    let safeDate: string;
    try {
      safeDate = assertDateISO(txDraft.dateISO);
    } catch (err) {
      console.error(err);
      setFormError("Date must be valid.");
      return;
    }

    try {
      if (editingTx) {
        if (editingTx.type === "expense") {
          await updateTx(editingTx.id, {
            amount,
            dateISO: safeDate,
            category: txDraft.category || null,
            bucket: txDraft.bucket,
            note: txDraft.note || null,
          });
        } else if (editingTx.type === "income") {
          await updateTx(editingTx.id, {
            amount,
            dateISO: safeDate,
            category: txDraft.category || null,
            note: txDraft.note || null,
          });
        } else if (editingTx.type === "borrowed") {
          await updateTx(editingTx.id, {
            amount,
            dateISO: safeDate,
            note: txDraft.note || null,
          });
          if (editingTx.loanId) {
            await updateLoan(editingTx.loanId, {
              amount,
              lender: txDraft.lender || null,
              dueISO: txDraft.dueISO || null,
              dateISO: safeDate,
            });
          }
        } else if (editingTx.type === "repayment") {
          await updateTx(editingTx.id, {
            amount,
            dateISO: safeDate,
            category: "Debt Repayment",
            note: txDraft.note || null,
          });
        }
      } else if (txDraft.type === "expense") {
        await addExpense({
          dateISO: safeDate,
          amount,
          category: txDraft.category || null,
          bucket: txDraft.bucket,
          note: txDraft.note || null,
        });
      } else if (txDraft.type === "income") {
        await addIncome({
          dateISO: safeDate,
          amount,
          category: txDraft.category || null,
          note: txDraft.note || null,
        });
      } else if (txDraft.type === "borrowed") {
        await addBorrowed({
          dateISO: safeDate,
          amount,
          lender: txDraft.lender || null,
          dueISO: txDraft.dueISO || null,
          note: txDraft.note || null,
        });
      } else if (txDraft.type === "repayment" && txDraft.loanId) {
        await addRepayment({
          loanId: txDraft.loanId,
          dateISO: safeDate,
          amount,
          note: txDraft.note || null,
        });
      }
      setModal(null);
      setDataTick((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteTx(tx: MoneyTx) {
    if (!confirm("Delete this transaction?")) return;
    await deleteTx(tx.id);
    setDataTick((prev) => prev + 1);
  }

  async function handleDeleteLoan(loan: MoneyLoan) {
    if (!confirm("Delete this loan and related transactions?")) return;
    await deleteLoan(loan.id);
    setDataTick((prev) => prev + 1);
  }

  function handleEditTx(tx: MoneyTx) {
    setEditingTx(tx);
    const loan = tx.loanId ? loans.find((item) => item.id === tx.loanId) : null;
    const expenseDefaults = normalizeExpenseCategory(tx.category, tx.bucket as CategoryBucket | null);
    const incomeCategory = normalizeIncomeCategory(tx.category);
    setTxDraft({
      type: tx.type,
      amount: String(tx.amount),
      dateISO: tx.dateISO,
      category:
        tx.type === "expense"
          ? expenseDefaults.category
          : tx.type === "income"
            ? incomeCategory
            : tx.type === "repayment"
              ? "Debt Repayment"
              : tx.category ?? "",
      bucket: tx.type === "expense" ? expenseDefaults.bucket : "need",
      note: tx.note ?? "",
      lender: loan?.lender ?? "",
      dueISO: loan?.dueISO ?? "",
      loanId: tx.loanId ?? null,
    });
    setModal("edit-tx");
  }

  function handleEditLoan(loan: MoneyLoan) {
    setLoanDraft({
      id: loan.id,
      lender: loan.lender ?? "",
      amount: String(loan.amount),
      dateISO: loan.dateISO,
      dueISO: loan.dueISO ?? "",
    });
    setModal("edit-loan");
  }

  async function handleSaveLoan() {
    if (!loanDraft) return;
    const amount = Number(loanDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Amount must be valid.");
      return;
    }
    try {
      await updateLoan(loanDraft.id, {
        amount,
        lender: loanDraft.lender || null,
        dateISO: assertDateISO(loanDraft.dateISO),
        dueISO: loanDraft.dueISO || null,
      });
      setModal(null);
      setLoanDraft(null);
      setDataTick((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  const txGrouped = React.useMemo(() => {
    const groups: Record<string, MoneyTx[]> = {};
    dayTx.forEach((tx) => {
      if (!groups[tx.dateISO]) groups[tx.dateISO] = [];
      groups[tx.dateISO].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [dayTx]);

  const start = React.useMemo(() => {
    if (!selectedDateISO) return "";
    try {
      return monthBounds(selectedDateISO).start;
    } catch (err) {
      console.error(err);
      return "";
    }
  }, [selectedDateISO]);

  const topCategories = React.useMemo(() => {
    return Object.entries(monthTotals.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [monthTotals.categories]);

  const needsTotal = monthTotals.needs;
  const wantsTotal = monthTotals.wants;
  const needsPct = needsTotal + wantsTotal === 0 ? 0 : Math.round((needsTotal / (needsTotal + wantsTotal)) * 100);

  function handleExpenseCategoryChange(value: string) {
    const bucket = bucketForCategory(value);
    setTxDraft((prev) => ({
      ...prev,
      category: value,
      bucket: bucket ?? prev.bucket,
    }));
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MONEY ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Cashflow tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="body-label">Selected</label>
          <input
            type="date"
            className="body-input w-[150px]"
            value={selectedDateISO}
            onChange={(event) => setSelectedDateISO(event.target.value)}
          />
          <label className="body-label">Currency</label>
          <select
            className="body-select w-[110px]"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as MoneyCurrency)}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
          </select>
          <button type="button" className="tp-button tp-button-inline" onClick={() => openModal("expense")}>
            Add Expense
          </button>
          <button type="button" className="tp-button tp-button-inline" onClick={() => openModal("income")}>
            Add Income
          </button>
          <button type="button" className="tp-button tp-button-inline" onClick={() => openModal("borrowed")}>
            Add Borrowed
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <ThreeMonthCalendar
          selectedDateISO={selectedDateISO}
          onSelect={setSelectedDateISO}
          monthOffset={monthOffset}
          onMonthOffsetChange={setMonthOffset}
          scoreByDate={scoreByDate}
          startDateISO={startDateISO}
          todayISO={todayKey}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="tp-panel p-4">
            <p className="tp-kicker">Day Summary</p>
            <p className="tp-muted mt-2 text-xs">{selectedDateISO}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                    <span className="tp-muted">Spent</span>
                    <span>{formatMoney(dayTotals.spent, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="tp-muted">Income</span>
                    <span>{formatMoney(dayTotals.income, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="tp-muted">Net</span>
                    <span>{formatMoney(dayTotals.net, currency)}</span>
                  </div>
            </div>
          </section>

          <section className="tp-panel p-4">
            <p className="tp-kicker">Month Summary</p>
            <p className="tp-muted mt-2 text-xs">{start}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                    <span className="tp-muted">Spent</span>
                    <span>{formatMoney(monthTotals.spent, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="tp-muted">Income</span>
                    <span>{formatMoney(monthTotals.income, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="tp-muted">Net</span>
                    <span>{formatMoney(monthTotals.net, currency)}</span>
                  </div>
            </div>
          </section>

          <section className="tp-panel p-4">
            <p className="tp-kicker">Outstanding Borrowed</p>
            <p className="mt-4 text-2xl font-semibold">{formatMoney(outstandingBorrowed, currency)}</p>
            <p className="tp-muted mt-2 text-xs">Unpaid loans</p>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1.8fr]">
          <section className="tp-panel p-4">
            <p className="tp-kicker">Needs vs Wants</p>
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded bg-white/5">
                <div
                  className="h-full bg-emerald-300/40"
                  style={{ width: `${needsPct}%` }}
                  aria-label="Needs"
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-white/60">
                <span>Needs: {formatMoney(needsTotal, currency)}</span>
                <span>Wants: {formatMoney(wantsTotal, currency)}</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="tp-kicker">Top Categories</p>
              <div className="mt-3 space-y-2 text-sm">
                {topCategories.length === 0 ? (
                  <p className="tp-muted text-xs">No spending yet.</p>
                ) : (
                  topCategories.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="truncate">{category}</span>
                      <span className="tabular-nums">{formatMoney(amount, currency)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="tp-panel p-4">
            <div className="tp-panel-head">
              <div>
                <p className="tp-kicker">Transactions</p>
                <p className="tp-muted text-xs">Filtered by {selectedDateISO}</p>
              </div>
              <span className="tp-muted text-xs">Total: {dayTx.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {txGrouped.length === 0 ? (
                <div className="body-empty">No transactions for this day.</div>
              ) : (
                txGrouped.map(([dateKey, rows]) => (
                  <div key={dateKey} className="space-y-2">
                    <p className="tp-muted text-xs">{dateKey}</p>
                    {rows.map((tx) => (
                      <div key={tx.id} className="body-task-row">
                        <div className="flex items-start gap-3">
                          <span className="body-badge">{txIcon(tx)}</span>
                          <div>
                            <p className="text-sm">{txLabel(tx)}</p>
                            {tx.note ? <p className="text-xs text-white/50">{tx.note}</p> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm tabular-nums ${txTone(tx)}`}>{formatMoney(tx.amount, currency)}</span>
                          <details className="body-menu">
                            <summary>•••</summary>
                            <div className="body-menu-panel">
                              <button type="button" onClick={() => handleEditTx(tx)}>
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteTx(tx)}>
                                Delete
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="tp-panel p-4">
          <div className="tp-panel-head">
            <div>
              <p className="tp-kicker">Borrowed</p>
              <p className="tp-muted text-xs">Unpaid loans</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {loans.length === 0 ? (
              <div className="body-empty">No borrowed balances.</div>
            ) : (
              loans.map((loan) => (
                <div key={loan.id} className="body-task-row">
                  <div>
                    <p className="text-sm">{loan.lender || "Unknown lender"}</p>
                    <p className="text-xs text-white/50">
                      Borrowed {loan.dateISO}
                      {loan.dueISO ? ` • Due ${loan.dueISO}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{formatMoney(loan.amount, currency)}</span>
                    <details className="body-menu">
                      <summary>•••</summary>
                      <div className="body-menu-panel">
                        <button
                          type="button"
                          onClick={() =>
                            openModal("repayment", {
                              type: "repayment",
                              loanId: loan.id,
                              amount: String(loan.amount),
                              dateISO: selectedDateISO,
                            })
                          }
                        >
                          Mark as repaid
                        </button>
                        <button type="button" onClick={() => handleEditLoan(loan)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteLoan(loan)}>
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {modal ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">
                {modal === "edit-tx"
                  ? "Edit transaction"
                  : modal === "edit-loan"
                    ? "Edit loan"
                    : modal === "repayment"
                      ? "Repayment"
                      : modal === "borrowed"
                        ? "Borrowed"
                        : modal === "income"
                          ? "Income"
                          : "Expense"}
              </p>
              <button type="button" className="tp-button tp-button-inline" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
            {formError ? <p className="mt-3 text-xs text-red-400">{formError}</p> : null}

            {modal === "edit-loan" && loanDraft ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="body-label">Lender</label>
                  <input
                    className="body-input"
                    value={loanDraft.lender}
                    onChange={(event) => setLoanDraft({ ...loanDraft, lender: event.target.value })}
                  />
                </div>
                <div>
                  <label className="body-label">Amount</label>
                  <input
                    className="body-input"
                    type="number"
                    value={loanDraft.amount}
                    onChange={(event) => setLoanDraft({ ...loanDraft, amount: event.target.value })}
                  />
                </div>
                <div>
                  <label className="body-label">Borrowed date</label>
                  <input
                    className="body-input"
                    type="date"
                    value={loanDraft.dateISO}
                    onChange={(event) => setLoanDraft({ ...loanDraft, dateISO: event.target.value })}
                  />
                </div>
                <div>
                  <label className="body-label">Due date</label>
                  <input
                    className="body-input"
                    type="date"
                    value={loanDraft.dueISO}
                    onChange={(event) => setLoanDraft({ ...loanDraft, dueISO: event.target.value })}
                  />
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={handleSaveLoan} className="tp-button w-auto px-4">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="body-label">Amount</label>
                  <input
                    className="body-input"
                    type="number"
                    value={txDraft.amount}
                    onChange={(event) => setTxDraft({ ...txDraft, amount: event.target.value })}
                  />
                </div>
                <div>
                  <label className="body-label">Date</label>
                  <input
                    className="body-input"
                    type="date"
                    value={txDraft.dateISO}
                    onChange={(event) => setTxDraft({ ...txDraft, dateISO: event.target.value })}
                  />
                </div>
                {(modal === "expense" || (modal === "edit-tx" && txDraft.type === "expense")) && (
                  <>
                    <div>
                      <label className="body-label">Category</label>
                      <select className="body-select" value={txDraft.category} onChange={(event) => handleExpenseCategoryChange(event.target.value)}>
                        <optgroup label="Needs">
                          {NEED_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Wants">
                          {WANT_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="body-label">Bucket</label>
                      <select
                        className="body-select"
                        value={txDraft.bucket}
                        onChange={(event) => setTxDraft({ ...txDraft, bucket: event.target.value as CategoryBucket })}
                        disabled
                      >
                        <option value="need">Need</option>
                        <option value="want">Want</option>
                      </select>
                    </div>
                  </>
                )}

                {(modal === "income" || (modal === "edit-tx" && txDraft.type === "income")) && (
                  <div>
                    <label className="body-label">Category</label>
                    <select
                      className="body-select"
                      value={txDraft.category}
                      onChange={(event) => setTxDraft({ ...txDraft, category: event.target.value })}
                    >
                      {INCOME_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(modal === "repayment" || (modal === "edit-tx" && txDraft.type === "repayment")) && (
                  <div>
                    <label className="body-label">Category</label>
                    <input className="body-input" value="Debt Repayment" disabled />
                  </div>
                )}

                {(modal === "borrowed" || (modal === "edit-tx" && txDraft.type === "borrowed")) && (
                  <>
                    <div>
                      <label className="body-label">Lender</label>
                      <input
                        className="body-input"
                        value={txDraft.lender}
                        onChange={(event) => setTxDraft({ ...txDraft, lender: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className="body-label">Due date</label>
                      <input
                        className="body-input"
                        type="date"
                        value={txDraft.dueISO}
                        onChange={(event) => setTxDraft({ ...txDraft, dueISO: event.target.value })}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="body-label">Note</label>
                  <textarea
                    className="body-input"
                    rows={3}
                    value={txDraft.note}
                    onChange={(event) => setTxDraft({ ...txDraft, note: event.target.value })}
                  />
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={handleSaveTx} className="tp-button w-auto px-4">
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

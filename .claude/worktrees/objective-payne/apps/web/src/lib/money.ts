import { db, type MoneyLoan, type MoneyTx, type MoneyLog, type MoneyTask } from "./db";
import { assertDateISO, monthBounds, todayISO } from "./date";
import { uid } from "./id";

type MoneyTxBase = {
  dateISO: string;
  amount: number;
  category?: string | null;
  bucket?: "need" | "want" | null;
  note?: string | null;
  loanId?: string | null;
};

type BorrowedInput = {
  dateISO: string;
  amount: number;
  lender?: string | null;
  dueISO?: string | null;
  note?: string | null;
};

type RepaymentInput = {
  loanId: string;
  dateISO: string;
  amount: number;
  note?: string | null;
};

function normalizeTx(input: MoneyTx): MoneyTx {
  return {
    ...input,
    category: input.category ?? null,
    bucket: input.bucket ?? null,
    note: input.note ?? null,
    loanId: input.loanId ?? null,
  };
}

export async function addExpense(input: MoneyTxBase): Promise<MoneyTx> {
  const safeDate = assertDateISO(input.dateISO);
  const tx: MoneyTx = normalizeTx({
    id: uid(),
    dateISO: safeDate,
    type: "expense",
    amount: input.amount,
    category: input.category ?? null,
    bucket: input.bucket ?? null,
    note: input.note ?? null,
    loanId: null,
  });
  await db.money_tx.add(tx);
  return tx;
}

export async function addIncome(input: MoneyTxBase): Promise<MoneyTx> {
  const safeDate = assertDateISO(input.dateISO);
  const tx: MoneyTx = normalizeTx({
    id: uid(),
    dateISO: safeDate,
    type: "income",
    amount: input.amount,
    category: input.category ?? null,
    bucket: null,
    note: input.note ?? null,
    loanId: null,
  });
  await db.money_tx.add(tx);
  return tx;
}

export async function addBorrowed(input: BorrowedInput): Promise<{ loan: MoneyLoan; tx: MoneyTx }> {
  const safeDate = assertDateISO(input.dateISO);
  const loan: MoneyLoan = {
    id: uid(),
    lender: input.lender ?? null,
    amount: input.amount,
    dateISO: safeDate,
    dueISO: input.dueISO ?? null,
    status: "unpaid",
  };
  await db.money_loans.add(loan);

  const tx: MoneyTx = normalizeTx({
    id: uid(),
    dateISO: safeDate,
    type: "borrowed",
    amount: input.amount,
    category: null,
    bucket: null,
    note: input.note ?? null,
    loanId: loan.id,
  });
  await db.money_tx.add(tx);
  return { loan, tx };
}

export async function addRepayment(input: RepaymentInput): Promise<MoneyTx> {
  const safeDate = assertDateISO(input.dateISO);
  const existingLoan = await db.money_loans.get(input.loanId);
  if (!existingLoan) {
    throw new Error("Loan not found.");
  }
  const tx: MoneyTx = normalizeTx({
    id: uid(),
    dateISO: safeDate,
    type: "repayment",
    amount: input.amount,
    category: "Debt Repayment",
    bucket: null,
    note: input.note ?? null,
    loanId: input.loanId,
  });
  await db.money_tx.add(tx);
  await db.money_loans.update(input.loanId, { status: "paid" });
  return tx;
}

export async function listTxByDate(dateISO: string): Promise<MoneyTx[]> {
  const safeDate = assertDateISO(dateISO);
  const rows = await db.money_tx.toArray();
  return rows.filter((tx) => tx.dateISO === safeDate);
}

export async function listTxByMonth(dateISO: string): Promise<MoneyTx[]> {
  const { start, end } = monthBounds(assertDateISO(dateISO));
  const rows = await db.money_tx.toArray();
  return rows.filter((tx) => typeof tx.dateISO === "string" && tx.dateISO >= start && tx.dateISO < end);
}

export async function listTxByRange(startISO: string, endISO: string): Promise<MoneyTx[]> {
  const start = assertDateISO(startISO);
  const end = assertDateISO(endISO);
  const rows = await db.money_tx.toArray();
  return rows.filter((tx) => typeof tx.dateISO === "string" && tx.dateISO >= start && tx.dateISO <= end);
}

export async function listLoans(status?: "unpaid" | "paid"): Promise<MoneyLoan[]> {
  const rows = await db.money_loans.toArray();
  if (!status) return rows;
  return rows.filter((loan) => loan.status === status);
}

export async function listMoneyTasks(): Promise<MoneyTask[]> {
  return db.money_tasks.toArray();
}

export async function getMoneyLog(dateKey: string): Promise<MoneyLog | undefined> {
  const safeDate = assertDateISO(dateKey);
  return db.money_logs.where("dateKey").equals(safeDate).first();
}

export async function getOrCreateMoneyLog(dateKey: string): Promise<MoneyLog> {
  const safeDate = assertDateISO(dateKey);
  const existing = await getMoneyLog(safeDate);
  if (existing) return existing;
  const id = await db.money_logs.add({ dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() });
  return { id, dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() };
}

export async function toggleMoneyTaskForDate(dateKey: string, taskId: number): Promise<MoneyLog> {
  const safeDate = assertDateISO(dateKey);
  const log = await getOrCreateMoneyLog(safeDate);
  const exists = log.completedTaskIds.includes(taskId);
  const nextIds = exists ? log.completedTaskIds.filter((id) => id !== taskId) : [...log.completedTaskIds, taskId];
  if (log.id) {
    await db.money_logs.update(log.id, { completedTaskIds: nextIds });
  }
  return { ...log, completedTaskIds: nextIds };
}

export async function updateTx(txId: string, patch: Partial<MoneyTx>): Promise<void> {
  await db.money_tx.update(txId, patch);
}

export async function updateLoan(loanId: string, patch: Partial<MoneyLoan>): Promise<void> {
  await db.money_loans.update(loanId, patch);
}

export async function deleteTx(txId: string): Promise<void> {
  const tx = await db.money_tx.get(txId);
  await db.money_tx.delete(txId);
  if (tx?.type === "borrowed" && tx.loanId) {
    await deleteLoan(tx.loanId);
  }
}

export async function deleteLoan(loanId: string): Promise<void> {
  await db.money_loans.delete(loanId);
  const related = await db.money_tx.where("loanId").equals(loanId).toArray();
  await Promise.all(related.map((tx) => db.money_tx.delete(tx.id)));
}

export async function computeDayTotals(dateISO: string) {
  const rows = await listTxByDate(dateISO);
  let spent = 0;
  let income = 0;

  rows.forEach((tx) => {
    if (tx.type === "expense" || tx.type === "repayment") spent += tx.amount;
    if (tx.type === "income" || tx.type === "borrowed") income += tx.amount;
  });

  return {
    spent,
    income,
    net: income - spent,
  };
}

export async function computeMonthTotals(dateISO: string) {
  const rows = await listTxByMonth(dateISO);
  let spent = 0;
  let income = 0;
  let needs = 0;
  let wants = 0;
  const categories: Record<string, number> = {};

  rows.forEach((tx) => {
    if (tx.type === "expense") {
      spent += tx.amount;
      if (tx.bucket === "need") needs += tx.amount;
      if (tx.bucket === "want") wants += tx.amount;
      if (tx.category) {
        categories[tx.category] = (categories[tx.category] ?? 0) + tx.amount;
      }
    }
    if (tx.type === "repayment") {
      spent += tx.amount;
    }
    if (tx.type === "income") {
      income += tx.amount;
    }
    if (tx.type === "borrowed") {
      income += tx.amount;
    }
  });

  return {
    spent,
    income,
    net: income - spent,
    needs,
    wants,
    categories,
  };
}

export async function computeOutstandingBorrowed(): Promise<number> {
  const loans = await db.money_loans.toArray();
  return loans.filter((loan) => loan.status === "unpaid").reduce((sum, loan) => sum + loan.amount, 0);
}

export async function getMoneyStartDate(): Promise<string> {
  const [tx, loans] = await Promise.all([db.money_tx.toArray(), db.money_loans.toArray()]);
  const dates = [
    ...tx.map((item) => item.dateISO).filter((value): value is string => typeof value === "string"),
    ...loans.map((item) => item.dateISO).filter((value): value is string => typeof value === "string"),
  ];
  if (dates.length === 0) return todayISO();
  return dates.reduce((min, value) => (value < min ? value : min), dates[0]);
}

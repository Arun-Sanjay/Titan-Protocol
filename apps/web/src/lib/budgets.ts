import { db, type Budget } from "./db";
import { monthBounds, todayISO } from "./date";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listBudgets(): Promise<Budget[]> {
  return db.budgets.orderBy("category").toArray();
}

export async function addBudget(category: string, monthlyLimit: number): Promise<number> {
  return db.budgets.add({
    category,
    monthlyLimit,
    createdAt: Date.now(),
  });
}

export async function updateBudget(id: number, monthlyLimit: number): Promise<void> {
  await db.budgets.update(id, { monthlyLimit });
}

export async function deleteBudget(id: number): Promise<void> {
  await db.budgets.delete(id);
}

// ---------------------------------------------------------------------------
// Spending per budget
// ---------------------------------------------------------------------------

export type BudgetSpending = {
  budget: Budget;
  spent: number;
  remaining: number;
  percent: number;
};

/**
 * For the current month, calculates how much has been spent per budget category.
 */
export async function getBudgetSpending(): Promise<BudgetSpending[]> {
  const budgets = await listBudgets();
  if (budgets.length === 0) return [];

  const today = todayISO();
  const { start, end } = monthBounds(today);

  // Get all money transactions for this month
  const txs = await db.money_tx.toArray();
  const monthTxs = txs.filter(
    (tx) => tx.dateISO >= start && tx.dateISO < end && tx.type === "expense",
  );

  // Sum spending per category
  const spendingMap = new Map<string, number>();
  for (const tx of monthTxs) {
    const cat = tx.category ?? "Other";
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + tx.amount);
  }

  return budgets.map((budget) => {
    const spent = spendingMap.get(budget.category) ?? 0;
    const remaining = Math.max(0, budget.monthlyLimit - spent);
    const percent =
      budget.monthlyLimit > 0
        ? Math.min(100, Math.round((spent / budget.monthlyLimit) * 100))
        : 0;
    return { budget, spent, remaining, percent };
  });
}

/**
 * Returns total budget limit and total spent for the month.
 */
export async function getBudgetSummary(): Promise<{
  totalLimit: number;
  totalSpent: number;
  percent: number;
}> {
  const items = await getBudgetSpending();
  const totalLimit = items.reduce((sum, i) => sum + i.budget.monthlyLimit, 0);
  const totalSpent = items.reduce((sum, i) => sum + i.spent, 0);
  const percent =
    totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0;
  return { totalLimit, totalSpent, percent };
}

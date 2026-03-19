// Accountant tool type contracts — used by all tool files in this directory.

export interface CreateInvoiceInput {
  userId: string;
  vendorName: string;
  vendorEmail?: string; // Optional vendor email for chase-invoice delivery (ACCT-10)
  amount: number;
  currency?: string;
  dueDate?: string;
  description?: string;
}

export interface InvoiceRow {
  id: string;
  vendor_name: string;
  vendor_email: string | null; // For chase-invoice email delivery (ACCT-10)
  amount: number;
  currency: string;
  due_date: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  description: string | null;
  created_at: string;
  image_url: string | null;
}

export interface RecordTransactionInput {
  userId: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  date?: string;
  category?: string;
  invoiceId?: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string | null;
  description: string | null;
  date: string;
  invoice_id: string | null;
  created_at: string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export interface ParsedReceipt {
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  line_items: Array<{ description: string; amount: number }>;
}

export interface CashflowProjection {
  period: "30d" | "60d" | "90d";
  startingCash: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedBalance: number;
  pendingInvoices: number;
}

export interface PLRow {
  month: string;
  type: string;
  category: string;
  total: number;
}

export interface PLReport {
  months: Array<{
    month: string;
    income: number;
    expenses: number;
    netProfit: number;
    byCategory: Record<string, number>;
  }>;
  receivables: { pending: number; overdue: number; paid: number };
}

export interface InvoiceSummaryRow {
  status: string;
  count: number;
  total: number;
}

export interface BudgetTarget {
  category: string;
  monthly: number;
  annual: number;
}

export interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePct: number;
}

export interface TaxEstimate {
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  effectiveRate: number;
  jurisdiction: string;
  disclaimer: string;
}

export interface AnomalousTransaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  reason: string;
  zScore: number;
}

export interface RunwayForecast {
  cashBalance: number;
  monthlyBurnRate: number;
  monthlyIncome: number;
  netBurn: number;
  runwayMonths: number;
  status: "healthy" | "warning" | "critical";
}

// Classifier output for Accountant request routing
export interface AccountantClassification {
  isInvoiceQuery: boolean;
  isInvoiceCreate: boolean;
  isTransactionRecord: boolean;
  isBankStatementParse: boolean;
  isReceiptParse: boolean;
  isCashflowQuery: boolean;
  isPLQuery: boolean;
  isBudgetQuery: boolean;
  isTaxQuery: boolean;
  isAnomalyQuery: boolean;
  isChaseInvoice: boolean;
  isRunwayQuery: boolean;
  isInvoicePdfGenerate: boolean;
}

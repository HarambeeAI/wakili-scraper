// ACCT-03: Bank statement parsing — CSV via csv-parse, PDF via pdf-parse.
// For scanned PDFs (text.length < 100), returns empty array; caller should fall back to
// multimodal parsing (same path as ACCT-04 parse-receipt).

import { HumanMessage } from "@langchain/core/messages";
import { parse } from "csv-parse/sync";
import { PDFParse } from "pdf-parse";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import type { ParsedTransaction } from "./types.js";

/**
 * Parse a CSV bank statement into structured transactions.
 * Uses LLM to map bank-specific column names to standard fields.
 */
export async function parseBankStatementCSV(
  csvContent: string,
): Promise<ParsedTransaction[]> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) return [];

  const sampleRow = records[0];

  // LLM-assisted column mapping — bank CSV column names vary widely
  const { data: mapping } = await callLLMWithStructuredOutput<{
    dateColumn: string;
    descriptionColumn: string;
    amountColumn: string | null;
    creditColumn: string | null;
    debitColumn: string | null;
  }>(
    [
      new HumanMessage(
        `Map these CSV columns to transaction fields: ${JSON.stringify(Object.keys(sampleRow))}\nSample row: ${JSON.stringify(sampleRow)}`,
      ),
    ],
    '{"dateColumn": "string", "descriptionColumn": "string", "amountColumn": "string or null if separate credit/debit", "creditColumn": "string or null", "debitColumn": "string or null"}',
    { temperature: 0.1 },
  );

  return records.map((row) => {
    let amount: number;
    let type: "income" | "expense";

    if (mapping.creditColumn && mapping.debitColumn) {
      const credit = parseFloat(row[mapping.creditColumn] ?? "0") || 0;
      const debit = parseFloat(row[mapping.debitColumn] ?? "0") || 0;
      // Credits are income (positive), debits are expenses (negative value)
      if (credit > 0) {
        amount = credit;
        type = "income";
      } else {
        amount = debit;
        type = "expense";
      }
    } else {
      const raw = parseFloat(row[mapping.amountColumn ?? ""] ?? "0") || 0;
      amount = Math.abs(raw);
      type = raw >= 0 ? "income" : "expense";
    }

    return {
      date: row[mapping.dateColumn] ?? "",
      description: row[mapping.descriptionColumn] ?? "",
      amount,
      type,
    };
  });
}

/**
 * Parse a PDF bank statement into structured transactions.
 * Uses pdf-parse to extract embedded text; if text is minimal (<100 chars),
 * returns an empty array — caller should fall back to multimodal (ACCT-04 path).
 */
export async function parseBankStatementPDF(
  pdfBuffer: Buffer,
): Promise<ParsedTransaction[]> {
  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  const text = textResult.text;

  // Scanned PDFs have no text layer — signal caller to use multimodal fallback
  if (text.length < 100) {
    return [];
  }

  const { data: result } = await callLLMWithStructuredOutput<{
    transactions: ParsedTransaction[];
  }>(
    [
      new HumanMessage(
        `Extract all transactions from this bank statement text:\n\n${text.slice(0, 15000)}`,
      ),
    ],
    '{"transactions": [{"date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "income or expense"}]}',
    { temperature: 0.1 },
  );

  return result.transactions ?? [];
}

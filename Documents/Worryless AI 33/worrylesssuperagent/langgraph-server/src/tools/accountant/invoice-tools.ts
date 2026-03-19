// ACCT-01: Invoice CRUD — createInvoice and listInvoices
// Queries public.invoices using the shared DB pool from tools/shared/db.ts

import { getPool } from "../shared/db.js";
import type { CreateInvoiceInput, InvoiceRow } from "./types.js";

/**
 * Insert a new invoice into public.invoices.
 * Returns the UUID of the newly created invoice.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.invoices (user_id, vendor_name, amount, currency, due_date, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.userId,
      input.vendorName,
      input.amount,
      input.currency ?? "USD",
      input.dueDate ?? null,
      input.description ?? null,
    ],
  );
  return result.rows[0].id;
}

/**
 * List invoices for a user from public.invoices, ordered by created_at DESC.
 * Optionally filter by status (pending | paid | overdue | cancelled).
 */
export async function listInvoices(
  userId: string,
  status?: string,
): Promise<InvoiceRow[]> {
  const db = getPool();

  if (status) {
    const result = await db.query<InvoiceRow>(
      `SELECT id, vendor_name, vendor_email, amount, currency, due_date, status, description, created_at, image_url
       FROM public.invoices
       WHERE user_id = $1
         AND status = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, status],
    );
    return result.rows;
  }

  const result = await db.query<InvoiceRow>(
    `SELECT id, vendor_name, vendor_email, amount, currency, due_date, status, description, created_at, image_url
     FROM public.invoices
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows;
}

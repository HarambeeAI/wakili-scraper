import { searchStore, putStore } from "../persistence/store.js";
import { buildBusinessContextPrefix } from "./read-memory.js";

// Read all business context entries for a user
export async function readBusinessContext(userId: string): Promise<Record<string, unknown>> {
  const prefix = buildBusinessContextPrefix(userId);
  const items = await searchStore(prefix);
  const context: Record<string, unknown> = {};
  for (const item of items) {
    context[item.key] = item.value;
  }
  return context;
}

// Write a business context entry (e.g., "industry", "business_stage", "company_name")
export async function writeBusinessContext(
  userId: string,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  const prefix = buildBusinessContextPrefix(userId);
  await putStore(prefix, key, value);
}

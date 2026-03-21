/**
 * Heartbeat LLM Response Parser
 *
 * Pure utility: no Deno or browser APIs.
 *
 * Phase 4 — Heartbeat System
 */

export type Severity = 'ok' | 'urgent' | 'headsup' | 'digest';

const VALID_SEVERITIES: Set<string> = new Set(['ok', 'urgent', 'headsup', 'digest']);

/**
 * Strips markdown code fences (```json ... ```) from raw LLM output
 * and returns the trimmed inner content.
 */
export function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * Parses a severity value and optional finding from a JSON string.
 * Fail-safe: returns { severity: 'ok', finding: '' } on ANY parse failure,
 * missing severity field, or unrecognised severity value.
 */
export function parseSeverity(jsonString: string): { severity: Severity; finding: string } {
  const FALLBACK = { severity: 'ok' as Severity, finding: '' };
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    const sev = parsed?.severity;
    if (typeof sev !== 'string' || !VALID_SEVERITIES.has(sev)) {
      return FALLBACK;
    }
    return {
      severity: sev as Severity,
      finding: typeof parsed.finding === 'string' ? parsed.finding : '',
    };
  } catch {
    return FALLBACK;
  }
}

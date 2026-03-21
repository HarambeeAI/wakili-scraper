/**
 * Workspace Content Sanitization
 *
 * Strips known prompt injection patterns from user-authored workspace content.
 * Apply BEFORE storing to database AND before injecting into any LLM system prompt.
 *
 * SEC-03: Phase 1 — Database Foundation
 * Used by: Phase 3 workspace editor save, Phase 4 heartbeat runner
 */

export function sanitizeWorkspaceContent(content: string): string {
  const injectionPatterns: RegExp[] = [
    /ignore\s+(?:all\s+)?previous\s+instructions?/gi,
    /ignore\s+all\s+prior\s+instructions?/gi,
    /<\s*system\s*>/gi,
    /<\/\s*system\s*>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /###\s*(?:instruction|system)/gi,
    /assistant:\s*you\s+are\s+now/gi,
    /you\s+are\s+now\s+(?:a\s+)?(?:different|new|another)\s+(?:ai|assistant|model)/gi,
    /disregard\s+(?:all\s+)?(?:previous|prior|earlier)\s+(?:instructions?|prompts?|context)/gi,
  ];

  let sanitized = content;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }
  return sanitized.trim();
}

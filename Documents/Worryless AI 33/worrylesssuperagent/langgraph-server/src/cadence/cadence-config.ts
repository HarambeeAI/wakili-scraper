/**
 * cadence-config.ts — Re-exports cadence configuration from heartbeat-prompts
 *
 * The DEFAULT_CADENCE_CONFIG lives in heartbeat-prompts.ts alongside the prompt
 * library. This module re-exports it for import convenience and adds type aliases.
 */

export { DEFAULT_CADENCE_CONFIG } from "./heartbeat-prompts.js";
export type { CadenceTier } from "./heartbeat-prompts.js";

export type CadenceConfig = {
  daily_enabled: boolean;
  weekly_enabled: boolean;
  monthly_enabled: boolean;
  quarterly_enabled: boolean;
  event_triggers_enabled: boolean;
  event_cooldown_hours: number;
};

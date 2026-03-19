/**
 * cadence-config.test.ts — CAD-08 requirement validation
 *
 * Verifies that DEFAULT_CADENCE_CONFIG has exactly 6 keys with the correct
 * names, types, and default values — mirroring the SQL migration DEFAULT JSONB.
 *
 * This is the CAD-08 requirement: users can adjust cadence frequency, and the
 * defaults are sane (daily + weekly enabled, monthly + quarterly off, event
 * cooldown of 4 hours).
 *
 * The TypeScript constant must match the SQL migration default JSONB exactly:
 *
 * SQL default:
 * '{
 *   "daily_enabled": true,
 *   "weekly_enabled": true,
 *   "monthly_enabled": false,
 *   "quarterly_enabled": false,
 *   "event_triggers_enabled": true,
 *   "event_cooldown_hours": 4
 * }'::jsonb
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_CADENCE_CONFIG } from "./heartbeat-prompts.js";

describe("DEFAULT_CADENCE_CONFIG (CAD-08)", () => {
  // ── Key count ───────────────────────────────────────────────────────────────

  it("has exactly 6 keys", () => {
    expect(Object.keys(DEFAULT_CADENCE_CONFIG)).toHaveLength(6);
  });

  // ── Key presence ────────────────────────────────────────────────────────────

  it("has daily_enabled key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("daily_enabled");
  });

  it("has weekly_enabled key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("weekly_enabled");
  });

  it("has monthly_enabled key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("monthly_enabled");
  });

  it("has quarterly_enabled key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("quarterly_enabled");
  });

  it("has event_triggers_enabled key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("event_triggers_enabled");
  });

  it("has event_cooldown_hours key", () => {
    expect(DEFAULT_CADENCE_CONFIG).toHaveProperty("event_cooldown_hours");
  });

  // ── Default values ──────────────────────────────────────────────────────────

  it("daily_enabled defaults to true", () => {
    expect(DEFAULT_CADENCE_CONFIG.daily_enabled).toBe(true);
  });

  it("weekly_enabled defaults to true", () => {
    expect(DEFAULT_CADENCE_CONFIG.weekly_enabled).toBe(true);
  });

  it("monthly_enabled defaults to false", () => {
    expect(DEFAULT_CADENCE_CONFIG.monthly_enabled).toBe(false);
  });

  it("quarterly_enabled defaults to false", () => {
    expect(DEFAULT_CADENCE_CONFIG.quarterly_enabled).toBe(false);
  });

  it("event_triggers_enabled defaults to true", () => {
    expect(DEFAULT_CADENCE_CONFIG.event_triggers_enabled).toBe(true);
  });

  it("event_cooldown_hours defaults to 4", () => {
    expect(DEFAULT_CADENCE_CONFIG.event_cooldown_hours).toBe(4);
  });

  // ── Type correctness ────────────────────────────────────────────────────────

  it("daily_enabled is a boolean", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.daily_enabled).toBe("boolean");
  });

  it("weekly_enabled is a boolean", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.weekly_enabled).toBe("boolean");
  });

  it("monthly_enabled is a boolean", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.monthly_enabled).toBe("boolean");
  });

  it("quarterly_enabled is a boolean", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.quarterly_enabled).toBe("boolean");
  });

  it("event_triggers_enabled is a boolean", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.event_triggers_enabled).toBe("boolean");
  });

  it("event_cooldown_hours is a number", () => {
    expect(typeof DEFAULT_CADENCE_CONFIG.event_cooldown_hours).toBe("number");
  });

  // ── SQL migration alignment ─────────────────────────────────────────────────
  // Verifies the exact shape and values match the SQL DEFAULT JSONB

  it("matches the SQL migration DEFAULT JSONB exactly", () => {
    const expectedSQLDefault = {
      daily_enabled: true,
      weekly_enabled: true,
      monthly_enabled: false,
      quarterly_enabled: false,
      event_triggers_enabled: true,
      event_cooldown_hours: 4,
    };
    expect(DEFAULT_CADENCE_CONFIG).toEqual(expectedSQLDefault);
  });
});

---
phase: 1
slug: database-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Supabase SQL migrations (self-verifying via constraints + triggers) |
| **Config file** | `supabase/migrations/` |
| **Quick run command** | `supabase db reset --local` (local only) |
| **Full suite command** | Manual SQL verification queries (see Per-Task map) |
| **Estimated runtime** | ~30 seconds per migration apply |

---

## Sampling Rate

- **After every migration file:** Verify table exists, constraints hold, RLS active via psql or Supabase Studio
- **After trigger migration:** Insert a test `user_agents` row and confirm 6 `agent_workspaces` rows created
- **After seed migration:** Count rows in `available_agent_types` — expect 13
- **Before `/gsd:verify-work`:** All 5 success criteria from ROADMAP.md Phase 1 must be manually verified

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-01-01 | 01 | 1 | DB-01 | manual-sql | `SELECT count(*) FROM available_agent_types` → 13 | ⬜ pending |
| 1-01-02 | 01 | 1 | DB-02 | manual-sql | `SELECT count(*) FROM user_agents WHERE user_id = '<test>'` | ⬜ pending |
| 1-01-03 | 01 | 1 | DB-03 | manual-sql | `SELECT count(*) FROM agent_workspaces WHERE user_agent_id = '<id>'` → 6 | ⬜ pending |
| 1-01-04 | 01 | 1 | DB-04 | manual-sql | Trigger: insert user_agents row → confirm 6 workspace rows auto-created | ⬜ pending |
| 1-01-05 | 01 | 1 | DB-05 | manual-sql | `SELECT count(*) FROM agent_heartbeat_log` → 0 initially | ⬜ pending |
| 1-01-06 | 01 | 1 | DB-06 | manual-sql | Duplicate insert into user_agents → expect unique constraint violation | ⬜ pending |
| 1-01-07 | 01 | 1 | DB-07 | manual-sql | `SELECT timezone FROM profiles LIMIT 1` → non-null default value | ⬜ pending |
| 1-02-01 | 02 | 1 | DB-01..DB-06 | manual-sql | RLS: cross-user query returns 0 rows on all 4 new tables | ⬜ pending |
| 1-03-01 | 03 | 1 | SEC-01 | manual | JWT verification in planning-agent — no userId from body | ⬜ pending |
| 1-03-02 | 03 | 1 | SEC-02 | manual | Heartbeat dispatcher uses service-role, not caller body | ⬜ pending |
| 1-03-03 | 03 | 1 | SEC-03 | manual | Workspace content sanitization strips injection patterns | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test framework needed — validation is SQL-based for this phase
- [ ] All migration files follow naming convention `YYYYMMDDHHMMSS_description.sql`

*Existing Supabase migration infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trigger auto-creates 6 workspace rows | DB-04 | No test runner in Supabase migrations | Insert a user_agents row via Supabase Studio; check agent_workspaces for 6 rows |
| Unique constraint rejects duplicate | DB-06 | Constraint violation requires manual insert attempt | Run `INSERT INTO user_agents (user_id, agent_type) VALUES (same, same)` twice |
| RLS cross-user isolation | DB-02..05 | Requires two user sessions | Query tables as User A using User B's row IDs — expect empty result |
| JWT verification in edge functions | SEC-01 | Requires live Supabase deployment | Call edge function without Authorization header — expect 401 |
| Workspace sanitization | SEC-03 | Requires runtime test of sanitization logic | Submit workspace content with `IGNORE PREVIOUS INSTRUCTIONS` — verify stripped on save |

---

## Validation Sign-Off

- [ ] All tasks have SQL verification or manual test instructions
- [ ] No tasks without a verification path
- [ ] Migration files follow existing naming convention
- [ ] All 4 new tables have RLS policies confirmed
- [ ] Seed data count verified (13 rows in available_agent_types)
- [ ] `nyquist_compliant: true` set in frontmatter when all above pass

**Approval:** pending

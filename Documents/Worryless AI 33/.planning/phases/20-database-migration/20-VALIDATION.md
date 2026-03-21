---
phase: 20
slug: database-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | psql (PostgreSQL CLI) + bash verification scripts |
| **Config file** | none — direct psql commands against Railway Postgres |
| **Quick run command** | `psql $DATABASE_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"` |
| **Full suite command** | `psql $DATABASE_URL -f verify_migration.sql` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick table count check
- **After every plan wave:** Run full verification SQL
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | DB-01 | script | `grep -c 'auth\.\|pgmq\.\|cron\.\|vault\.' RAILWAY_MIGRATION.sql` returns 0 | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | DB-02 | script | `grep -c 'CREATE TABLE.*public\.' RAILWAY_MIGRATION.sql` >= 20 | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | DB-03 | script | `grep 'CREATE SCHEMA.*langgraph' RAILWAY_MIGRATION.sql` succeeds | ❌ W0 | ⬜ pending |
| 20-01-04 | 01 | 1 | DB-04 | script | `grep 'CREATE EXTENSION.*vector' RAILWAY_MIGRATION.sql` succeeds | ❌ W0 | ⬜ pending |
| 20-01-05 | 01 | 1 | DB-05 | script | `grep 'public.users' RAILWAY_MIGRATION.sql` succeeds AND no `auth.users` FK refs | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | DB-01 | psql | `psql $DATABASE_URL -c "\dt public.*"` lists 20+ tables | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 2 | DB-03 | psql | `psql $DATABASE_URL -c "\dt langgraph.*"` lists checkpoints, checkpoint_writes, store | ❌ W0 | ⬜ pending |
| 20-02-03 | 02 | 2 | DB-04 | psql | `psql $DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname='vector'"` returns 1 row | ❌ W0 | ⬜ pending |
| 20-02-04 | 02 | 2 | DB-05 | psql | `psql $DATABASE_URL -c "\d profiles"` shows `public.users` FK, no `auth.users` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `RAILWAY_MIGRATION.sql` — the consolidated migration file (created by plan 20-01)
- [ ] Verification queries embedded in plan acceptance criteria

*Existing infrastructure covers all phase requirements via psql commands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pgvector index performance | DB-04 | Requires data load | Insert 100 test embeddings, run similarity query, confirm results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

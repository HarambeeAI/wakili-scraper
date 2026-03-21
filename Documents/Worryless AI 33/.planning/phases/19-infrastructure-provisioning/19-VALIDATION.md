---
phase: 19
slug: infrastructure-provisioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual infrastructure smoke testing via MCP tools + SQL client |
| **Config file** | none — no application code in this phase |
| **Quick run command** | `list-variables` + `get-logs` via Railway MCP |
| **Full suite command** | All 5 success criteria manually verified |
| **Estimated runtime** | ~60 seconds (manual checks) |

---

## Sampling Rate

- **After every task commit:** Verify via `get-logs` MCP tool on affected service
- **After every plan wave:** Full log review via `get-logs` on all three services
- **Before `/gsd:verify-work`:** All 5 success criteria manually verified
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | RAIL-01 | smoke | `psql $DATABASE_PUBLIC_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"` | N/A | ⬜ pending |
| 19-01-02 | 01 | 1 | RAIL-02 | smoke | `list-variables` on Redis service — verify `REDIS_PRIVATE_URL` exists | N/A | ⬜ pending |
| 19-02-01 | 02 | 2 | RAIL-03 | smoke | Browse `https://<logto-domain>` — admin console loads | N/A | ⬜ pending |
| 19-03-01 | 03 | 2 | ENV-01, ENV-02 | smoke | `list-variables` — all API keys present | N/A | ⬜ pending |
| 19-03-02 | 03 | 2 | ENV-03, ENV-04, RAIL-07 | smoke | `list-variables` — reference vars use `${{...}}` syntax | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no application code to test.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pgvector extension enabled | RAIL-01 | Infrastructure — requires SQL connection | Connect to Postgres via TCP proxy, run `SELECT * FROM pg_extension WHERE extname = 'vector';` |
| Redis reachable on private network | RAIL-02 | Infrastructure — check logs | Use `get-logs` on Redis service, verify ready state |
| Logto admin console accessible | RAIL-03 | UI configuration | Browse to Logto admin domain, verify page loads, enable email/password sign-in |
| Private networking resolves | RAIL-07 | Infrastructure — check Logto logs | Use `get-logs` on Logto, verify DB connection over `*.railway.internal` |
| API keys set correctly | ENV-01 | Config check | Use `list-variables` on target service, verify all keys present |
| VAPID keys stored | ENV-02 | Config check | Use `list-variables`, verify `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` exist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

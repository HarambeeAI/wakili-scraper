---
phase: 25
slug: production-cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (api-server + frontend), manual smoke tests |
| **Config file** | `api-server/vitest.config.ts`, `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd api-server && npm test` |
| **Full suite command** | `cd api-server && npm test && cd ../worrylesssuperagent && npm test` |
| **Estimated runtime** | ~30 seconds (unit tests); smoke test is manual |

---

## Sampling Rate

- **After every task commit:** Run `cd api-server && npm test`
- **After every plan wave:** Run `cd api-server && npm test && cd ../worrylesssuperagent && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + smoke test checklist complete
- **Max feedback latency:** 30 seconds (unit tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | RAIL-08 | code fix | `cd api-server && npm test` | N/A | pending |
| 25-01-02 | 01 | 1 | RAIL-08 | code fix | `cd worrylesssuperagent && npm test` | N/A | pending |
| 25-01-03 | 01 | 1 | RAIL-08 | manual | `curl https://<domain>/health` | N/A | pending |
| 25-01-04 | 01 | 1 | RAIL-08 | manual | Browser walkthrough | N/A | pending |
| 25-01-05 | 01 | 1 | RAIL-08 | manual | Observe logs + dashboard | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway domains reachable | RAIL-08 | Infrastructure config — no unit test can verify | curl each service health endpoint |
| First-time user registration + onboarding | RAIL-08 | Requires live Railway environment with Logto | Browser walkthrough: register, onboard, chat with CoS |
| Heartbeat fires and surfaces insight | RAIL-08 | Requires active agent + Redis + cadence timer | Enable cadence, wait 10 min, check dashboard |
| Image generation via Gemini Imagen 3 | RAIL-08 | Requires GEMINI_API_KEY in production | Request Marketer to create image, verify render |
| Email sending via Resend | RAIL-08 | Requires RESEND_API_KEY in production | Trigger test email, verify inbox delivery |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 19-infrastructure-provisioning
plan: 03
status: complete
started: 2026-03-21T08:16:00Z
completed: 2026-03-21T08:25:00Z
---

## Summary

Generated VAPID keys, stored all 8 external API keys on the Logto Auth service as a temporary holder, validated Logto-to-Postgres private networking, and documented the exact reference variable patterns for downstream phases 22-24.

## What Was Built

### API Keys Stored (on Logto Auth service — temporary holder)
All keys stored as Railway service variables. Will be migrated to target services when created:

| Key | Target Service (Phase) |
|-----|----------------------|
| GEMINI_API_KEY | API Server (22), LangGraph Server (23) |
| FIRECRAWL_API_KEY | API Server (22) |
| APIFY_API_TOKEN | API Server (22) |
| RESEND_API_KEY | API Server (22) |
| GOOGLE_CLIENT_ID | API Server (22), LangGraph Server (23) |
| GOOGLE_CLIENT_SECRET | API Server (22), LangGraph Server (23) |
| VAPID_PUBLIC_KEY | API Server (22), Frontend (24 as VITE_VAPID_PUBLIC_KEY) |
| VAPID_PRIVATE_KEY | API Server (22) |

### VAPID Keys
- Public: `BKHhEVzAhwbBQ-nUIW3Ly6yXNBPcw9fh-zyZqosWoMraABD0XqL4lY7vKlY2hUj40mBQUHk2-7pKkLlorZlN0Wk`
- Private: stored as Railway variable (not logged)

## Reference Variable Patterns for Downstream Phases

**IMPORTANT: Use exact service names below in `${{}}` syntax.**

### For API Server (Phase 22)
```
DATABASE_URL=${{pgvector.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
LOGTO_ENDPOINT=https://${{Logto Auth.RAILWAY_PUBLIC_DOMAIN}}
GEMINI_API_KEY=${{Logto Auth.GEMINI_API_KEY}}
FIRECRAWL_API_KEY=${{Logto Auth.FIRECRAWL_API_KEY}}
APIFY_API_TOKEN=${{Logto Auth.APIFY_API_TOKEN}}
RESEND_API_KEY=${{Logto Auth.RESEND_API_KEY}}
GOOGLE_CLIENT_ID=${{Logto Auth.GOOGLE_CLIENT_ID}}
GOOGLE_CLIENT_SECRET=${{Logto Auth.GOOGLE_CLIENT_SECRET}}
VAPID_PUBLIC_KEY=${{Logto Auth.VAPID_PUBLIC_KEY}}
VAPID_PRIVATE_KEY=${{Logto Auth.VAPID_PRIVATE_KEY}}
```

### For LangGraph Server (Phase 23)
```
DATABASE_URL=${{pgvector.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_API_KEY=${{Logto Auth.GEMINI_API_KEY}}
GOOGLE_CLIENT_ID=${{Logto Auth.GOOGLE_CLIENT_ID}}
GOOGLE_CLIENT_SECRET=${{Logto Auth.GOOGLE_CLIENT_SECRET}}
```

### For Frontend (Phase 24)
```
VITE_LOGTO_ENDPOINT=https://${{Logto Auth.RAILWAY_PUBLIC_DOMAIN}}
VITE_VAPID_PUBLIC_KEY=${{Logto Auth.VAPID_PUBLIC_KEY}}
```

## Service Inventory (Complete)

| Service | Private Domain | Public Domain | Key Variables |
|---------|---------------|---------------|---------------|
| pgvector | pgvector.railway.internal:5432 | caboose.proxy.rlwy.net:39084 | DATABASE_URL, PGUSER, PGPASSWORD |
| Redis | redis.railway.internal:6379 | caboose.proxy.rlwy.net:43680 | REDIS_URL, REDIS_PUBLIC_URL |
| Logto Auth | logto-auth.railway.internal | logto-auth-production-f2e1.up.railway.app | ENDPOINT, DB_URL, all API keys |
| Logto Admin Console | logto-admin-console.railway.internal | logto-admin-console-production-4d63.up.railway.app | ADMIN_ENDPOINT |
| Postgres | (template artifact — DELETE) | — | — |
| Redis-inz3 | (template artifact — DELETE) | — | — |

## Private Networking Validation (RAIL-07)

- ✓ Logto Auth → pgvector: Connected via `pgvector.railway.internal:5432/logto` (confirmed via logs — no ECONNREFUSED)
- ✓ Logto Auth → Redis: Connected via `redis.railway.internal:6379` (confirmed: "Connected to Redis" in logs)
- ✓ DATABASE_URL on pgvector uses `railway.internal` hostname
- ✓ REDIS_URL on Redis uses `railway.internal` hostname
- ○ Full mesh (API Server, LangGraph, Frontend) to be verified in phases 22-24

## Deviations

- Redis service uses `REDIS_URL` (not `REDIS_PRIVATE_URL` as some plans reference). Downstream phases should use `${{Redis.REDIS_URL}}` for the private networking URL.
- Service names contain spaces ("Logto Auth", "Logto Admin Console") — Railway CLI requires proper quoting. Reference variables use exact names: `${{Logto Auth.VARIABLE_NAME}}`.

## key-files

### created
- 8 Railway service variables on Logto Auth (API keys + VAPID keys)

### modified
- None (infrastructure-only, no code files)

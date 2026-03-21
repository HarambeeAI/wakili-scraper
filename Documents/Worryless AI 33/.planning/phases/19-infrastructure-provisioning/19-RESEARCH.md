# Phase 19: Infrastructure Provisioning - Research

**Researched:** 2026-03-21
**Domain:** Railway platform provisioning — PostgreSQL + pgvector, Redis, Logto Auth, private networking, environment variables
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAIL-01 | PostgreSQL service provisioned on Railway with pgvector extension enabled | pgvector-18-trixie template deploys Docker image `pgvector/pgvector:pg18-trixie`; extension enabled via `CREATE EXTENSION IF NOT EXISTS vector;` after deploy |
| RAIL-02 | Redis service provisioned on Railway for BullMQ job queue | Railway Redis template provides `REDIS_URL`, `REDIS_PRIVATE_URL`; connect over private network with `family: 0` for dual-stack DNS |
| RAIL-03 | Logto Auth service deployed on Railway with dedicated PostgreSQL for identity data | Logto uses its own database name within the shared Postgres instance (different `db_name` in connection string, not a Postgres schema) — ports 3001 (auth) and 3002 (admin) |
| RAIL-07 | All services connected via Railway private networking (`service.railway.internal:PORT`) | Zero-config WireGuard mesh; every service gets `<service-name>.railway.internal`; new environments (post Oct 16 2025) support both IPv4 + IPv6 |
| ENV-01 | All API keys configured as Railway service variables | `set-variables` MCP tool accepts `["KEY=value", ...]` array; target specific service via `service` parameter |
| ENV-02 | VAPID keys generated and configured for push notifications | `web-push` npm package: `webpush.generateVAPIDKeys()` produces `{ publicKey, privateKey }` — run once, store as Railway variables |
| ENV-03 | DATABASE_URL using Railway internal networking for all services | Reference var: `DATABASE_URL=${{Postgres.DATABASE_URL}}` resolves to private hostname; Railway auto-provides `DATABASE_URL` on private domain |
| ENV-04 | Railway reference variables used for inter-service URLs | Syntax: `${{SERVICE_NAME.VAR_NAME}}`; e.g., `API_URL=https://${{api-server.RAILWAY_PUBLIC_DOMAIN}}` |
</phase_requirements>

---

## Summary

Phase 19 provisions the Railway infrastructure layer before any application code is written. The three tasks map cleanly to three provisioning operations: (1) deploy a pgvector-enabled Postgres service using Railway's `pgvector-18-trixie` template, (2) deploy Logto auth on Docker pointing at a dedicated database within the same Postgres instance, and (3) wire all services together via Railway reference variables and private networking.

Railway's MCP server (`railway-mcp-server`) provides all the tools needed to complete this phase without touching the Railway dashboard. The critical sequencing constraint is that Postgres must be provisioned and its `DATABASE_URL` reference variable must exist before Logto can be deployed — Logto needs `DB_URL` pointing at a freshly seeded database. Redis can be provisioned at any point alongside Postgres. Private networking is zero-config on Railway; services in the same project/environment automatically resolve each other at `<service-name>.railway.internal`.

The most important pitfall for this phase is Logto's database naming: Logto uses its own database (e.g., `logto` as the database name in the connection string) within the shared Postgres server — not a Postgres schema. Passing `DB_URL=.../<db_name>` where `<db_name>` differs from `railway` is sufficient for isolation. A second critical pitfall is Redis connectivity: the `ioredis` driver (used by BullMQ) must have `family: 0` set or the `?family=0` suffix on `REDIS_URL` to support dual-stack DNS in Railway's private network.

**Primary recommendation:** Provision in order — Postgres first (template deploy), Redis second (template deploy), Logto third (Docker deploy pointing at Postgres `logto` database). Then configure all reference variables and external API keys in a single `set-variables` pass. Verify connectivity by checking logs with `get-logs` before marking the phase complete.

---

## Standard Stack

### Core

| Service | Version/Image | Purpose | Why Standard |
|---------|--------------|---------|--------------|
| PostgreSQL + pgvector | `pgvector/pgvector:pg18-trixie` | Application database + vector embeddings | Railway's `pgvector-18-trixie` template; PG 18 with pgvector pre-installed |
| Redis | Railway managed Redis (Redis 7+) | BullMQ job queue | Railway's official Redis template; provides `REDIS_URL` + `REDIS_PRIVATE_URL` automatically |
| Logto | `logto/logto:latest` (Docker) | Auth — email/password + JWT | Self-hosted OSS; replaces Supabase Auth; Railway deploy template available |

### Supporting Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `web-push` npm | latest | VAPID key generation | Run once locally or as a one-shot script before setting variables |
| Railway MCP server | latest | Provisioning via AI tools | All provisioning operations in this phase |
| Railway CLI | latest | Required by MCP server | Installed on machine running MCP server |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared Postgres for Logto | Separate Railway Postgres service for Logto | Separate service costs more; shared instance with different `db_name` is sufficient for isolation |
| `pgvector-18-trixie` template | `pgvector-latest` template | `-18-trixie` is more explicit about PG version; existing codebase was built on PG + pgvector — same extension API |

---

## Architecture Patterns

### Service Topology

```
Railway Project (production environment)
├── Postgres           [pgvector-18-trixie template]
│   ├── database: railway   ← application data
│   └── database: logto     ← Logto identity data (separate db_name, same server)
├── Redis              [Redis template]
│   └── REDIS_PRIVATE_URL → consumed by LangGraph server (phase 23)
├── Logto              [Docker: logto/logto:latest]
│   ├── port 3001: auth endpoint   ← public domain
│   └── port 3002: admin console  ← public domain
```

### Pattern 1: Railway Template Deploy via MCP

**What:** Use `deploy-template` MCP tool to provision Postgres and Redis from Railway's template library. Templates handle Docker image selection, volume setup, and environment variable generation automatically.

**When to use:** Any Railway-managed database service. Faster than manual Docker config because Railway handles persistence, networking, and variable injection.

**Key template identifiers:**
- pgvector 18 trixie: `https://railway.com/deploy/pgvector-18-trixie`
- Redis: `https://railway.com/deploy/redis-maintained`
- Logto: `https://railway.com/deploy/logto`

### Pattern 2: Logto with Dedicated Database on Shared Postgres

**What:** Logto's `DB_URL` points to a separate database name (`logto`) on the same Postgres server that holds application data. This is database-level isolation (different database name in connection string) — NOT Postgres schema isolation.

**Example DB_URL for Logto:**
```
# Application services use:
DATABASE_URL = ${{Postgres.DATABASE_URL}}
# Which resolves to: postgresql://postgres:<pw>@postgres.railway.internal:5432/railway

# Logto uses a DIFFERENT database on the same server:
DB_URL = postgresql://postgres:<pw>@postgres.railway.internal:5432/logto
```

**Note:** Logto runs its own database seeding (`logto db seed`) via its startup command. The `logto` database must be created before Logto starts. This can be done by:
1. Connecting to Postgres via TCP proxy after deploy
2. Running `CREATE DATABASE logto;`
3. Then starting Logto with the correct `DB_URL`

Alternatively, use Railway's Logto template which bundles its own Postgres — but the project decision is to share the Postgres instance. Use the shared Postgres approach with the `logto` database created manually.

### Pattern 3: Railway Reference Variables for Inter-Service URLs

**What:** Variables in one service that reference values from another service using `${{SERVICE_NAME.VAR}}` syntax. These are resolved dynamically at deploy time.

**Example configuration (API Server in later phases):**
```
# In api-server service variables:
DATABASE_URL    = ${{Postgres.DATABASE_URL}}
REDIS_URL       = ${{Redis.REDIS_PRIVATE_URL}}
LOGTO_ENDPOINT  = https://${{Logto.RAILWAY_PUBLIC_DOMAIN}}
```

**In this phase, set on Logto service:**
```
DB_URL              = postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/logto
ENDPOINT            = https://${{RAILWAY_PUBLIC_DOMAIN}}
ADMIN_ENDPOINT      = https://${{RAILWAY_PUBLIC_DOMAIN}}
TRUST_PROXY_HEADER  = 1
ADMIN_DISABLE_LOCALHOST = 1
PORT                = 3001
ADMIN_PORT          = 3002
```

### Pattern 4: Private Networking (Zero Configuration)

**What:** All services within the same Railway project/environment automatically join a WireGuard mesh network. No ports need to be opened; services just use `<service-name>.railway.internal:PORT` as hostname.

**Important:** Railway service names in the dashboard become the subdomain. A service named `Postgres` is reachable at `postgres.railway.internal:5432`. Use lowercase in connection strings.

**New environments (post October 16, 2025):** DNS resolves both A (IPv4) and AAAA (IPv6) records. No special configuration needed.

**Internal communication rule:** Use `http://` not `https://` when calling services over private network — WireGuard already encrypts the tunnel.

### Pattern 5: Redis Connection for BullMQ (Critical)

**What:** BullMQ uses `ioredis` which by default only does IPv4 A-record lookups. Even in new Railway environments, always set `family: 0` to enable dual-stack lookup.

**Required BullMQ connection config (used in Phase 23):**
```typescript
// Source: Railway docs / ioredis troubleshooting
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_PRIVATE_URL + '?family=0', {
  maxRetriesPerRequest: null,  // REQUIRED for BullMQ
  tls: {},                      // REQUIRED for Railway Redis TLS
});

const queue = new Queue('heartbeat', { connection });
```

**Note for this phase:** Don't configure BullMQ yet (that's Phase 23). But confirm Redis is reachable by checking `get-logs` after deploy and noting the `REDIS_PRIVATE_URL` variable value.

### Anti-Patterns to Avoid

- **Hardcoding Postgres connection strings:** Always use Railway reference variables — Railway may rotate passwords or change hostnames.
- **Using `REDIS_URL` (public) instead of `REDIS_PRIVATE_URL` (private):** Internal services must use `REDIS_PRIVATE_URL` to avoid network egress costs and TCP proxy dependency.
- **Skipping `CREATE DATABASE logto;`:** Logto's startup seeding will fail if the target database doesn't exist. The `logto db seed` command does not create the database itself.
- **Setting Logto's `ADMIN_DISABLE_LOCALHOST` without generating a domain first:** Logto admin console becomes unreachable if localhost is disabled before a public domain is assigned.
- **Not generating a Railway domain for Logto before disabling localhost admin:** Use `generate-domain` MCP tool for both auth (3001) and admin (3002) ports before setting `ADMIN_DISABLE_LOCALHOST=1`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| pgvector Postgres | Custom Dockerfile with pgvector | `pgvector-18-trixie` Railway template | Template handles version pinning, volume persistence, SSL termination, TCP proxy |
| Redis provisioning | Docker run Redis manually | Railway Redis template | Template provides managed backups, `REDIS_URL`/`REDIS_PRIVATE_URL` auto-inject |
| VAPID key generation | Custom crypto code | `webpush.generateVAPIDKeys()` | Industry-standard ECDH key generation; takes 3 lines |
| Inter-service URL injection | Hardcoded URLs | Railway reference variables `${{service.VAR}}` | Dynamic resolution; survives domain regeneration; autocomplete in dashboard |
| Auth infrastructure | Custom JWT issuer | Logto | OIDC-compliant, handles email/password, Google OAuth, session management |

**Key insight:** Railway's template marketplace handles >90% of infrastructure boilerplate. Every manual Dockerfile or custom configuration for standard services (Postgres, Redis) is unnecessary complexity that Railway already solved.

---

## Common Pitfalls

### Pitfall 1: Logto Database Does Not Exist

**What goes wrong:** Logto startup fails with "database does not exist" or connection refused when `DB_URL` points to `.../<db_name>` where `<db_name>` has not been created in the Postgres server.

**Why it happens:** Logto's seeding command (`logto db seed`) runs migrations inside an existing database — it does not create the database itself. PostgreSQL requires `CREATE DATABASE` to be run first.

**How to avoid:** After Postgres is running, connect via TCP proxy (use `DATABASE_PUBLIC_URL`) and run:
```sql
CREATE DATABASE logto;
```
Then deploy Logto with the correct `DB_URL`.

**Warning signs:** Logto container restarts in a crash loop; logs show `database "logto" does not exist` or ECONNREFUSED.

### Pitfall 2: Redis ENOTFOUND via ioredis / BullMQ

**What goes wrong:** Application gets `ENOTFOUND redis.railway.internal` even though Redis is deployed and running.

**Why it happens:** `ioredis` defaults to IPv4 A-record lookup only. In Railway environments created before October 16, 2025, only AAAA (IPv6) records exist. In newer environments both exist, but ioredis default behavior can still cause issues.

**How to avoid:** Always append `?family=0` to the Redis URL or set `family: 0` in the IORedis connection options. This enables dual-stack lookup.

**Warning signs:** BullMQ queues cannot connect; `ENOTFOUND` in service logs; timeout errors from Redis client.

### Pitfall 3: Logto Admin Console Inaccessible After Domain Lock

**What goes wrong:** Setting `ADMIN_DISABLE_LOCALHOST=1` locks the admin console to HTTPS domain only. If no domain has been generated for port 3002, the admin console is completely inaccessible.

**Why it happens:** The variable is set before `generate-domain` is called for port 3002.

**How to avoid:** Always generate Railway domains for BOTH port 3001 (auth) and port 3002 (admin) before setting `ADMIN_DISABLE_LOCALHOST=1`. The `generate-domain` MCP tool must be called twice — once per port.

**Warning signs:** Admin console returns 502/404 after deploy; no way to configure sign-in methods.

### Pitfall 4: Reference Variable Not Resolved at Plan Time

**What goes wrong:** `${{Postgres.DATABASE_URL}}` shows literally in logs instead of the resolved value.

**Why it happens:** Reference variables are only resolved when the service is deployed/redeployed. Setting a variable via `set-variables` does not automatically trigger a redeploy.

**How to avoid:** After `set-variables`, trigger a deploy with the `deploy` MCP tool or manually redeploy the service in Railway dashboard.

**Warning signs:** Service logs show literal `${{...}}` strings; connection refused on database.

### Pitfall 5: pgvector Extension Not Enabled

**What goes wrong:** Queries using `<->` operator or `embedding vector(1536)` column type fail with "type vector does not exist".

**Why it happens:** The `pgvector-18-trixie` template installs the pgvector binary but does NOT run `CREATE EXTENSION vector` automatically. The extension must be enabled per-database.

**How to avoid:** After Postgres is running, connect and run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Verify with: `SELECT * FROM pg_extension WHERE extname = 'vector';`

**Warning signs:** Phase 20 (database migration) fails on vector column creation; `type "vector" does not exist` errors.

---

## Code Examples

Verified patterns from official sources and Railway documentation:

### Generating VAPID Keys (run once locally)

```bash
# Source: web-push npm package (github.com/web-push-libs/web-push)
npx web-push generate-vapid-keys --json
# Output:
# {
#   "publicKey": "BNbO...",
#   "privateKey": "abc..."
# }
```

### Verifying pgvector Extension

```sql
-- Run after Postgres deploy, before Phase 20 begins
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Expected: one row with extname = 'vector'
```

### Creating Logto Database on Shared Postgres

```sql
-- Connect via DATABASE_PUBLIC_URL after Postgres deploy
CREATE DATABASE logto;
-- Then set Logto's DB_URL:
-- postgresql://<user>:<password>@<host>:<port>/logto
```

### Logto Service Variables (complete set for Railway)

```
# Source: docs.logto.io/concepts/core-service/configuration + railway.com/deploy/logto
DB_URL                  = postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/logto
ENDPOINT                = https://${{RAILWAY_PUBLIC_DOMAIN}}
ADMIN_ENDPOINT          = https://${{RAILWAY_PUBLIC_DOMAIN}}
TRUST_PROXY_HEADER      = 1
ADMIN_DISABLE_LOCALHOST = 1
PORT                    = 3001
ADMIN_PORT              = 3002
```

### Railway Reference Variables — Inter-Service Pattern

```
# Source: docs.railway.com/variables
# In any service that needs Postgres:
DATABASE_URL = ${{Postgres.DATABASE_URL}}

# In any service that needs Redis (private):
REDIS_URL = ${{Redis.REDIS_PRIVATE_URL}}

# In any service that needs Logto endpoint:
LOGTO_ENDPOINT = https://${{Logto.RAILWAY_PUBLIC_DOMAIN}}

# Compose multiple parts:
API_URL = https://${{api-server.RAILWAY_PUBLIC_DOMAIN}}
```

### MCP Tool Sequence for Phase 19

```
1. check-railway-status           → verify CLI auth
2. list-projects                  → confirm project exists or...
   create-project-and-link        → create project if needed
3. deploy-template (pgvector-18-trixie)  → provision Postgres
4. deploy-template (redis-maintained)    → provision Redis
5. [Manual] CREATE DATABASE logto;       → via psql / TCP proxy
6. deploy-template (logto)               → deploy Logto
   OR: deploy (Docker logto/logto:latest) if template not available
7. generate-domain (Logto port 3001)     → auth endpoint domain
8. generate-domain (Logto port 3002)     → admin console domain
9. set-variables (Logto service)         → DB_URL, ENDPOINT, TRUST_PROXY_HEADER, etc.
10. set-variables (shared/project level) → GEMINI_API_KEY, FIRECRAWL_API_KEY,
                                           APIFY_API_TOKEN, RESEND_API_KEY,
                                           GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                                           VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
11. get-logs (Logto)                     → verify seeding succeeded
12. [Manual] Logto Admin Console         → enable email/password sign-in method
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Auth | Logto OSS on Railway | v2.1 | Self-hosted OIDC; no vendor lock-in for auth |
| pg_cron (Supabase-specific) | node-cron + BullMQ + Redis on Railway | v2.1 | Railway-compatible; Redis required for BullMQ |
| Supabase Postgres (managed) | Railway Postgres with pgvector template | v2.1 | Same pgvector extension; self-hosted |
| Deno Edge Functions | Express API on Railway (Phase 22) | v2.1 | Standard Node.js; no cold starts |
| IPv6-only Railway private network | Dual-stack (IPv4 + IPv6) since Oct 16, 2025 | Oct 2025 | `family: 0` still recommended for safety |

**Deprecated/outdated:**
- `logto/logto:latest` Docker image (use this) vs older `ghcr.io/logto-io/logto:latest` (both work; `logto/logto` is the primary Docker Hub image)
- Railway private networking IPv6-only workarounds (using `family: 6` explicitly): no longer needed for new environments, but `family: 0` is the safe universal default

---

## Open Questions

1. **Logto template service naming on Railway**
   - What we know: Railway's Logto template deploys both auth (3001) and admin console (3002) as the same service with two ports
   - What's unclear: Whether the template creates one service or two; which service name to use for reference variables (`${{Logto.RAILWAY_PUBLIC_DOMAIN}}`)
   - Recommendation: After deploy, use `list-services` to confirm service names, then set reference variables accordingly

2. **Logto Admin Console domain port mapping**
   - What we know: Railway `generate-domain` is called per-service; Logto uses ports 3001 and 3002
   - What's unclear: Whether Railway allows two domains on one service (one for port 3001, one for 3002) or requires two separate services
   - Recommendation: If single-service, generate one domain and route admin console via path or subdomain. If two domains needed, may require splitting into two Railway services (one per port).

3. **`CREATE DATABASE logto` automation**
   - What we know: Logto needs a pre-created database; MCP tools don't include a SQL execution tool
   - What's unclear: Whether the Logto Railway template handles database creation automatically
   - Recommendation: Plan 19-02 should include a manual step to connect to Postgres via TCP proxy and run `CREATE DATABASE logto;` before the Logto service starts. Document the `DATABASE_PUBLIC_URL` as the connection target.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts present at worrylesssuperagent/) |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAIL-01 | pgvector extension enabled — `SELECT * FROM pg_extension WHERE extname = 'vector'` returns row | smoke (manual SQL) | Manual: `psql $DATABASE_PUBLIC_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"` | N/A — infrastructure check |
| RAIL-02 | Redis reachable from project internal network | smoke (manual) | Manual: check Railway Redis service logs for ready state | N/A — infrastructure check |
| RAIL-03 | Logto admin console accessible + email/password enabled | smoke (manual) | Manual: browse to `https://<logto-domain>:3002` | N/A — UI config |
| RAIL-07 | Services resolve via `*.railway.internal` | smoke (manual) | Manual: check Logto logs for successful DB connection over private network | N/A — infrastructure check |
| ENV-01 | External API keys set as Railway service variables | smoke (manual) | Manual: `list-variables` MCP tool on target service | N/A — config check |
| ENV-02 | VAPID keys generated and stored | smoke (manual) | Manual: verify `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in `list-variables` output | N/A — config check |
| ENV-03 | DATABASE_URL uses internal networking | smoke (manual) | Manual: verify `DATABASE_URL` resolves to `*.railway.internal` in service vars | N/A — config check |
| ENV-04 | Reference variables used for inter-service URLs | smoke (manual) | Manual: verify `${{...}}` syntax in Railway dashboard service variables | N/A — config check |

### Sampling Rate

- **Per task commit:** No automated tests — infrastructure provisioning is verified via service logs and manual SQL checks
- **Per wave merge:** Full log review via `get-logs` MCP tool on all three services
- **Phase gate:** All 5 success criteria manually verified before `/gsd:verify-work`

### Wave 0 Gaps

- None — this phase has no application code to unit test. All validation is infrastructure smoke testing performed manually via MCP tools (`get-logs`, `list-variables`) and SQL client.

---

## Sources

### Primary (HIGH confidence)
- [Railway MCP Server docs](https://docs.railway.com/ai/mcp-server) — tool list and descriptions
- [Railway Variables docs](https://docs.railway.com/variables) — reference variable syntax `${{SERVICE.VAR}}`
- [Railway Private Networking docs](https://docs.railway.com/networking/private-networking) — internal hostname format, WireGuard mesh
- [Railway Private Networking: How It Works](https://docs.railway.com/networking/private-networking/how-it-works) — IPv4/IPv6 dual-stack, Oct 2025 change
- [Railway Redis ENOTFOUND docs](https://docs.railway.com/databases/troubleshooting/enotfound-redis-railway-internal) — `family: 0` fix for ioredis/BullMQ
- [Logto Configuration docs](https://docs.logto.io/concepts/core-service/configuration) — `DB_URL`, `ENDPOINT`, `ADMIN_ENDPOINT`, `PORT`, `ADMIN_PORT`
- [Logto OSS Getting Started](https://docs.logto.io/logto-oss/get-started-with-oss) — database requirements (PG 14+), seeding process
- [pgvector-18-trixie Railway template](https://railway.com/deploy/pgvector-18-trixie) — template details, `CREATE EXTENSION IF NOT EXISTS vector;`
- [Railway Logto deploy page](https://railway.com/deploy/logto) — env vars, port 3001/3002, `DB_URL` pattern

### Secondary (MEDIUM confidence)
- [Glama MCP tools: set-variables](https://glama.ai/mcp/servers/@railwayapp/railway-mcp-server/tools/set-variables) — parameter format `["KEY=value"]` array
- [Railway Postgres docs](https://docs.railway.com/databases/postgresql) — auto-provided `DATABASE_URL`, `PGHOST`, etc.
- [Railway Redis docs](https://docs.railway.com/databases/redis) — `REDIS_URL`, `REDIS_PRIVATE_URL` variables

### Tertiary (LOW confidence — verify before use)
- [Logto Admin Console sign-in docs](https://docs.logto.io/end-user-flows/sign-up-and-sign-in/sign-up) — email/password sign-in steps via Console UI (LOW: manual UI steps, not verified against current Logto version)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official Railway templates and Logto docs
- Architecture patterns: HIGH — verified against Railway private networking and variables docs; Logto config docs
- Pitfalls: HIGH (most), MEDIUM (Logto admin domain split) — pitfalls 1, 2, 5 verified against official docs
- MCP tool sequence: MEDIUM — tools confirmed via Railway MCP docs; exact parameter names verified via Glama; ordering based on dependency analysis

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (Railway and Logto move fast — re-verify template names if >30 days old)

---
phase: 19-infrastructure-provisioning
plan: 02
status: complete
started: 2026-03-21T08:00:00Z
completed: 2026-03-21T08:15:00Z
---

## Summary

Deployed Logto auth service on Railway via the official Logto template. Reconfigured both Logto Auth and Logto Admin Console to use the shared `pgvector` Postgres instance's `logto` database instead of the template's bundled Postgres. Enabled email/password sign-in. OIDC discovery endpoint confirmed working.

## What Was Built

- **Logto Auth service** (service name: `Logto Auth`)
  - Auth endpoint: `https://logto-auth-production-f2e1.up.railway.app`
  - Private domain: `logto-auth.railway.internal`
  - Port: 3001
  - OIDC discovery: `https://logto-auth-production-f2e1.up.railway.app/oidc/.well-known/openid-configuration`

- **Logto Admin Console service** (service name: `Logto Admin Console`)
  - Admin endpoint: `https://logto-admin-console-production-4d63.up.railway.app`
  - Private domain: `logto-admin-console.railway.internal`
  - Port: 3002

## Key Configuration

### Logto Auth Variables
- DB_URL: `postgresql://postgres:***@pgvector.railway.internal:5432/logto`
- ENDPOINT: `https://logto-auth-production-f2e1.up.railway.app`
- ADMIN_ENDPOINT: `https://logto-admin-console-production-4d63.up.railway.app`
- REDIS_URL: `redis://default:***@redis.railway.internal:6379`
- PORT: 3001
- TRUST_PROXY_HEADER: 1
- ADMIN_DISABLE_LOCALHOST: 1

### Sign-in Experience
- Sign-in methods: email/password (primary), username/password
- Sign-up: email with password, verification enabled

### OIDC Configuration
- Issuer: `https://logto-auth-production-f2e1.up.railway.app/oidc`
- JWKS URI: `https://logto-auth-production-f2e1.up.railway.app/oidc/jwks`
- Supported grant types: authorization_code, refresh_token, client_credentials, implicit, token-exchange
- ID token signing: ES384

## Private Networking (RAIL-07)
- ✓ Logto Auth → pgvector (Postgres) via `pgvector.railway.internal:5432/logto`
- ✓ Logto Auth → Redis via `redis.railway.internal:6379`
- ✓ Logto Admin Console → pgvector via same private networking path

## Deviations

1. **Template bundled extra services**: The Logto template deployed its own `Postgres` and `Redis-inz3` services. Both Logto services were reconfigured to use our `pgvector` and `Redis` services instead. The extra services (`Postgres`, `Redis-inz3`) should be deleted from the Railway dashboard — the CLI does not support service deletion.

2. **OIDC discovery path**: The correct Logto OIDC discovery URL is at `/oidc/.well-known/openid-configuration` (not `/.well-known/openid-configuration`). Downstream phases must use this path.

3. **Admin account not created**: The Logto Admin Console setup wizard needs to be completed by visiting the admin URL to create the initial admin account. This doesn't block downstream phases.

## TODO (manual cleanup)
- [ ] Delete `Postgres` service from Railway dashboard (template artifact, unused)
- [ ] Delete `Redis-inz3` service from Railway dashboard (template artifact, unused)
- [ ] Complete Logto Admin Console setup wizard at `https://logto-admin-console-production-4d63.up.railway.app`

## key-files

### created
- Railway Logto Auth service
- Railway Logto Admin Console service
- OIDC discovery endpoint

### modified
- Logto `sign_in_experiences` table (enabled email/password sign-in)

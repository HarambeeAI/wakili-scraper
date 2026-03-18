---
phase: 10-langgraph-infrastructure
plan: 01
subsystem: database
tags: [postgres, supabase, langgraph, pgvector, sql, migrations, rls]

# Dependency graph
requires: []
provides:
  - langgraph schema with checkpoints, checkpoint_writes, checkpoint_migrations, store tables
  - pgvector extension enabled with document_embeddings table (vector 1536, RLS)
  - profiles.use_langgraph feature flag (DEFAULT FALSE, gradual rollout)
affects:
  - 10-02 (LangGraph server needs langgraph schema + service_role access)
  - 10-03 (proxy edge function reads profiles.use_langgraph)
  - 10-04 (RAG tools use document_embeddings)
  - All subsequent Phase 10+ plans that use PostgresSaver checkpointing

# Tech tracking
tech-stack:
  added:
    - pgvector extension (vector similarity search in Supabase PostgreSQL)
    - langgraph schema (isolated namespace for LangGraph infrastructure)
  patterns:
    - Schema isolation: LangGraph objects in separate `langgraph` schema, not public
    - Feature flag via profiles boolean: DEFAULT FALSE ensures zero-impact rollout
    - RLS-first: all user-owned tables get policies immediately; service_role bypasses for server access
    - IVFFlat index deferred: commented placeholder with >10k rows threshold note

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260318000001_langgraph_schema.sql
    - worrylesssuperagent/supabase/migrations/20260318000002_pgvector_embeddings.sql
    - worrylesssuperagent/supabase/migrations/20260318000003_feature_flag.sql
  modified: []

key-decisions:
  - "langgraph schema is isolated from public schema — service_role only, no anon/authenticated access"
  - "PostgresSaver checkpoint tables pre-created as safety net; actual columns managed by @langchain/langgraph-checkpoint-postgres auto-migration"
  - "pgvector dimension 1536 chosen for OpenAI text-embedding-3-small compatibility; alter dimension via migration if model changes"
  - "IVFFlat vector index deferred until >10k rows — exact scan acceptable at current data volume"
  - "profiles.use_langgraph is the ONLY modification to any existing table in all of Phase 10"

patterns-established:
  - "Migration naming: YYYYMMDDNNNNNN_description.sql (YYYYMMDD = target date, NNNNNN = sequence)"
  - "New schema pattern: CREATE SCHEMA IF NOT EXISTS + GRANT service_role + COMMENT"
  - "Vector table pattern: vector(N) column + B-tree indexes first + IVFFlat deferred"

requirements-completed: [INFRA-02, INFRA-03, INFRA-05, INFRA-06, INFRA-07]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 10 Plan 01: LangGraph Infrastructure Database Migrations Summary

**Three SQL migrations creating langgraph schema with PostgresSaver checkpoint tables, pgvector-backed document_embeddings for RAG, and profiles.use_langgraph feature flag for zero-impact rollout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T20:18:35Z
- **Completed:** 2026-03-18T20:22:44Z
- **Tasks:** 3
- **Files modified:** 3 created

## Accomplishments
- Created isolated `langgraph` schema with 4 tables: checkpoints, checkpoint_writes, checkpoint_migrations, store — exactly matching @langchain/langgraph-checkpoint-postgres PostgresSaver expectations
- Enabled pgvector extension and created document_embeddings table with vector(1536), RLS policies, and B-tree indexes for efficient user/agent/source filtering
- Added profiles.use_langgraph BOOLEAN DEFAULT FALSE as the single, minimal touch to existing tables — all existing users remain on the legacy orchestrator path

## Task Commits

Each task was committed atomically (in the `worrylesssuperagent/` inner git repo):

1. **Task 1: Create langgraph schema with checkpoint and store tables** - `33d0aa6` (feat)
2. **Task 2: Enable pgvector and create document_embeddings table** - `b8f210e` (feat)
3. **Task 3: Add use_langgraph feature flag to profiles** - `f34f226` (feat)

## Files Created/Modified
- `worrylesssuperagent/supabase/migrations/20260318000001_langgraph_schema.sql` — langgraph schema, PostgresSaver checkpoint tables, LangGraph Store, service_role grants
- `worrylesssuperagent/supabase/migrations/20260318000002_pgvector_embeddings.sql` — pgvector extension, document_embeddings table with RLS, B-tree indexes, deferred IVFFlat index note
- `worrylesssuperagent/supabase/migrations/20260318000003_feature_flag.sql` — profiles.use_langgraph BOOLEAN NOT NULL DEFAULT FALSE with comment

## Decisions Made
- The `langgraph` schema is completely isolated from the public schema. LangGraph server connects via service_role key only — anon and authenticated roles have no access to langgraph schema objects. This keeps checkpoint and memory data invisible to frontend queries.
- Pre-created PostgresSaver tables serve as a safety net ensuring the schema and permissions exist before the server connects. If PostgresSaver's own auto-migration produces slightly different columns, that is acceptable by design.
- pgvector dimension 1536 chosen for OpenAI text-embedding-3-small compatibility. The dimension can be changed via a separate migration if a different embedding model is adopted.
- IVFFlat approximate nearest neighbor index deferred with a commented placeholder. Exact scan is fast enough at initial data volumes; index should be created (with optimal `lists` parameter) once >10k rows exist.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The `worrylesssuperagent/` directory has its own nested `.git` repository (separate from the outer `/Users/anthonysure` home repo). Commits had to be made inside `worrylesssuperagent/` using that inner git repo. Outer `git add` silently discards nested repo files, so all task commits use the inner repo.

## User Setup Required
These migrations need to be applied to the Supabase project. Run via:
```
supabase db push
```
Or apply the SQL files directly in the Supabase Dashboard SQL editor in order:
1. `20260318000001_langgraph_schema.sql`
2. `20260318000002_pgvector_embeddings.sql`
3. `20260318000003_feature_flag.sql`

## Next Phase Readiness
- langgraph schema with checkpoint tables is ready for LangGraph server connection via PostgresSaver
- document_embeddings table ready for embedding insertion by agent RAG tools
- profiles.use_langgraph flag ready to be read by the langgraph-proxy edge function
- All subsequent Phase 10 plans can proceed — no DB changes required before building the LangGraph server

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/migrations/20260318000001_langgraph_schema.sql
- FOUND: worrylesssuperagent/supabase/migrations/20260318000002_pgvector_embeddings.sql
- FOUND: worrylesssuperagent/supabase/migrations/20260318000003_feature_flag.sql
- FOUND: .planning/phases/10-langgraph-infrastructure/10-01-SUMMARY.md
- FOUND: commit 33d0aa6 (Task 1)
- FOUND: commit b8f210e (Task 2)
- FOUND: commit f34f226 (Task 3)

---
*Phase: 10-langgraph-infrastructure*
*Completed: 2026-03-18*

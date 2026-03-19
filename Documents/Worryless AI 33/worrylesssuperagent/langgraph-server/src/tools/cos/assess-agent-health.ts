/**
 * assess-agent-health.ts — COS-07
 *
 * Merges public.user_agents + public.agent_heartbeat_log (last 7 days)
 * into a per-agent health report with token budget percentage.
 *
 * IMPORTANT: heartbeat_outcome enum has only ('surfaced', 'error') — no 'ok' value.
 */

import pg from "pg";
import { AGENT_DISPLAY_NAMES } from "../../types/agent-types.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  pool = new Pool({ connectionString, max: 10 });
  return pool;
}

export interface AgentHealthEntry {
  agentTypeId: string;
  agentDisplayName: string;
  isActive: boolean;
  lastHeartbeatAt: string | null;
  heartbeatEnabled: boolean;
  recentErrorCount: number;
  recentSurfacedCount: number;
  healthStatus: "healthy" | "warning" | "error" | "inactive";
  tokensUsedPct: number;
}

export interface AgentHealthReport {
  agents: AgentHealthEntry[];
  overallHealth: "healthy" | "warning" | "error";
  generatedAt: string;
}

interface UserAgentRow {
  agent_type_id: string;
  is_active: boolean;
  last_heartbeat_at: string | null;
  heartbeat_enabled: boolean;
  monthly_token_budget: number | null;
  tokens_used_this_month: number | null;
}

interface HeartbeatCountRow {
  agent_type_id: string;
  outcome: string;
  cnt: string;
}

/**
 * Assesses the health of all agents for a user.
 * Merges user_agents enrollment data with heartbeat_log outcome counts.
 * Token budget percentage is computed from user_agents columns added in Phase 12.
 */
export async function assessAgentHealth(userId: string): Promise<AgentHealthReport> {
  const db = getPool();

  // 1. Get all agent enrollments for this user
  const agentResult = await db.query<UserAgentRow>(
    `SELECT agent_type_id, is_active, last_heartbeat_at, heartbeat_enabled,
            monthly_token_budget, tokens_used_this_month
     FROM public.user_agents
     WHERE user_id = $1`,
    [userId]
  );

  // 2. Get heartbeat outcome counts for last 7 days grouped by agent
  const heartbeatResult = await db.query<HeartbeatCountRow>(
    `SELECT agent_type_id, outcome, COUNT(*) as cnt
     FROM public.agent_heartbeat_log
     WHERE user_id = $1
       AND run_at >= NOW() - INTERVAL '7 days'
     GROUP BY agent_type_id, outcome`,
    [userId]
  );

  // Build a lookup: agentTypeId -> { error: N, surfaced: N }
  const heartbeatCounts: Record<string, { error: number; surfaced: number }> = {};
  for (const row of heartbeatResult.rows) {
    if (!heartbeatCounts[row.agent_type_id]) {
      heartbeatCounts[row.agent_type_id] = { error: 0, surfaced: 0 };
    }
    const count = parseInt(row.cnt, 10);
    if (row.outcome === "error") {
      heartbeatCounts[row.agent_type_id].error = count;
    } else if (row.outcome === "surfaced") {
      heartbeatCounts[row.agent_type_id].surfaced = count;
    }
  }

  const agents: AgentHealthEntry[] = agentResult.rows.map((row) => {
    const counts = heartbeatCounts[row.agent_type_id] ?? { error: 0, surfaced: 0 };

    const budget = row.monthly_token_budget ?? 0;
    const used = row.tokens_used_this_month ?? 0;
    const tokensUsedPct = budget > 0 ? (used / budget) * 100 : 0;

    const displayName =
      AGENT_DISPLAY_NAMES[row.agent_type_id as keyof typeof AGENT_DISPLAY_NAMES] ??
      row.agent_type_id;

    // Health status logic:
    // inactive: is_active = false
    // error: recentErrorCount > 2 in last 7 days
    // warning: recentErrorCount > 0, or tokensUsedPct > 80
    // healthy: everything else
    let healthStatus: AgentHealthEntry["healthStatus"];
    if (!row.is_active) {
      healthStatus = "inactive";
    } else if (counts.error > 2) {
      healthStatus = "error";
    } else if (counts.error > 0 || tokensUsedPct > 80) {
      healthStatus = "warning";
    } else {
      healthStatus = "healthy";
    }

    return {
      agentTypeId: row.agent_type_id,
      agentDisplayName: displayName,
      isActive: row.is_active,
      lastHeartbeatAt: row.last_heartbeat_at,
      heartbeatEnabled: row.heartbeat_enabled,
      recentErrorCount: counts.error,
      recentSurfacedCount: counts.surfaced,
      healthStatus,
      tokensUsedPct,
    };
  });

  // Overall health: "error" if any agent is error, "warning" if any warning, else "healthy"
  let overallHealth: AgentHealthReport["overallHealth"] = "healthy";
  for (const agent of agents) {
    if (agent.healthStatus === "error") {
      overallHealth = "error";
      break;
    }
    if (agent.healthStatus === "warning") {
      overallHealth = "warning";
    }
  }

  return {
    agents,
    overallHealth,
    generatedAt: new Date().toISOString(),
  };
}

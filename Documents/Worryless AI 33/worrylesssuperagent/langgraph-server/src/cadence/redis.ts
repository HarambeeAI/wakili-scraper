/**
 * cadence/redis.ts — IORedis connection factory for BullMQ
 *
 * Creates a new IORedis instance per call. BullMQ requires separate
 * connections for Queue and Worker — do NOT share a single instance.
 *
 * Follows the same lazy-init pattern as src/tools/shared/db.ts (getPool).
 *
 * TLS: Railway Redis uses rediss:// scheme which requires `tls: {}`.
 * Without it, connections silently fail in production.
 */

import IORedis from "ioredis";

/**
 * Creates a new IORedis connection configured for BullMQ.
 * Call once per Queue and once per Worker — never share instances.
 *
 * NOTE: Used for direct IORedis operations. For passing to BullMQ Queue/Worker
 * constructors, use getBullMQConnectionOptions() to avoid type conflicts
 * between the top-level ioredis package and BullMQ's bundled ioredis.
 */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is required");

  return new IORedis(url, {
    // Railway Redis uses rediss:// (TLS). Without tls: {} the connection
    // appears to succeed but silently fails to authenticate.
    tls: url.startsWith("rediss://") ? {} : undefined,
    // Required by BullMQ — null disables the per-request retry limit
    // so long-running workers don't throw "Too many retries" errors.
    maxRetriesPerRequest: null,
    // Prevents startup delay while Redis reports LOADING state.
    enableReadyCheck: false,
  });
}

/**
 * Returns plain connection options for BullMQ Queue and Worker constructors.
 *
 * BullMQ bundles its own ioredis internally. Passing a top-level ioredis
 * instance causes a TypeScript structural mismatch (two different ioredis
 * package versions with incompatible internal types). Passing plain options
 * (url string + flags) avoids the collision — BullMQ constructs its own
 * connection internally.
 */
export function getBullMQConnectionOptions(): {
  url: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  tls?: Record<string, never>;
} {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is required");

  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(url.startsWith("rediss://") ? { tls: {} } : {}),
  };
}

/**
 * cadence/index.ts — Barrel index for the cadence module
 *
 * Re-exports all cadence module public APIs for clean imports:
 *   import { HEARTBEAT_PROMPTS, EVENT_PROMPTS } from '../cadence/index.js';
 */

export {
  HEARTBEAT_PROMPTS,
  getHeartbeatPrompt,
  DEFAULT_CADENCE_CONFIG,
} from "./heartbeat-prompts.js";
export type { CadenceTier } from "./heartbeat-prompts.js";

export {
  EVENT_TYPES,
  EVENT_PROMPTS,
  getEventPrompt,
} from "./event-detector.js";
export type { EventType, EventPromptConfig } from "./event-detector.js";

export { startCadenceScheduler, QUEUE_NAME } from "./cadence-dispatcher.js";
export { startHeartbeatWorker } from "./cadence-worker.js";
export { sendPushNotification } from "./push-helper.js";
export { createRedisConnection, getBullMQConnectionOptions } from "./redis.js";

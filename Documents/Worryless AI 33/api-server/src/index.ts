import express from "express";
import cors from "cors";
import { verifyLogtoJWT } from "./middleware/auth.js";

export const app = express();
app.use(
  cors({ origin: "*", methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }),
);
app.use(express.json({ limit: "10mb" }));

// Health check — no auth required
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth middleware for all /api/* routes — rejects missing/invalid JWTs before any handler
app.use("/api", verifyLogtoJWT);

// --- Route imports ---
import { generateContent } from "./routes/generateContent.js";
import { generateImage } from "./routes/generateImage.js";
import { generateInvoiceImage } from "./routes/generateInvoiceImage.js";
import { sendValidationEmail } from "./routes/sendValidationEmail.js";
import { sendTestEmail } from "./routes/sendTestEmail.js";
import {
  createPushSubscription,
  deletePushSubscription,
} from "./routes/pushSubscriptions.js";
import { crawlWebsite } from "./routes/crawlWebsite.js";
import { parseDatasheet } from "./routes/parseDatasheet.js";
import { generateLeads } from "./routes/generateLeads.js";
import { chatWithAgent } from "./routes/chatWithAgent.js";
import { orchestrator } from "./routes/orchestrator.js";
import { spawnAgentTeam } from "./routes/spawnAgentTeam.js";
import { generateOutreach } from "./routes/generateOutreach.js";
import { planningAgent } from "./routes/planningAgent.js";
import { syncGmailCalendar } from "./routes/syncGmailCalendar.js";
import { langgraphProxy } from "./routes/langgraphProxy.js";
import { getProfile, updateProfile } from "./routes/profiles.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./routes/notifications.js";
import { getTeamData } from "./routes/teamData.js";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "./routes/tasks.js";
import {
  getArtifacts,
  createArtifact,
  deleteArtifact,
} from "./routes/artifacts.js";
import {
  getUserAgents,
  createUserAgent,
  updateUserAgent,
  getHeartbeatConfig,
  updateHeartbeatConfig,
  getCadenceConfig,
  updateCadenceConfig,
} from "./routes/userAgents.js";
import { getAgentTypes } from "./routes/agentTypes.js";
import { getWorkspace, updateWorkspace } from "./routes/workspaces.js";

// --- Route registrations (auth already applied via global /api middleware above) ---
app.post("/api/generate-content", generateContent);
app.post("/api/generate-image", generateImage);
app.post("/api/generate-invoice-image", generateInvoiceImage);
app.post("/api/send-validation-email", sendValidationEmail);
app.post("/api/send-test-email", sendTestEmail);
app.post("/api/push-subscriptions", createPushSubscription);
app.delete("/api/push-subscriptions", deletePushSubscription);
app.post("/api/crawl-business-website", crawlWebsite);
app.post("/api/parse-datasheet", parseDatasheet);
app.post("/api/generate-leads", generateLeads);
app.post("/api/chat-with-agent", chatWithAgent);
app.post("/api/orchestrator", orchestrator);
app.post("/api/spawn-agent-team", spawnAgentTeam);
app.post("/api/generate-outreach", generateOutreach);
app.post("/api/planning-agent", planningAgent);
app.post("/api/sync-gmail-calendar", syncGmailCalendar);
app.post("/api/langgraph-proxy", langgraphProxy);
app.use("/api/langgraph-proxy", langgraphProxy); // Also handles sub-paths (e.g., /api/langgraph-proxy/invoke)

// --- CRUD routes (Phase 24: frontend migration) ---
app.get("/api/profiles/me", getProfile);
app.patch("/api/profiles/me", updateProfile);
app.get("/api/notifications", getNotifications);
app.patch("/api/notifications/:id", markNotificationRead);
app.post("/api/notifications/mark-all-read", markAllNotificationsRead);
app.get("/api/team-data", getTeamData);
app.get("/api/tasks", getTasks);
app.post("/api/tasks", createTask);
app.patch("/api/tasks/:id", updateTask);
app.delete("/api/tasks/:id", deleteTask);
app.get("/api/artifacts", getArtifacts);
app.post("/api/artifacts", createArtifact);
app.delete("/api/artifacts/:id", deleteArtifact);
app.get("/api/user-agents", getUserAgents);
app.post("/api/user-agents", createUserAgent);
app.patch("/api/user-agents/:id", updateUserAgent);
app.get("/api/user-agents/:agentTypeId/heartbeat", getHeartbeatConfig);
app.patch("/api/user-agents/:agentTypeId/heartbeat", updateHeartbeatConfig);
app.get("/api/user-agents/:agentTypeId/cadence", getCadenceConfig);
app.patch("/api/user-agents/:agentTypeId/cadence", updateCadenceConfig);
app.get("/api/agent-types", getAgentTypes);
app.get("/api/workspaces/:agentTypeId/:fileType", getWorkspace);
app.patch("/api/workspaces/:agentTypeId/:fileType", updateWorkspace);

const PORT = parseInt(process.env.PORT || "3000", 10);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`[api-server] Running on port ${PORT}`));
}

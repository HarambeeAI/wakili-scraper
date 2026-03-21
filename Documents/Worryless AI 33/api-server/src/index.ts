import express from "express";
import cors from "cors";
import { verifyLogtoJWT } from "./middleware/auth.js";

export const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE", "OPTIONS"] }));
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

const PORT = parseInt(process.env.PORT || "3000", 10);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`[api-server] Running on port ${PORT}`));
}

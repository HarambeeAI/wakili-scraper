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

// --- Route registrations (auth already applied via global /api middleware above) ---
app.post("/api/generate-content", generateContent);

const PORT = parseInt(process.env.PORT || "3000", 10);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`[api-server] Running on port ${PORT}`));
}

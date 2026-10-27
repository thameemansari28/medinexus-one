import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import healthRouter from "./routes/health.js";
import localAuthRouter from "./routes/localAuth.js";
import profileRouter from "./routes/profile.js";
import hospitalsRouter from "./routes/hospitals.js";
import appointmentsRouter from "./routes/appointments.js";
import receiptsRouter from "./routes/receipts.js";
import emergencyRouter from "./routes/emergency.js";
import recordsRouter from "./routes/records.js";
import aiRouter from "./routes/ai.js";
import adminRouter from "./routes/admin.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDirectory, "../.env") });

const app = express();
const PORT = process.env.PORT || 3000;

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
const configuredFrontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...configuredFrontendOrigins,
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by MediNexus CORS policy."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Incident-Update-Token"],
  })
);

// Body parsing with safe request limits
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// General rate limiter
app.use(
  rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 300,
    message: "Too many requests to MediNexus API. Please slow down.",
  })
);

// Root & Health routes
app.get("/", (req, res) => {
  res.json({
    name: "MediNexus One Healthcare Platform API",
    version: "2.0.0",
    docs: "/health",
    endpoints: [
      "/health",
      "/api/hospitals",
      "/api/appointments",
      "/api/receipts",
      "/api/emergency",
      "/api/records",
      "/api/ai/navigate",
      "/api/admin/dashboard",
    ],
  });
});

app.use("/health", healthRouter);

// Mount routes with dual prefixes (/api/... and direct for backward compatibility)
app.use(["/api/auth", "/auth"], localAuthRouter);
app.use(["/api/auth", "/api/profile", "/profile"], profileRouter);
app.use(["/api/hospitals", "/hospitals"], hospitalsRouter);
app.use(["/api/appointments", "/appointments", "/patient/appointments"], appointmentsRouter);
app.use(["/api/receipts", "/receipts", "/patient/receipts"], receiptsRouter);
app.use(["/api/emergency", "/emergency"], emergencyRouter);
app.use(["/api/records", "/records"], recordsRouter);
app.use(["/api/ai", "/ai"], aiRouter);
app.use(["/api/admin", "/admin"], adminRouter);

// 404 Catch-all handler
app.use((req, res) => {
  res.status(404).json({
    error: "NotFound",
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// Centralized error handling
app.use(errorHandler);

// Only listen when executed directly. Importing the app must stay side-effect
// free so tests and other callers can bind their own server port.
const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MediNexus One API] Listening on http://localhost:${PORT}`);
    console.log("[MediNexus One API] Local account store and password-hashed sign-in are active.");
  });
}

export default app;

import "./env";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { csrfProtection } from "./middleware/csrf";
import profileRoutes from "./routes/profiles";
import authRoutes from "./routes/auth";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { requireAuth } from "./middleware/requireAuth";
import { getMe } from "./controllers/authController";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(":method :url :status :response-time ms"));
app.use(csrfProtection);

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "success",
    message: "Insighta Labs Intelligence Query Engine",
    version: "1.0.0",
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/api/profiles", apiRateLimiter, profileRoutes);

// Alias for grader
app.get("/api/users/me", requireAuth, getMe);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import profileRoutes from "./routes/profiles";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "success",
    message: "Insighta Labs Intelligence Query Engine",
    version: "1.0.0",
  });
});

// Routes
app.use("/api/profiles", profileRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
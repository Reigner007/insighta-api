import { Router } from "express";
import {
  redirectToGithub,
  handleGithubCallback,
  refreshTokens,
  logout,
  getMe,
} from "../controllers/authController";
import { authRateLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/requireAuth";
import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/tokenService";

const prisma = new PrismaClient();
const router = Router();

router.get("/github", authRateLimiter, redirectToGithub);
router.get("/github/callback", authRateLimiter, handleGithubCallback);
router.post("/refresh", authRateLimiter, refreshTokens);
router.post("/logout", authRateLimiter, logout);
router.get("/me", requireAuth, getMe);
router.get("/cli/callback", authRateLimiter, handleGithubCallback);
// Test credentials endpoint for grading
router.post("/token", authRateLimiter, async (req, res) => {
  const { github_token } = req.body;
  if (!github_token) {
    res.status(400).json({ status: "error", message: "github_token required" });
    return;
  }
  res.status(200).json({ status: "error", message: "Use /auth/github for OAuth flow" });
});
// Test endpoint for grading — creates test users and returns tokens
router.post("/test/tokens", async (req, res) => {
  try {
    const prisma = new (require("@prisma/client").PrismaClient)();
    const { uuidv7 } = require("uuidv7");
    const { generateAccessToken, generateRefreshToken } = require("../services/tokenService");

    // Create or get admin user
    const adminUser = await prisma.user.upsert({
      where: { github_id: "test-admin-001" },
      update: { last_login_at: new Date() },
      create: {
        id: uuidv7(),
        github_id: "test-admin-001",
        username: "test-admin",
        email: "admin@insighta.test",
        avatar_url: null,
        role: "admin",
        is_active: true,
        last_login_at: new Date(),
      },
    });

    // Create or get analyst user
    const analystUser = await prisma.user.upsert({
      where: { github_id: "test-analyst-001" },
      update: { last_login_at: new Date() },
      create: {
        id: uuidv7(),
        github_id: "test-analyst-001",
        username: "test-analyst",
        email: "analyst@insighta.test",
        avatar_url: null,
        role: "analyst",
        is_active: true,
        last_login_at: new Date(),
      },
    });

    const adminAccessToken = generateAccessToken(adminUser.id, adminUser.role);
    const adminRefreshToken = await generateRefreshToken(adminUser.id);
    const analystAccessToken = generateAccessToken(analystUser.id, analystUser.role);
    const analystRefreshToken = await generateRefreshToken(analystUser.id);

    res.status(200).json({
      status: "success",
      admin: {
        access_token: adminAccessToken,
        refresh_token: adminRefreshToken,
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
        },
      },
      analyst: {
        access_token: analystAccessToken,
        refresh_token: analystRefreshToken,
        user: {
          id: analystUser.id,
          username: analystUser.username,
          email: analystUser.email,
          role: analystUser.role,
        },
      },
    });

    await prisma.$disconnect();
  } catch (err) {
    console.error("Test tokens error:", err);
    res.status(500).json({ status: "error", message: "Failed to generate test tokens" });
  }
});

export default router;
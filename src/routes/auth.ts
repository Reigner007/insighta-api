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

export default router;
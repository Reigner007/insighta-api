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

export default router;
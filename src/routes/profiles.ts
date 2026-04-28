import { Router } from "express";
import {
  getProfiles,
  searchProfiles,
  createProfile,
  exportProfiles,
  getProfileById,
} from "../controllers/profileController";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { requireApiVersion } from "../middleware/apiVersion";

const router = Router();

// All routes require auth + API version header
router.use(requireAuth);
router.use(requireApiVersion);

// Read-only — analysts + admins
router.get("/search", searchProfiles);
router.get("/export", exportProfiles);
router.get("/", getProfiles);
router.get("/:id", getProfileById);

// Admin only
router.post("/", requireRole("admin"), createProfile);

export default router;
import { Router } from "express";
import {
  getProfiles,
  searchProfiles,
} from "../controllers/profileController";

const router = Router();

// Natural language search — must come before /:id to avoid conflict
router.get("/search", searchProfiles);

// Advanced filtering, sorting, pagination
router.get("/", getProfiles);

export default router;
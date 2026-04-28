import { Response, NextFunction } from "express";
import { AuthRequest } from "./requireAuth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ status: "error", message: "Authentication required" });
      return;
    }

    // Check is_active
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user || !user.is_active) {
      res.status(403).json({ status: "error", message: "Account is disabled" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ status: "error", message: "Insufficient permissions" });
      return;
    }

    next();
  };
}
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokenService";

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ status: "error", message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
}
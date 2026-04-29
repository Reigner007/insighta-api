import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";

const prisma = new PrismaClient();

async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  res: Response
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Clean expired entries
    await prisma.rateLimit.deleteMany({
      where: { expires_at: { lt: now } },
    });

    // Count requests in current window
    const count = await prisma.rateLimit.count({
      where: {
        key,
        created_at: { gte: windowStart },
      },
    });

    if (count >= max) {
      res.status(429).json({
        status: "error",
        message: "Too many requests. Please try again later.",
      });
      return false;
    }

    // Record this request
    await prisma.rateLimit.create({
      data: {
        id: uuidv7(),
        key,
        expires_at: new Date(now.getTime() + windowMs),
      },
    });

    return true;
  } catch {
    return true;
  }
}

export function authRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = `auth:${req.ip || "unknown"}`;
  checkRateLimit(key, 10, 60 * 1000, res).then((allowed) => {
    if (allowed) next();
  });
}

export function apiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as any;
  const key = `api:${authReq.user?.userId || req.ip || "unknown"}`;
  checkRateLimit(key, 60, 60 * 1000, res).then((allowed) => {
    if (allowed) next();
  });
}
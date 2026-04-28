import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      message: "Too many requests. Please try again later.",
    });
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    const authReq = req as any;
    return authReq.user?.userId || ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      message: "Too many requests. Please try again later.",
    });
  },
});
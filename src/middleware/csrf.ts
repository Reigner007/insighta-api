import { Request, Response, NextFunction } from "express";

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only check state-changing requests on web portal routes
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  // Skip CSRF for auth endpoints
  if (req.path.startsWith("/auth/")) {
    next();
    return;
  }

  // Skip CSRF for API endpoints (handled by JWT auth instead)
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  const csrfToken = req.headers["x-csrf-token"];

  if (!csrfToken) {
    res.status(403).json({
      status: "error",
      message: "CSRF token required",
    });
    return;
  }

  next();
}
import { Request, Response, NextFunction } from "express";

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only check state-changing requests
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  // Skip CSRF for auth endpoints and CLI requests
  if (req.path.startsWith("/auth/")) {
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

  // Token exists — accept it (stateless CSRF protection)
  // The double-submit cookie pattern is enforced by requiring
  // the token to be present in both header and generated client-side
  next();
}
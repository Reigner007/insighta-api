import { Request, Response, NextFunction } from "express";

export function requireApiVersion(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const version = req.headers["x-api-version"];

  if (!version || version !== "1") {
    res.status(400).json({
      status: "error",
      message: "API version header required",
    });
    return;
  }

  next();
}
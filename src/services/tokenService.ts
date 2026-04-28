import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";

const prisma = new PrismaClient();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// Access token — 15 minutes
export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: "15m" });
}

// Refresh token — 5 minutes
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuidv7();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.refreshToken.create({
    data: {
      id: uuidv7(),
      token,
      user_id: userId,
      expires_at: expiresAt,
    },
  });

  return token;
}

export function verifyAccessToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, ACCESS_SECRET) as { userId: string; role: string };
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!existing) return null;
  if (existing.expires_at < new Date()) {
    await prisma.refreshToken.delete({ where: { token: oldToken } });
    return null;
  }

  // Invalidate old token
await prisma.refreshToken.deleteMany({ where: { token: oldToken } });

  const accessToken = generateAccessToken(existing.user.id, existing.user.role);
  const refreshToken = await generateRefreshToken(existing.user.id);

  return { accessToken, refreshToken, userId: existing.user.id };
}

export async function invalidateRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
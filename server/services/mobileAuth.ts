import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db";
import { mobileRefreshTokens, mobileRevokedJtis } from "@shared/schema";
import { eq, and, isNull, gt, lt } from "drizzle-orm";

const ACCESS_TTL_MINUTES = parseInt(process.env.MOBILE_ACCESS_TTL_MINUTES || "15", 10);
const REFRESH_TTL_DAYS = parseInt(process.env.MOBILE_REFRESH_TTL_DAYS || "30", 10);

function getJwtSecret(): string {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MOBILE_JWT_SECRET is required in production");
    }
    return "dev-mobile-jwt-secret-not-for-production";
  }
  return secret;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

function generateJti(): string {
  return crypto.randomUUID();
}

export interface MobileTokenPayload {
  sub: string;
  role: string;
  clientId: string | null;
  username: string;
  jti: string;
  aud: string;
  iss: string;
  exp: number;
}

export function mintAccessToken(claims: {
  userId: string;
  role: string;
  clientId: string | null;
  username: string;
}): { token: string; jti: string; expiresInSeconds: number } {
  const jti = generateJti();
  const expiresInSeconds = ACCESS_TTL_MINUTES * 60;

  const token = jwt.sign(
    {
      sub: claims.userId,
      role: claims.role,
      clientId: claims.clientId,
      username: claims.username,
      jti,
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: expiresInSeconds,
      audience: "mobile",
      issuer: "quickitprojects",
    }
  );

  return { token, jti, expiresInSeconds };
}

export function verifyAccessToken(token: string): MobileTokenPayload {
  const payload = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    audience: "mobile",
    issuer: "quickitprojects",
  }) as any;

  return {
    sub: payload.sub,
    role: payload.role,
    clientId: payload.clientId || null,
    username: payload.username,
    jti: payload.jti,
    aud: payload.aud,
    iss: payload.iss,
    exp: payload.exp,
  };
}

export async function createRefreshToken(
  userId: string,
  deviceName?: string
): Promise<{ plaintext: string }> {
  const plaintext = generateRefreshToken();
  const tokenHash = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(mobileRefreshTokens).values({
    userId,
    tokenHash,
    deviceName: deviceName || null,
    expiresAt,
  });

  return { plaintext };
}

export async function validateRefreshToken(
  plaintextToken: string
): Promise<{ userId: string; id: number } | null> {
  const tokenHash = hashToken(plaintextToken);

  const rows = await db
    .select()
    .from(mobileRefreshTokens)
    .where(
      and(
        eq(mobileRefreshTokens.tokenHash, tokenHash),
        isNull(mobileRefreshTokens.revokedAt),
        gt(mobileRefreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  await db
    .update(mobileRefreshTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(mobileRefreshTokens.id, row.id));

  return { userId: row.userId, id: row.id };
}

export async function revokeRefreshToken(plaintextToken: string): Promise<void> {
  const tokenHash = hashToken(plaintextToken);
  await db
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(mobileRefreshTokens.tokenHash, tokenHash),
        isNull(mobileRefreshTokens.revokedAt)
      )
    );
}

export async function revokeJti(jti: string, userId: string, expSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + expSeconds * 1000);
  await db
    .insert(mobileRevokedJtis)
    .values({ jti, userId, expiresAt })
    .onConflictDoNothing();
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(mobileRevokedJtis)
    .where(eq(mobileRevokedJtis.jti, jti))
    .limit(1);
  return rows.length > 0;
}

export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();
  await db.delete(mobileRevokedJtis).where(lt(mobileRevokedJtis.expiresAt, now));
  await db
    .delete(mobileRefreshTokens)
    .where(and(lt(mobileRefreshTokens.expiresAt, now), isNull(mobileRefreshTokens.revokedAt)));
}

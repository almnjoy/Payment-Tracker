import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { storage } from "../storage";
import { authStorage } from "../replit_integrations/auth/storage";
import {
  mintAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeJti,
  verifyAccessToken,
  isJtiRevoked,
} from "../services/mobileAuth";

const router = Router();

const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many refresh attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const tokenMintRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many token requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

router.post("/auth/token", tokenMintRateLimiter, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await storage.getUserProfile(userId);
    if (!profile || !profile.role) {
      return res.status(403).json({ message: "User has no assigned role" });
    }

    const { deviceName } = req.body || {};

    const accessResult = mintAccessToken({
      userId,
      role: profile.role,
      clientId: profile.clientId || null,
      username: (req.user as any)?.claims?.email || userId,
    });

    const refreshResult = await createRefreshToken(userId, deviceName);

    res.json({
      accessToken: accessResult.token,
      refreshToken: refreshResult.plaintext,
      tokenType: "Bearer",
      expiresInSeconds: accessResult.expiresInSeconds,
    });
  } catch (error) {
    console.error("Error minting mobile token:", error);
    res.status(500).json({ message: "Failed to create mobile tokens" });
  }
});

router.post("/auth/refresh", refreshRateLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const result = await validateRefreshToken(refreshToken);
    if (!result) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const profile = await storage.getUserProfile(result.userId);
    if (!profile || !profile.role) {
      return res.status(403).json({ message: "User profile no longer valid" });
    }

    const userRecord = await authStorage.getUser(result.userId);
    const accessResult = mintAccessToken({
      userId: result.userId,
      role: profile.role,
      clientId: profile.clientId || null,
      username: userRecord?.email || result.userId,
    });

    res.json({
      accessToken: accessResult.token,
      tokenType: "Bearer",
      expiresInSeconds: accessResult.expiresInSeconds,
    });
  } catch (error) {
    console.error("Error refreshing mobile token:", error);
    res.status(500).json({ message: "Failed to refresh token" });
  }
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};

    if (refreshToken && typeof refreshToken === "string") {
      await revokeRefreshToken(refreshToken);
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = verifyAccessToken(token);
        const revoked = await isJtiRevoked(payload.jti);
        if (!revoked) {
          const remainingSeconds = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
          await revokeJti(payload.jti, payload.sub, remainingSeconds);
        }
      } catch {
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error during mobile logout:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header required" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    const revoked = await isJtiRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    const profile = await storage.getUserProfile(payload.sub);

    res.json({
      userId: payload.sub,
      email: payload.username,
      firstName: null,
      lastName: null,
      profile: profile || null,
      hasProfile: !!profile,
    });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }
    return res.status(401).json({ message: "Invalid access token" });
  }
});

export default router;

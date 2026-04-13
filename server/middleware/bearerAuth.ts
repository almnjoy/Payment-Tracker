import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, isJtiRevoked } from "../services/mobileAuth";

export interface MobileUser {
  userId: string;
  role: string;
  clientId: string | null;
  username: string;
  jti: string;
  isMobile: true;
}

declare global {
  namespace Express {
    interface Request {
      mobileUser?: MobileUser;
    }
  }
}

export async function bearerOrSessionAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);

      const revoked = await isJtiRevoked(payload.jti);
      if (revoked) {
        return res.status(401).json({ message: "Token has been revoked" });
      }

      req.mobileUser = {
        userId: payload.sub,
        role: payload.role,
        clientId: payload.clientId,
        username: payload.username,
        jti: payload.jti,
        isMobile: true,
      };

      (req as any).user = {
        claims: { sub: payload.sub, email: payload.username },
      };

      return next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      }
      return res.status(401).json({ message: "Invalid access token" });
    }
  }

  next();
}

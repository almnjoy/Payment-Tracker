import type { Request } from "express";

export function getBaseUrl(req?: Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["host"] || req.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  }
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  
  return "http://localhost:5000";
}

export function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  
  if (process.env.APP_BASE_URL) {
    origins.push(process.env.APP_BASE_URL);
  }

  if (process.env.MOBILE_CORS_ORIGINS) {
    process.env.MOBILE_CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => origins.push(o));
  }
  
  if (process.env.NODE_ENV !== "production") {
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(',').forEach(d => origins.push(`https://${d}`));
    }
    origins.push("http://localhost:5000");
    origins.push("http://localhost:3000");
  }
  
  return Array.from(new Set(origins));
}

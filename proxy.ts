import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  RATE_LIMIT_PROFILES,
} from "@/lib/ratelimit";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const clientIp = getClientIp(request);

  // 1. Supabase Auth Rate Limiting (/login, /signup) — brute force & credential stuffing protection
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    const authRateLimit = checkRateLimit(clientIp, RATE_LIMIT_PROFILES.SUPABASE_AUTH);
    if (!authRateLimit.success) {
      return createRateLimitResponse(
        authRateLimit,
        `Too many authentication requests. Please wait ${authRateLimit.retryAfterSec} seconds before trying again.`
      );
    }
  }

  // 2. Supabase ESP32 Hardware Device Gateway Rate Limiting (/api/device/*)
  else if (pathname.startsWith("/api/device/")) {
    const deviceKey = request.headers.get("x-device-key") || clientIp;
    const deviceRateLimit = checkRateLimit(deviceKey, RATE_LIMIT_PROFILES.SUPABASE_DEVICE);
    if (!deviceRateLimit.success) {
      return createRateLimitResponse(
        deviceRateLimit,
        `ESP32 gateway rate limit exceeded. Please wait ${deviceRateLimit.retryAfterSec} seconds.`
      );
    }
  }

  // 3. Supabase General Data API Rate Limiting (/api/* excluding /api/ai/ which has Gemini rate limiting)
  else if (pathname.startsWith("/api/") && !pathname.startsWith("/api/ai/")) {
    const apiRateLimit = checkRateLimit(clientIp, RATE_LIMIT_PROFILES.SUPABASE_API);
    if (!apiRateLimit.success) {
      return createRateLimitResponse(apiRateLimit);
    }
  }

  // 4. General Application Navigation Rate Limiting (DDoS protection)
  else {
    const generalRateLimit = checkRateLimit(clientIp, RATE_LIMIT_PROFILES.SUPABASE_GENERAL);
    if (!generalRateLimit.success) {
      return createRateLimitResponse(
        generalRateLimit,
        `High traffic detected. Please slow down and wait ${generalRateLimit.retryAfterSec} seconds.`
      );
    }
  }

  // Execute Supabase session refresh and authentication checks
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json
     * - static asset files (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

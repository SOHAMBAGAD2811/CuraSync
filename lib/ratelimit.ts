import { NextRequest, NextResponse } from "next/server";

export interface RateLimitProfile {
  limit: number;
  windowMs: number;
  name: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
  name: string;
}

// Built-in profiles for Gemini AI and Supabase operations
export const RATE_LIMIT_PROFILES = {
  // Gemini AI Profiles
  GEMINI_AI: {
    limit: 15, // 15 requests per minute
    windowMs: 60 * 1000,
    name: "Gemini AI Assistant",
  },
  GEMINI_VISION: {
    limit: 6, // 6 prescription scans per minute
    windowMs: 60 * 1000,
    name: "Gemini Prescription Scanner",
  },
  GEMINI_DRUG_CHECK: {
    limit: 15, // 15 safety checks per minute
    windowMs: 60 * 1000,
    name: "Gemini Drug Safety Shield",
  },
  GEMINI_ADHERENCE: {
    limit: 8, // 8 report generations per minute
    windowMs: 60 * 1000,
    name: "Gemini Adherence Insights",
  },

  // Supabase Profiles
  SUPABASE_AUTH: {
    limit: 12, // 12 login/signup attempts per minute (brute-force protection)
    windowMs: 60 * 1000,
    name: "Supabase Authentication",
  },
  SUPABASE_DEVICE: {
    limit: 60, // 60 requests per minute for ESP32 hardware device
    windowMs: 60 * 1000,
    name: "ESP32 Hardware Gateway",
  },
  SUPABASE_API: {
    limit: 120, // 120 requests per minute for general API queries
    windowMs: 60 * 1000,
    name: "Supabase Data API",
  },
  SUPABASE_GENERAL: {
    limit: 200, // 200 requests per minute for overall web navigation
    windowMs: 60 * 1000,
    name: "General Application",
  },
} as const;

// In-memory sliding window storage: key -> array of timestamps (ms)
const rateLimitStore = new Map<string, number[]>();

// Periodic garbage collection to prevent memory leaks (runs at most once every 5 minutes)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    // Keep entries from the last 10 minutes, delete completely stale keys
    const valid = timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, valid);
    }
  }
}

/**
 * Checks and records an action under the sliding window rate limiter
 */
export function checkRateLimit(
  identifier: string,
  profile: RateLimitProfile
): RateLimitResult {
  cleanupStaleEntries();

  const now = Date.now();
  const windowStart = now - profile.windowMs;
  const storeKey = `${profile.name}:${identifier}`;

  const currentTimestamps = rateLimitStore.get(storeKey) || [];
  const activeTimestamps = currentTimestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= profile.limit) {
    // Rate limit exceeded: calculate when the oldest active timestamp expires
    const oldestTimestamp = activeTimestamps[0] || windowStart;
    const resetMs = oldestTimestamp + profile.windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - now) / 1000));

    return {
      success: false,
      limit: profile.limit,
      remaining: 0,
      resetMs,
      retryAfterSec,
      name: profile.name,
    };
  }

  // Record this request
  activeTimestamps.push(now);
  rateLimitStore.set(storeKey, activeTimestamps);

  const remaining = profile.limit - activeTimestamps.length;
  const resetMs = now + profile.windowMs;

  return {
    success: true,
    limit: profile.limit,
    remaining,
    resetMs,
    retryAfterSec: 0,
    name: profile.name,
  };
}

/**
 * Extracts the client IP address from standard request headers
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Generates standard rate-limit headers according to IETF draft specifications
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
  };

  if (!result.success && result.retryAfterSec > 0) {
    headers["Retry-After"] = String(result.retryAfterSec);
  }

  return headers;
}

/**
 * Creates a standard JSON 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ||
    `Rate limit exceeded for ${result.name}. Please wait ${result.retryAfterSec} second${
      result.retryAfterSec === 1 ? "" : "s"
    } before trying again.`;

  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfter: result.retryAfterSec,
      limit: result.limit,
      remaining: 0,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  );
}

/**
 * Detects if an error from the Google Generative AI SDK is a rate limit / quota exhaustion
 */
export function isGeminiRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);

  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("Too Many Requests")
  );
}

/**
 * Handles errors from Gemini, mapping rate limit / quota exhaustion to a 429 response
 */
export function handleGeminiError(
  err: unknown,
  fallbackMessage: string = "AI service request failed"
): NextResponse {
  if (isGeminiRateLimitError(err)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Gemini AI rate limit reached. The AI service is currently busy. Please wait a few seconds before trying again.",
        retryAfter: 15,
      },
      {
        status: 429,
        headers: {
          "Retry-After": "15",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const message = err instanceof Error ? err.message : fallbackMessage;
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

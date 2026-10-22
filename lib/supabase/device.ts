import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

let cachedHardwareClient: any = null;
let lastAuthAttempt = 0;

export async function getDeviceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Check if user is calling from the web app / browser session
  try {
    const cookieStore = await cookies();
    const cookieClient = createServerClient<Database>(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    if (user) {
      return { client: cookieClient, isSession: true, user };
    }
  } catch {
    // Non-browser context / no cookies
  }

  // 2. Use real service role client if valid
  if (
    serviceKey &&
    !serviceKey.includes("your-service-role-key") &&
    !serviceKey.startsWith("sb_service_role_")
  ) {
    try {
      const serviceClient = createSupabaseClient<Database>(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return { client: serviceClient, isSession: false };
    } catch {}
  }

  // 3. Fallback: Authenticate client so RLS allows reading & updating device, schedules & events
  if (!cachedHardwareClient || Date.now() - lastAuthAttempt > 3600000) {
    const hwClient = createSupabaseClient<Database>(supabaseUrl, anonKey);
    const authEmail = process.env.SYSTEM_DEVICE_EMAIL || "sohambagad28@gmail.com";
    const authPass = process.env.SYSTEM_DEVICE_PASSWORD || "test@gmail.com";
    try {
      const { data, error } = await hwClient.auth.signInWithPassword({
        email: authEmail,
        password: authPass,
      });
      if (!error && data?.session) {
        cachedHardwareClient = hwClient;
        lastAuthAttempt = Date.now();
      }
    } catch {}
  }

  if (cachedHardwareClient) {
    return { client: cachedHardwareClient, isSession: false };
  }

  // 4. Default anon client fallback
  const fallbackClient = createSupabaseClient<Database>(supabaseUrl, anonKey);
  return { client: fallbackClient, isSession: false };
}

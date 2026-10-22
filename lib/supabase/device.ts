import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

export async function getDeviceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  // 2. Use service role client if valid key provided (for physical ESP32 requests)
  if (serviceKey && !serviceKey.includes("your-service-role-key")) {
    const serviceClient = createSupabaseClient<Database>(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return { client: serviceClient, isSession: false };
  }

  // 3. Fallback to anon client
  const fallbackClient = createSupabaseClient<Database>(supabaseUrl, anonKey);
  return { client: fallbackClient, isSession: false };
}

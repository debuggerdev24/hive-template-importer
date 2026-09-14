import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/validation/env";

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client instance or null if environment variables are not yet configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const { isConfigured, config, error } = getSupabaseEnv();

  if (!isConfigured || !config) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[SupabaseClient] Unconfigured: ${error}`);
    }
    return null;
  }

  cachedClient = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return cachedClient;
}

/**
 * Returns a Supabase admin client using the service role key for server-side transactions.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const { isConfigured, config } = getSupabaseEnv();

  if (
    !isConfigured ||
    !config ||
    !config.SUPABASE_SERVICE_ROLE_KEY ||
    config.SUPABASE_SERVICE_ROLE_KEY.includes("your-service-role-key")
  ) {
    return null;
  }

  return createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

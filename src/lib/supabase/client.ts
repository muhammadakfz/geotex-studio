import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DbResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

let cachedClient: SupabaseClient<Database> | null | undefined;

export function getSupabaseConfig(): { url: string; anonKey: string; configured: boolean } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().configured;
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();
  if (!config.configured) {
    cachedClient = null;
    return null;
  }

  if (cachedClient === undefined || cachedClient === null) {
    cachedClient = createClient<Database>(config.url, config.anonKey);
  }

  return cachedClient;
}

export function cloudUnavailableError<T>(): DbResult<T> {
  return {
    data: null,
    error: "Storage is unavailable. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable Supabase.",
  };
}

export function resetSupabaseClientForTests(): void {
  cachedClient = undefined;
}

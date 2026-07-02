import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudUnavailableError, getSupabaseClient, type DbResult } from "../supabase/client";
import type { Database } from "../supabase/types";

export async function getAuthenticatedClient<T>(): Promise<
  | { client: SupabaseClient<Database>; ownerId: string; error: null }
  | { client: null; ownerId: null; error: DbResult<T> }
> {
  const client = getSupabaseClient();
  if (!client) {
    return { client: null, ownerId: null, error: cloudUnavailableError<T>() };
  }

  const { data, error } = await client.auth.getUser();
  if (error) {
    return { client: null, ownerId: null, error: { data: null, error: error.message } };
  }

  if (!data.user) {
    return { client: null, ownerId: null, error: { data: null, error: "Sign in to use synced storage." } };
  }

  return { client, ownerId: data.user.id, error: null };
}

export function dbError<T>(error: unknown, fallback: string): DbResult<T> {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return { data: null, error: error.message };
  }

  return { data: null, error: fallback };
}

import type { StylePresetCategory, StylePresetConfig } from "../style-presets";
import { validateStylePresetConfig } from "../style-presets";
import { getAuthenticatedClient, dbError } from "./common";
import { cloudUnavailableError, getSupabaseClient, type DbResult } from "../supabase/client";
import type { Insert, Json, Row, Update } from "../supabase/types";

export type StylePresetRow = Row<"style_presets">;

export function toStylePresetInsertPayload(
  ownerId: string,
  name: string,
  category: StylePresetCategory,
  config: StylePresetConfig,
): Insert<"style_presets"> {
  return {
    owner_id: ownerId,
    name,
    category,
    config: config as unknown as Json,
    is_system: false,
  };
}

export async function getStylePresets(): Promise<DbResult<StylePresetRow[]>> {
  const client = getSupabaseClient();
  if (!client) {
    return cloudUnavailableError<StylePresetRow[]>();
  }

  const { data, error } = await client.from("style_presets").select("*").order("name");
  if (error) return dbError<StylePresetRow[]>(error, "Could not load style presets.");

  return { data: data ?? [], error: null };
}

export async function createUserStylePreset(
  name: string,
  category: StylePresetCategory,
  config: StylePresetConfig,
): Promise<DbResult<StylePresetRow>> {
  if (!validateStylePresetConfig(config)) {
    return { data: null, error: "Invalid style preset configuration." };
  }

  const auth = await getAuthenticatedClient<StylePresetRow>();
  if (auth.error) return auth.error;

  const payload = toStylePresetInsertPayload(auth.ownerId, name, category, config);
  const { data, error } = await auth.client.from("style_presets").insert(payload).select("*").single();
  if (error) return dbError<StylePresetRow>(error, "Could not create style preset.");

  return { data, error: null };
}

export async function updateUserStylePreset(id: string, data: Update<"style_presets">): Promise<DbResult<StylePresetRow>> {
  const auth = await getAuthenticatedClient<StylePresetRow>();
  if (auth.error) return auth.error;

  const { data: preset, error } = await auth.client
    .from("style_presets")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_system", false)
    .select("*")
    .single();
  if (error) return dbError<StylePresetRow>(error, "Could not update style preset.");

  return { data: preset, error: null };
}

export async function deleteUserStylePreset(id: string): Promise<DbResult<boolean>> {
  const auth = await getAuthenticatedClient<boolean>();
  if (auth.error) return auth.error;

  const { error } = await auth.client.from("style_presets").delete().eq("id", id).eq("is_system", false);
  if (error) return dbError<boolean>(error, "Could not delete style preset.");

  return { data: true, error: null };
}

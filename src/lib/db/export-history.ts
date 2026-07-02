import { getAuthenticatedClient, dbError } from "./common";
import type { DbResult } from "../supabase/client";
import type { Insert, Row } from "../supabase/types";

export type ExportHistory = Row<"export_history">;
export type ExportFormat = "tikz" | "tex" | "pgfplots";

export function toExportHistoryInsertPayload(
  diagramId: string,
  ownerId: string,
  format: ExportFormat,
  tikzCode: string,
  requiredPackages: string[],
): Insert<"export_history"> {
  return {
    diagram_id: diagramId,
    owner_id: ownerId,
    export_format: format,
    tikz_code: tikzCode,
    required_packages: requiredPackages,
    is_grayscale_safe: true,
  };
}

export async function saveExport(
  diagramId: string,
  format: ExportFormat,
  tikzCode: string,
  requiredPackages: string[],
): Promise<DbResult<ExportHistory>> {
  const auth = await getAuthenticatedClient<ExportHistory>();
  if (auth.error) return auth.error;

  const payload = toExportHistoryInsertPayload(diagramId, auth.ownerId, format, tikzCode, requiredPackages);
  const { data, error } = await auth.client.from("export_history").insert(payload).select("*").single();
  if (error) return dbError<ExportHistory>(error, "Could not save export history.");

  return { data, error: null };
}

export async function getExportHistory(diagramId: string): Promise<DbResult<ExportHistory[]>> {
  const auth = await getAuthenticatedClient<ExportHistory[]>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("export_history")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("created_at", { ascending: false });
  if (error) return dbError<ExportHistory[]>(error, "Could not load export history.");

  return { data: data ?? [], error: null };
}

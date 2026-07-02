import type { DiagramModel } from "../diagram-types";
import type { LintFinding } from "../linter";
import { getAuthenticatedClient, dbError } from "./common";
import type { DbResult } from "../supabase/client";
import type { Insert, Json, Row } from "../supabase/types";

export type DiagramVersion = Row<"diagram_versions">;

export function toDiagramVersionInsertPayload(
  diagramId: string,
  ownerId: string,
  versionNumber: number,
  objectModel: DiagramModel,
  tikzCode: string,
  lintScore: number,
  lintResults: LintFinding[],
  notes?: string,
): Insert<"diagram_versions"> {
  return {
    diagram_id: diagramId,
    owner_id: ownerId,
    version_number: versionNumber,
    object_model: objectModel as unknown as Json,
    tikz_code: tikzCode,
    linter_score: lintScore,
    lint_results: lintResults as unknown as Json,
    notes: notes ?? null,
  };
}

export async function createDiagramVersion(
  diagramId: string,
  objectModel: DiagramModel,
  tikzCode: string,
  lintScore: number,
  lintResults: LintFinding[],
): Promise<DbResult<DiagramVersion>> {
  const auth = await getAuthenticatedClient<DiagramVersion>();
  if (auth.error) return auth.error;

  const existing = await getDiagramVersions(diagramId);
  const versionNumber = existing.data ? existing.data.length + 1 : 1;
  const payload = toDiagramVersionInsertPayload(
    diagramId,
    auth.ownerId,
    versionNumber,
    objectModel,
    tikzCode,
    lintScore,
    lintResults,
  );

  const { data, error } = await auth.client.from("diagram_versions").insert(payload).select("*").single();
  if (error) return dbError<DiagramVersion>(error, "Could not save diagram version.");

  return { data, error: null };
}

export async function getDiagramVersions(diagramId: string): Promise<DbResult<DiagramVersion[]>> {
  const auth = await getAuthenticatedClient<DiagramVersion[]>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("diagram_versions")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("version_number", { ascending: false });
  if (error) return dbError<DiagramVersion[]>(error, "Could not load versions.");

  return { data: data ?? [], error: null };
}

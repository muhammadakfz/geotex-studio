import type { DiagramKind, DiagramModel } from "../diagram-types";
import { getAuthenticatedClient, dbError } from "./common";
import type { DbResult } from "../supabase/client";
import type { Insert, Json, Row, Update } from "../supabase/types";

export type DiagramRow = Row<"diagrams">;

export interface DiagramDraft {
  name: string;
  description?: string;
  diagramType: DiagramKind;
  objectModel: DiagramModel;
  activePreset?: string;
  thumbnailSvg?: string;
  latestTikzCode?: string;
  latestLintScore?: number;
}

export function toDiagramInsertPayload(
  projectId: string,
  ownerId: string,
  diagram: DiagramDraft,
): Insert<"diagrams"> {
  return {
    project_id: projectId,
    owner_id: ownerId,
    name: diagram.name,
    description: diagram.description ?? null,
    diagram_type: diagram.diagramType,
    object_model: diagram.objectModel as unknown as Json,
    active_preset: diagram.activePreset ?? null,
    thumbnail_svg: diagram.thumbnailSvg ?? null,
    latest_tikz_code: diagram.latestTikzCode ?? null,
    latest_lint_score: diagram.latestLintScore ?? null,
  };
}

export function toDiagramUpdatePayload(diagram: Partial<DiagramDraft>): Update<"diagrams"> {
  return {
    name: diagram.name,
    description: diagram.description,
    diagram_type: diagram.diagramType,
    object_model: diagram.objectModel as unknown as Json,
    active_preset: diagram.activePreset,
    thumbnail_svg: diagram.thumbnailSvg,
    latest_tikz_code: diagram.latestTikzCode,
    latest_lint_score: diagram.latestLintScore,
    updated_at: new Date().toISOString(),
  };
}

export async function createDiagram(projectId: string, diagram: DiagramDraft): Promise<DbResult<DiagramRow>> {
  const auth = await getAuthenticatedClient<DiagramRow>();
  if (auth.error) return auth.error;

  const payload = toDiagramInsertPayload(projectId, auth.ownerId, diagram);
  const { data, error } = await auth.client.from("diagrams").insert(payload).select("*").single();
  if (error) return dbError<DiagramRow>(error, "Could not save diagram.");

  return { data, error: null };
}

export async function getDiagrams(projectId: string): Promise<DbResult<DiagramRow[]>> {
  const auth = await getAuthenticatedClient<DiagramRow[]>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("diagrams")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) return dbError<DiagramRow[]>(error, "Could not load diagrams.");

  return { data: data ?? [], error: null };
}

export async function getDiagram(id: string): Promise<DbResult<DiagramRow>> {
  const auth = await getAuthenticatedClient<DiagramRow>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client.from("diagrams").select("*").eq("id", id).single();
  if (error) return dbError<DiagramRow>(error, "Could not load diagram.");

  return { data, error: null };
}

export async function updateDiagram(id: string, data: Partial<DiagramDraft>): Promise<DbResult<DiagramRow>> {
  const auth = await getAuthenticatedClient<DiagramRow>();
  if (auth.error) return auth.error;

  const { data: diagram, error } = await auth.client
    .from("diagrams")
    .update(toDiagramUpdatePayload(data))
    .eq("id", id)
    .select("*")
    .single();
  if (error) return dbError<DiagramRow>(error, "Could not update diagram.");

  return { data: diagram, error: null };
}

export async function deleteDiagram(id: string): Promise<DbResult<boolean>> {
  const auth = await getAuthenticatedClient<boolean>();
  if (auth.error) return auth.error;

  const { error } = await auth.client.from("diagrams").delete().eq("id", id);
  if (error) return dbError<boolean>(error, "Could not delete diagram.");

  return { data: true, error: null };
}

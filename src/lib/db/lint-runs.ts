import type { LintFinding, LintResult } from "../linter";
import { getAuthenticatedClient, dbError } from "./common";
import type { DbResult } from "../supabase/client";
import type { Insert, Json, Row } from "../supabase/types";

export type LintRun = Row<"lint_runs">;

export function toLintRunInsertPayload(
  diagramId: string,
  ownerId: string,
  score: number,
  grade: LintResult["grade"],
  findings: LintFinding[],
): Insert<"lint_runs"> {
  return {
    diagram_id: diagramId,
    owner_id: ownerId,
    score,
    grade,
    findings: findings as unknown as Json,
  };
}

export async function saveLintRun(
  diagramId: string,
  score: number,
  grade: LintResult["grade"],
  findings: LintFinding[],
): Promise<DbResult<LintRun>> {
  const auth = await getAuthenticatedClient<LintRun>();
  if (auth.error) return auth.error;

  const payload = toLintRunInsertPayload(diagramId, auth.ownerId, score, grade, findings);
  const { data, error } = await auth.client.from("lint_runs").insert(payload).select("*").single();
  if (error) return dbError<LintRun>(error, "Could not save lint run.");

  return { data, error: null };
}

export async function getLintRuns(diagramId: string): Promise<DbResult<LintRun[]>> {
  const auth = await getAuthenticatedClient<LintRun[]>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("lint_runs")
    .select("*")
    .eq("diagram_id", diagramId)
    .order("created_at", { ascending: false });
  if (error) return dbError<LintRun[]>(error, "Could not load lint runs.");

  return { data: data ?? [], error: null };
}

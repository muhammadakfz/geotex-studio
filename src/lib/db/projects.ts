import { getAuthenticatedClient, dbError } from "./common";
import type { DbResult } from "../supabase/client";
import type { Insert, Row, Update } from "../supabase/types";

export type Project = Row<"projects">;

export function toProjectInsertPayload(ownerId: string, name: string, description?: string): Insert<"projects"> {
  return {
    owner_id: ownerId,
    name,
    description: description ?? null,
  };
}

export async function createProject(name: string, description?: string): Promise<DbResult<Project>> {
  const auth = await getAuthenticatedClient<Project>();
  if (auth.error) return auth.error;

  const payload = toProjectInsertPayload(auth.ownerId, name, description);
  const { data, error } = await auth.client.from("projects").insert(payload).select("*").single();
  if (error) return dbError<Project>(error, "Could not create project.");

  return { data, error: null };
}

export async function getProjects(): Promise<DbResult<Project[]>> {
  const auth = await getAuthenticatedClient<Project[]>();
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return dbError<Project[]>(error, "Could not load projects.");

  return { data: data ?? [], error: null };
}

export async function updateProject(id: string, data: Update<"projects">): Promise<DbResult<Project>> {
  const auth = await getAuthenticatedClient<Project>();
  if (auth.error) return auth.error;

  const { data: project, error } = await auth.client
    .from("projects")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return dbError<Project>(error, "Could not update project.");

  return { data: project, error: null };
}

export async function deleteProject(id: string): Promise<DbResult<boolean>> {
  const auth = await getAuthenticatedClient<boolean>();
  if (auth.error) return auth.error;

  const { error } = await auth.client.from("projects").delete().eq("id", id);
  if (error) return dbError<boolean>(error, "Could not delete project.");

  return { data: true, error: null };
}

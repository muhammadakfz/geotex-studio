"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, RefreshCw, Save, Trash2, UploadCloud } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";
import type { LintResult } from "@/lib/linter";
import { createDiagram, getDiagram, getDiagrams, updateDiagram, type DiagramRow } from "@/lib/db/diagrams";
import { createProject, deleteProject, getProjects, type Project } from "@/lib/db/projects";

interface ProjectPanelProps {
  cloudEnabled: boolean;
  diagram: DiagramModel;
  tikzCode: string;
  lintResult: LintResult;
  activePresetId: string;
  savedDiagramId: string | null;
  onLoadDiagram: (diagram: DiagramModel, diagramId: string, presetId?: string | null) => void;
  onSavedDiagram: (diagramId: string) => void;
  onMessage: (message: string) => void;
}

export function ProjectPanel({
  cloudEnabled,
  diagram,
  tikzCode,
  lintResult,
  activePresetId,
  savedDiagramId,
  onLoadDiagram,
  onSavedDiagram,
  onMessage,
}: ProjectPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedDiagramId, setSelectedDiagramId] = useState("");
  const [newProjectName, setNewProjectName] = useState("GeoTeX Project");
  const [busy, setBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!cloudEnabled) return;
    const result = await getProjects();
    if (result.error) {
      onMessage(result.error);
      return;
    }

    const data = result.data ?? [];
    setProjects(data);
    if (!selectedProjectId && data[0]) {
      setSelectedProjectId(data[0].id);
    }
  }, [cloudEnabled, onMessage, selectedProjectId]);

  const loadDiagrams = useCallback(
    async (projectId: string) => {
      if (!cloudEnabled || !projectId) return;
      const result = await getDiagrams(projectId);
      if (result.error) {
        onMessage(result.error);
        return;
      }

      const data = result.data ?? [];
      setDiagrams(data);
      setSelectedDiagramId(data[0]?.id ?? "");
    },
    [cloudEnabled, onMessage],
  );

  useEffect(() => {
    let cancelled = false;
    if (!cloudEnabled) return;

    getProjects().then((result) => {
      if (cancelled) return;
      if (result.error) {
        onMessage(result.error);
        return;
      }

      const data = result.data ?? [];
      setProjects(data);
      if (!selectedProjectId && data[0]) {
        setSelectedProjectId(data[0].id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, onMessage, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    if (!cloudEnabled || !selectedProjectId) return;

    getDiagrams(selectedProjectId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        onMessage(result.error);
        return;
      }

      const data = result.data ?? [];
      setDiagrams(data);
      setSelectedDiagramId(data[0]?.id ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, onMessage, selectedProjectId]);

  async function handleNewProject() {
    if (!cloudEnabled) {
      onMessage("Connect storage before creating projects.");
      return;
    }

    setBusy(true);
    const result = await createProject(newProjectName);
    setBusy(false);
    if (result.error || !result.data) {
      onMessage(result.error ?? "Could not create project.");
      return;
    }

    setProjects((current) => [result.data, ...current]);
    setSelectedProjectId(result.data.id);
    onMessage("Project created.");
  }

  async function handleSaveDiagram() {
    if (!cloudEnabled) {
      onMessage("Connect storage before saving diagrams.");
      return;
    }

    let projectId = selectedProjectId;
    setBusy(true);

    if (!projectId) {
      const project = await createProject(newProjectName);
      if (project.error || !project.data) {
        setBusy(false);
        onMessage(project.error ?? "Could not create project.");
        return;
      }
      projectId = project.data.id;
      setProjects((current) => [project.data, ...current]);
      setSelectedProjectId(projectId);
    }

    const draft = {
      name: diagram.name,
      description: diagram.description,
      diagramType: diagram.diagramType,
      objectModel: diagram,
      activePreset: activePresetId,
      latestTikzCode: tikzCode,
      latestLintScore: lintResult.score,
    };

    const result = savedDiagramId
      ? await updateDiagram(savedDiagramId, draft)
      : await createDiagram(projectId, draft);

    setBusy(false);
    if (result.error || !result.data) {
      onMessage(result.error ?? "Could not save diagram.");
      return;
    }

    onSavedDiagram(result.data.id);
    setSelectedDiagramId(result.data.id);
    await loadDiagrams(projectId);
    onMessage("Diagram saved.");
  }

  async function handleLoadDiagram() {
    if (!selectedDiagramId) {
      onMessage("Select a diagram to load.");
      return;
    }

    setBusy(true);
    const result = await getDiagram(selectedDiagramId);
    setBusy(false);
    if (result.error || !result.data) {
      onMessage(result.error ?? "Could not load diagram.");
      return;
    }

    onLoadDiagram(
      result.data.object_model as unknown as DiagramModel,
      result.data.id,
      result.data.active_preset,
    );
    onMessage("Diagram loaded.");
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) {
      onMessage("Select a project to delete.");
      return;
    }

    const projectName = projects.find((project) => project.id === selectedProjectId)?.name ?? "this project";
    if (!window.confirm(`Delete ${projectName}? Diagrams inside it will also be removed.`)) return;

    setBusy(true);
    const result = await deleteProject(selectedProjectId);
    setBusy(false);
    if (result.error) {
      onMessage(result.error);
      return;
    }

    const remaining = projects.filter((project) => project.id !== selectedProjectId);
    setProjects(remaining);
    setSelectedProjectId(remaining[0]?.id ?? "");
    setDiagrams([]);
    setSelectedDiagramId("");
    onMessage("Project deleted.");
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Project</span>
        <span className="status-pill">{projects.length}</span>
      </div>
      <div className="grid gap-2">
        <input
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          disabled={!cloudEnabled}
          className="property-input w-full disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleNewProject}
          disabled={busy || !cloudEnabled}
          title="New Project"
          className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
          New Project
        </button>
        <select
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          disabled={!cloudEnabled}
          className="property-input w-full disabled:opacity-50"
        >
          <option value="">Project List</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={selectedDiagramId}
          onChange={(event) => setSelectedDiagramId(event.target.value)}
          disabled={!cloudEnabled}
          className="property-input w-full disabled:opacity-50"
        >
          <option value="">Load Diagram</option>
          {diagrams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSaveDiagram}
          disabled={busy || !cloudEnabled}
          title="Save Diagram"
          className="icon-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden />
          Save Diagram
        </button>
        <button
          type="button"
          onClick={handleLoadDiagram}
          disabled={busy || !cloudEnabled || !selectedDiagramId}
          title="Load Diagram"
          className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" aria-hidden />
          Load Diagram
        </button>
        <button
          type="button"
          onClick={() => void loadProjects()}
          disabled={busy || !cloudEnabled}
          title="Refresh projects"
          className="icon-only disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteProject()}
          disabled={busy || !cloudEnabled || !selectedProjectId}
          title="Delete Project"
          className="icon-only danger-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

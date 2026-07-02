"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Download,
  FilePlus2,
  ListChecks,
  Redo2,
  Undo2,
  Wand2,
} from "lucide-react";
import { AccessGate } from "@/components/AccessGate";
import { CompatibilityPanel } from "@/components/CompatibilityPanel";
import { DiagramLinterPanel } from "@/components/DiagramLinterPanel";
import { ExportHistoryPanel } from "@/components/ExportHistoryPanel";
import { FigureBuilderPanel } from "@/components/FigureBuilderPanel";
import { GeoGebraCanvas } from "@/components/GeoGebraCanvas";
import { ObjectList } from "@/components/ObjectList";
import { type ObjectPatch, PropertiesPanel } from "@/components/PropertiesPanel";
import { ProjectPanel } from "@/components/ProjectPanel";
import { StylePresetPanel } from "@/components/StylePresetPanel";
import { TikZOutputPanel } from "@/components/TikZOutputPanel";
import { UserMenu } from "@/components/UserMenu";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";
import { applySafeFixes, beautifyDiagram } from "@/lib/beautify";
import {
  createBlankDiagram,
  createObjectFromTool,
  snapPoint,
  type EditorTool,
} from "@/lib/diagram-editor";
import type { DiagramModel, DiagramObject, DiagramViewport, PointCoordinate } from "@/lib/diagram-types";
import { applyObjectGeometryPatch } from "@/lib/diagram-geometry";
import { saveExport } from "@/lib/db/export-history";
import { saveLintRun } from "@/lib/db/lint-runs";
import { lintDiagram, type LintResult } from "@/lib/linter";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { exportTikz } from "@/lib/tikz-exporter";

function patchObject(object: DiagramObject, patch: ObjectPatch): DiagramObject {
  const { style, text, geometry, ...rest } = patch;
  const base = geometry ? applyObjectGeometryPatch(object, geometry) : object;
  const next = {
    ...base,
    ...rest,
    style: {
      ...base.style,
      ...style,
    },
  };

  if (object.type === "Label" && text !== undefined) {
    return { ...next, text } as DiagramObject;
  }

  return next as DiagramObject;
}

function updateDiagramObject(diagram: DiagramModel, objectId: string, patch: ObjectPatch): DiagramModel {
  return {
    ...diagram,
    objects: diagram.objects.map((object) =>
      object.id === objectId ? patchObject(object, patch) : object,
    ),
    metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
  };
}

export default function Home() {
  const initialDiagram = useMemo(() => createBlankDiagram(), []);
  const [diagram, setDiagram] = useState<DiagramModel>(initialDiagram);
  const diagramRef = useRef<DiagramModel>(initialDiagram);
  const [undoStack, setUndoStack] = useState<DiagramModel[]>([]);
  const [redoStack, setRedoStack] = useState<DiagramModel[]>([]);
  const [activePresetId, setActivePresetId] = useState(initialDiagram.metadata?.preset ?? "thesis-paper");
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [savedDiagramId, setSavedDiagramId] = useState<string | null>(null);
  const [lintResult, setLintResult] = useState<LintResult>(() => lintDiagram(initialDiagram));
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [exportRefreshToken, setExportRefreshToken] = useState(0);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [pendingPoints, setPendingPoints] = useState<PointCoordinate[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const cloudEnabled = isSupabaseConfigured();
  const tikz = useMemo(() => exportTikz(diagram), [diagram]);
  const selectedObject = useMemo(
    () => diagram.objects.find((object) => object.id === selectedObjectIds[0]),
    [diagram.objects, selectedObjectIds],
  );

  function commitDiagram(next: DiagramModel, message?: string, baseDiagram: DiagramModel = diagramRef.current) {
    diagramRef.current = next;
    setUndoStack((current) => [baseDiagram, ...current].slice(0, 80));
    setRedoStack([]);
    setDiagram(next);
    setLintResult(lintDiagram(next));
    if (message) setStatusMessage(message);
  }

  function replaceDiagram(next: DiagramModel, message?: string) {
    diagramRef.current = next;
    setUndoStack([]);
    setRedoStack([]);
    setDiagram(next);
    setLintResult(lintDiagram(next));
    setSelectedObjectIds([]);
    setPendingPoints([]);
    if (message) setStatusMessage(message);
  }

  function undo() {
    const previous = undoStack[0];
    if (!previous) return;

    setUndoStack((current) => current.slice(1));
    setRedoStack((current) => [diagram, ...current].slice(0, 80));
    diagramRef.current = previous;
    setDiagram(previous);
    setLintResult(lintDiagram(previous));
    setSelectedObjectIds([]);
    setPendingPoints([]);
    setStatusMessage("Undo.");
  }

  function redo() {
    const next = redoStack[0];
    if (!next) return;

    setRedoStack((current) => current.slice(1));
    setUndoStack((current) => [diagram, ...current].slice(0, 80));
    diagramRef.current = next;
    setDiagram(next);
    setLintResult(lintDiagram(next));
    setSelectedObjectIds([]);
    setPendingPoints([]);
    setStatusMessage("Redo.");
  }

  function newBlankFigure() {
    const next = createBlankDiagram();
    commitDiagram(next, "New figure.");
    setActivePresetId(next.metadata?.preset ?? "thesis-paper");
    setSelectedObjectIds([]);
    setSavedDiagramId(null);
    setActiveTool("select");
    setPendingPoints([]);
  }

  function handleToolChange(tool: EditorTool) {
    setActiveTool(tool);
    setPendingPoints([]);
    setStatusMessage("Ready.");
  }

  function handleCanvasPoint(point: PointCoordinate) {
    const snapped = snapPoint(point, snapToGrid);
    const result = createObjectFromTool(activeTool, snapped, pendingPoints, diagram.objects, labelInput);

    setPendingPoints(result.pendingPoints);
    if (!result.object) {
      setStatusMessage(`${activeTool} start: (${snapped.x}, ${snapped.y}).`);
      return;
    }

    const next: DiagramModel = {
      ...diagram,
      objects: [...diagram.objects, result.object],
      metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, `${result.object.type} created.`);
    setSelectedObjectIds([result.object.id]);
  }

  function handleGridChange(value: boolean) {
    const next = {
      ...diagramRef.current,
      gridVisible: value,
      metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
    };
    diagramRef.current = next;
    setDiagram(next);
    setStatusMessage(value ? "Grid on." : "Grid off.");
  }

  function handleCoordinatesChange(value: boolean) {
    const next = {
      ...diagramRef.current,
      coordinatesVisible: value,
      metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
    };
    diagramRef.current = next;
    setDiagram(next);
    setStatusMessage(value ? "Coordinates on." : "Coordinates off.");
  }

  function updateSelectedObject(patch: ObjectPatch) {
    const objectId = selectedObjectIds[0];
    if (!objectId) return;
    const currentDiagram = diagramRef.current;
    commitDiagram(updateDiagramObject(currentDiagram, objectId, patch), "Properties updated.", currentDiagram);
  }

  function deleteSelectedObjects() {
    if (selectedObjectIds.length === 0) return;

    const ids = new Set(selectedObjectIds);
    const next = {
      ...diagram,
      objects: diagram.objects.filter((object) => !ids.has(object.id)),
      metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, selectedObjectIds.length > 1 ? "Objects deleted." : "Object deleted.");
    setSelectedObjectIds([]);
  }

  function handleCanvasCommit(next: DiagramModel, message?: string) {
    commitDiagram(next, message, diagram);
  }

  function handleViewportChange(viewport: DiagramViewport) {
    setDiagram((current) => {
      const next = {
        ...current,
        viewport,
        metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
      };
      diagramRef.current = next;
      return next;
    });
  }

  function handlePresetChange(presetId: string) {
    setActivePresetId(presetId);
    commitDiagram(beautifyDiagram(diagram, presetId), "Preset applied.");
  }

  function handleBeautify() {
    commitDiagram(beautifyDiagram(diagram, activePresetId), "Beautified for TeX.");
  }

  async function handleRunLinter() {
    const result = lintDiagram(diagram);
    setLintResult(result);
    if (cloudEnabled && savedDiagramId) {
      const saved = await saveLintRun(savedDiagramId, result.score, result.grade, result.findings);
      setStatusMessage(saved.error ?? "Lint result saved.");
      return;
    }
    setStatusMessage("Linter complete.");
  }

  function handleSafeFixes() {
    commitDiagram(applySafeFixes(diagram, activePresetId), "Safe fixes applied.");
  }

  async function recordExport(format: "tikz" | "tex") {
    if (!cloudEnabled || !savedDiagramId) return;
    const result = await saveExport(savedDiagramId, format, tikz.code, tikz.requiredPackages);
    if (!result.error) {
      setExportRefreshToken((current) => current + 1);
    }
  }

  async function handleCopyTikz() {
    await navigator.clipboard.writeText(tikz.code);
    await recordExport("tikz");
    setStatusMessage("TikZ copied.");
  }

  async function handleDownloadTex() {
    const blob = new Blob([tikz.code], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${diagram.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.tex`;
    anchor.click();
    URL.revokeObjectURL(url);
    await recordExport("tex");
    setStatusMessage(".tex downloaded.");
  }

  function handleLoadDiagram(next: DiagramModel, diagramId: string, presetId?: string | null) {
    replaceDiagram(next, "Diagram loaded.");
    setActivePresetId(presetId ?? next.metadata?.preset ?? "thesis-paper");
    setSavedDiagramId(diagramId);
  }

  useEffect(() => {
    function isEditingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;

      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (command && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (isEditingTarget(event.target)) return;

      if (key === "escape") {
        event.preventDefault();
        setActiveTool("select");
        setPendingPoints([]);
        setStatusMessage("Ready.");
        return;
      }

      if ((key === "delete" || key === "backspace") && selectedObjectIds.length > 0) {
        event.preventDefault();
        deleteSelectedObjects();
        return;
      }

      if (key === "v") handleToolChange("select");
      if (key === "h") handleToolChange("hand");
      if (key === "p") handleToolChange("point");
      if (key === "s") handleToolChange("segment");
      if (key === "c") handleToolChange("circle");
      if (key === "r") handleToolChange("rectangle");
      if (key === "t") handleToolChange("triangle");
      if (key === "a") handleToolChange("vector");
      if (key === "l") handleToolChange("label");
      if (key === "g") handleGridChange(!diagram.gridVisible);
      if (key === "x") handleCoordinatesChange(!(diagram.coordinatesVisible ?? true));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <AccessGate>
      {(session) => (
        <div className="flex h-dvh flex-col overflow-hidden bg-stone-100 text-stone-950">
          <header className="studio-header">
            <div className="studio-brand">
              <h1 className="studio-title">GeoTeX Studio</h1>
              <p className="studio-subtitle">TeX-ready figure workspace</p>
            </div>

            <div className="studio-actions">
              <button type="button" onClick={newBlankFigure} title="New figure" className="icon-button-secondary shrink-0">
                <FilePlus2 className="h-4 w-4" aria-hidden />
                New
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={undoStack.length === 0}
                title="Undo (Ctrl+Z)"
                className="icon-only shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoStack.length === 0}
                title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
                className="icon-only shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={handleBeautify} title="Beautify for TeX" className="icon-button shrink-0">
                <Wand2 className="h-4 w-4" aria-hidden />
                Beautify
              </button>
              <button type="button" onClick={() => void handleRunLinter()} title="Run Diagram Linter" className="icon-button-secondary shrink-0">
                <ListChecks className="h-4 w-4" aria-hidden />
                Lint
              </button>
              <button type="button" onClick={() => void handleCopyTikz()} title="Copy TikZ" className="icon-only shrink-0">
                <Clipboard className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => void handleDownloadTex()} title="Download .tex" className="icon-only shrink-0">
                <Download className="h-4 w-4" aria-hidden />
              </button>
              <UserMenu user={{ email: session.email }} onSignOut={() => void session.signOut()} />
            </div>
          </header>

          <main className="studio-shell">
            <aside className="studio-tools">
              <FigureBuilderPanel
                activeTool={activeTool}
                labelInput={labelInput}
                snapToGrid={snapToGrid}
                gridVisible={diagram.gridVisible}
                coordinatesVisible={diagram.coordinatesVisible ?? true}
                hasSelection={selectedObjectIds.length > 0}
                pendingCount={pendingPoints.length}
                onToolChange={handleToolChange}
                onLabelChange={setLabelInput}
                onSnapChange={setSnapToGrid}
                onGridChange={handleGridChange}
                onCoordinatesChange={handleCoordinatesChange}
                onDeleteSelected={deleteSelectedObjects}
              />
            </aside>

            <aside className="studio-left-panel">
              <div className="space-y-3">
                <ObjectList
                  diagram={diagram}
                  selectedObjectIds={selectedObjectIds}
                  onSelectObjects={setSelectedObjectIds}
                />
              </div>
            </aside>

            <section className="studio-canvas-panel">
              <div className="studio-canvas-bar">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-normal">{diagram.name}</h2>
                  <p className="truncate text-xs text-stone-500">{statusMessage}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-pill">{diagram.objects.length} objects</span>
                  <span className="status-pill">Score {lintResult.score}</span>
                </div>
              </div>
              <div className="studio-canvas-frame">
                <GeoGebraCanvas
                  diagram={diagram}
                  selectedObjectIds={selectedObjectIds}
                  activeTool={activeTool}
                  pendingPoints={pendingPoints}
                  coordinatesVisible={diagram.coordinatesVisible ?? true}
                  onSelectObjects={setSelectedObjectIds}
                  onCanvasPoint={handleCanvasPoint}
                  onCommitDiagram={handleCanvasCommit}
                  onViewportChange={handleViewportChange}
                />
              </div>
            </section>

            <aside className="studio-inspector">
              <div className="space-y-3">
                <PropertiesPanel object={selectedObject} onChange={updateSelectedObject} />
                {cloudEnabled ? (
                  <ProjectPanel
                    cloudEnabled={cloudEnabled}
                    diagram={diagram}
                    tikzCode={tikz.code}
                    lintResult={lintResult}
                    activePresetId={activePresetId}
                    savedDiagramId={savedDiagramId}
                    onLoadDiagram={handleLoadDiagram}
                    onSavedDiagram={setSavedDiagramId}
                    onMessage={setStatusMessage}
                  />
                ) : null}
                <StylePresetPanel
                  activePresetId={activePresetId}
                  cloudEnabled={cloudEnabled}
                  onChange={handlePresetChange}
                  onMessage={setStatusMessage}
                />
                <DiagramLinterPanel
                  result={lintResult}
                  onRun={() => void handleRunLinter()}
                  onApplyFixes={handleSafeFixes}
                />
                <TikZOutputPanel
                  diagram={diagram}
                  code={tikz.code}
                  onCopy={() => void handleCopyTikz()}
                  onDownload={() => void handleDownloadTex()}
                />
                <CompatibilityPanel diagram={diagram} lintResult={lintResult} />
                {cloudEnabled ? (
                  <>
                    <VersionHistoryPanel
                      cloudEnabled={cloudEnabled}
                      diagramId={savedDiagramId}
                      diagram={diagram}
                      tikzCode={tikz.code}
                      lintResult={lintResult}
                      onMessage={setStatusMessage}
                    />
                    <ExportHistoryPanel
                      cloudEnabled={cloudEnabled}
                      diagramId={savedDiagramId}
                      refreshToken={exportRefreshToken}
                      onMessage={setStatusMessage}
                    />
                  </>
                ) : null}
              </div>
            </aside>
          </main>
        </div>
      )}
    </AccessGate>
  );
}

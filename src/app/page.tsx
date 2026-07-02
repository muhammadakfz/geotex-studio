"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Download,
  FilePlus2,
  Redo2,
  Undo2,
} from "lucide-react";
import { AccessGate } from "@/components/AccessGate";
import { FigureBuilderPanel } from "@/components/FigureBuilderPanel";
import { GeoGebraCanvas } from "@/components/GeoGebraCanvas";
import { LayerPanel } from "@/components/LayerPanel";
import { type ObjectPatch, PropertiesPanel } from "@/components/PropertiesPanel";
import { ProjectPanel } from "@/components/ProjectPanel";
import { TikZOutputPanel } from "@/components/TikZOutputPanel";
import { UserMenu } from "@/components/UserMenu";
import {
  createBlankDiagram,
  createObjectFromDrag,
  createObjectFromTool,
  snapPoint,
  type EditorTool,
} from "@/lib/diagram-editor";
import type { DiagramModel, DiagramObject, DiagramViewport, PointCoordinate } from "@/lib/diagram-types";
import { applyObjectGeometryPatch, insertPolygonVertex } from "@/lib/diagram-geometry";
import { saveExport } from "@/lib/db/export-history";
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

function pointDistance(a: PointCoordinate, b: PointCoordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestPointOnSegment(point: PointCoordinate, start: PointCoordinate, end: PointCoordinate): PointCoordinate {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    x: Number((start.x + t * dx).toFixed(3)),
    y: Number((start.y + t * dy).toFixed(3)),
  };
}

function closestPointOnLine(point: PointCoordinate, start: PointCoordinate, end: PointCoordinate): PointCoordinate {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  return {
    x: Number((start.x + t * dx).toFixed(3)),
    y: Number((start.y + t * dy).toFixed(3)),
  };
}

function closestPointOnCircle(point: PointCoordinate, center: PointCoordinate, radius: number): PointCoordinate {
  const angle = Math.atan2(point.y - center.y, point.x - center.x);
  return {
    x: Number((center.x + Math.cos(angle) * radius).toFixed(3)),
    y: Number((center.y + Math.sin(angle) * radius).toFixed(3)),
  };
}

interface ObjectSnapTarget {
  point: PointCoordinate;
  distance: number;
  objectId?: string;
  kind?: "point" | "segment" | "line" | "circle" | "polygon-edge";
  edgeIndex?: number;
}

function findObjectSnapTarget(point: PointCoordinate, diagram: DiagramModel): ObjectSnapTarget {
  const rangeX = diagram.viewport.maxX - diagram.viewport.minX;
  const rangeY = diagram.viewport.maxY - diagram.viewport.minY;
  const tolerance = Math.max(Math.max(rangeX, rangeY) / 55, 0.045);
  let nearest: ObjectSnapTarget = { point, distance: tolerance };

  function consider(candidate: PointCoordinate, target?: Omit<ObjectSnapTarget, "point" | "distance">) {
    const distance = pointDistance(point, candidate);
    if (distance <= nearest.distance) {
      nearest = { point: candidate, distance, ...target };
    }
  }

  diagram.objects.forEach((object) => {
    if (!object.visibility) return;

    if (object.type === "Point") {
      consider(object.coordinates, { objectId: object.id, kind: "point" });
    } else if (object.type === "Segment" || object.type === "Vector") {
      consider(closestPointOnSegment(point, object.start, object.end), { objectId: object.id, kind: "segment" });
    } else if (object.type === "Line") {
      consider(closestPointOnLine(point, object.through[0], object.through[1]), { objectId: object.id, kind: "line" });
    } else if (object.type === "Circle") {
      consider(closestPointOnCircle(point, object.center, object.radius), { objectId: object.id, kind: "circle" });
    } else if (object.type === "Polygon") {
      object.points.forEach((start, index) => {
        consider(
          closestPointOnSegment(point, start, object.points[(index + 1) % object.points.length]),
          { objectId: object.id, kind: "polygon-edge", edgeIndex: index },
        );
      });
    }
  });

  return nearest;
}

function snapToDiagramObject(point: PointCoordinate, diagram: DiagramModel): PointCoordinate {
  return findObjectSnapTarget(point, diagram).point;
}

function isObjectSnapTool(tool: EditorTool): boolean {
  return ["point", "angle", "segment", "vector", "triangle", "circle"].includes(tool);
}

export default function Home() {
  const initialDiagram = useMemo(() => createBlankDiagram(), []);
  const [diagram, setDiagram] = useState<DiagramModel>(initialDiagram);
  const diagramRef = useRef<DiagramModel>(initialDiagram);
  const [undoStack, setUndoStack] = useState<DiagramModel[]>([]);
  const [redoStack, setRedoStack] = useState<DiagramModel[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [savedDiagramId, setSavedDiagramId] = useState<string | null>(null);
  const [lintResult, setLintResult] = useState<LintResult>(() => lintDiagram(initialDiagram));
  const [, setStatusMessage] = useState("Ready.");
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [pendingPoints, setPendingPoints] = useState<PointCoordinate[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [includeCartesianExport, setIncludeCartesianExport] = useState(false);
  const cloudEnabled = isSupabaseConfigured();
  const activePresetId = "manual";
  const tikz = useMemo(
    () => exportTikz(diagram, { includeCartesian: includeCartesianExport }),
    [diagram, includeCartesianExport],
  );
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

  function snapCreationPoint(point: PointCoordinate): PointCoordinate {
    if (isObjectSnapTool(activeTool)) {
      const objectPoint = snapToDiagramObject(point, diagramRef.current);
      if (pointDistance(point, objectPoint) > 0.0001) return objectPoint;
    }

    return snapPoint(point, snapToGrid);
  }

  function handleCanvasPoint(point: PointCoordinate) {
    if (activeTool === "point" && pendingPoints.length === 0) {
      const currentDiagram = diagramRef.current;
      const target = findObjectSnapTarget(point, currentDiagram);

      if (target.kind === "polygon-edge" && target.objectId && target.edgeIndex !== undefined) {
        const pinnedPoint = snapPoint(target.point, false);
        const edgeIndex = target.edgeIndex;
        const nextObjects = currentDiagram.objects.map((object) => {
          if (object.id !== target.objectId || object.type !== "Polygon") return object;

          return insertPolygonVertex(object, edgeIndex, pinnedPoint);
        });
        const next: DiagramModel = {
          ...currentDiagram,
          objects: nextObjects,
          metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
        };
        commitDiagram(next, "Vertex pinned to object.");
        setSelectedObjectIds([target.objectId]);
        setPendingPoints([]);
        return;
      }
    }

    const snapped = snapCreationPoint(point);
    const result = createObjectFromTool(activeTool, snapped, pendingPoints, diagram.objects, "");

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

  function handleCanvasDragCreate(start: PointCoordinate, end: PointCoordinate) {
    const currentDiagram = diagramRef.current;
    const snappedStart = snapCreationPoint(start);
    const snappedEnd = snapCreationPoint(end);
    const object = createObjectFromDrag(activeTool, snappedStart, snappedEnd, currentDiagram.objects, "");

    if (!object) return;

    const next: DiagramModel = {
      ...currentDiagram,
      objects: [...currentDiagram.objects, object],
      metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, `${object.type} created.`);
    setPendingPoints([]);
    setSelectedObjectIds([object.id]);
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

  function handleLayerAction(action: "front" | "up" | "down" | "back") {
    if (selectedObjectIds.length === 0) return;

    const selected = new Set(selectedObjectIds);
    const objects = [...diagram.objects];
    let nextObjects: DiagramObject[];

    if (action === "front") {
      nextObjects = [...objects.filter((object) => !selected.has(object.id)), ...objects.filter((object) => selected.has(object.id))];
    } else if (action === "back") {
      nextObjects = [...objects.filter((object) => selected.has(object.id)), ...objects.filter((object) => !selected.has(object.id))];
    } else {
      nextObjects = [...objects];
      if (action === "up") {
        for (let index = nextObjects.length - 2; index >= 0; index -= 1) {
          if (selected.has(nextObjects[index].id) && !selected.has(nextObjects[index + 1].id)) {
            [nextObjects[index], nextObjects[index + 1]] = [nextObjects[index + 1], nextObjects[index]];
          }
        }
      } else {
        for (let index = 1; index < nextObjects.length; index += 1) {
          if (selected.has(nextObjects[index].id) && !selected.has(nextObjects[index - 1].id)) {
            [nextObjects[index - 1], nextObjects[index]] = [nextObjects[index], nextObjects[index - 1]];
          }
        }
      }
    }

    commitDiagram(
      {
        ...diagram,
        objects: nextObjects,
        metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
      },
      "Layer updated.",
    );
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

  async function recordExport(format: "tikz" | "tex") {
    if (!cloudEnabled || !savedDiagramId) return;
    await saveExport(savedDiagramId, format, tikz.code, tikz.requiredPackages);
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

  function handleLoadDiagram(next: DiagramModel, diagramId: string) {
    replaceDiagram(next, "Diagram loaded.");
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

      if (command && key === "a") {
        event.preventDefault();
        setSelectedObjectIds(diagramRef.current.objects.map((object) => object.id));
        setActiveTool("select");
        setPendingPoints([]);
        setStatusMessage("All objects selected.");
        return;
      }

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
      if (key === "q") handleToolChange("angle");
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
        <div className="flex h-dvh flex-col overflow-hidden bg-white text-black">
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
                snapToGrid={snapToGrid}
                gridVisible={diagram.gridVisible}
                coordinatesVisible={diagram.coordinatesVisible ?? true}
                hasSelection={selectedObjectIds.length > 0}
                pendingCount={pendingPoints.length}
                onToolChange={handleToolChange}
                onSnapChange={setSnapToGrid}
                onGridChange={handleGridChange}
                onCoordinatesChange={handleCoordinatesChange}
                onDeleteSelected={deleteSelectedObjects}
              />
            </aside>

            <section className="studio-canvas-panel">
              <div className="studio-canvas-frame">
                <GeoGebraCanvas
                  diagram={diagram}
                  selectedObjectIds={selectedObjectIds}
                  activeTool={activeTool}
                  pendingPoints={pendingPoints}
                  coordinatesVisible={diagram.coordinatesVisible ?? true}
                  onSelectObjects={setSelectedObjectIds}
                  onCanvasPoint={handleCanvasPoint}
                  onCanvasDragCreate={handleCanvasDragCreate}
                  onCommitDiagram={handleCanvasCommit}
                  onViewportChange={handleViewportChange}
                />
              </div>
            </section>

            <aside className="studio-inspector">
              <div className="space-y-3">
                <PropertiesPanel object={selectedObject} onChange={updateSelectedObject} />
                <LayerPanel
                  diagram={diagram}
                  selectedObjectIds={selectedObjectIds}
                  onSelectObjects={setSelectedObjectIds}
                  onLayerAction={handleLayerAction}
                />
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
                <TikZOutputPanel
                  diagram={diagram}
                  code={tikz.code}
                  includeCartesian={includeCartesianExport}
                  onIncludeCartesianChange={setIncludeCartesianExport}
                  onCopy={() => void handleCopyTikz()}
                  onDownload={() => void handleDownloadTex()}
                />
              </div>
            </aside>
          </main>
        </div>
      )}
    </AccessGate>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBlankDiagram,
  createObjectFromDrag,
  createObjectFromTool,
  createPenPath,
  type EditorTool,
} from "@/lib/diagram-editor";
import type { DiagramModel, DiagramObject, DiagramViewport, GeometryAnchor, PointCoordinate } from "@/lib/diagram-types";
import { insertPolygonVertex } from "@/lib/diagram-geometry";
import { inferAngleAtPoint } from "@/lib/diagram-angle";
import { syncLinkedDiagram } from "@/lib/diagram-links";
import { lintDiagram, type LintResult } from "@/lib/linter";
import { createFunctionPlotObject } from "@/lib/quick-constructs";
import type { ObjectPatch } from "@/components/PropertiesPanel";
import { updateDiagramObject } from "@/lib/diagram-patch";
import {
  attachCreatedObject,
  createAngleObject,
  findObjectSnapTarget,
  pointDistance,
  snapCreationTarget,
} from "@/lib/diagram-snap";
import { applySafeFixes } from "@/lib/beautify";

export function useDiagramEditor() {
  const initialDiagram = useMemo(() => createBlankDiagram(), []);
  const [diagram, setDiagram] = useState<DiagramModel>(initialDiagram);
  const diagramRef = useRef<DiagramModel>(initialDiagram);
  const [, setUndoStack] = useState<DiagramModel[]>([]);
  const [, setRedoStack] = useState<DiagramModel[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [lintResult, setLintResult] = useState<LintResult>(() => lintDiagram(initialDiagram));
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [pendingPoints, setPendingPoints] = useState<PointCoordinate[]>([]);
  const [pendingAnchors, setPendingAnchors] = useState<(GeometryAnchor | null)[]>([]);
  const [activePenPathId, setActivePenPathId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapStep, setSnapStep] = useState(0.5);

  const commitDiagram = useCallback((next: DiagramModel, message?: string, baseDiagram: DiagramModel = diagramRef.current) => {
    const linkedNext = syncLinkedDiagram(next, baseDiagram);
    diagramRef.current = linkedNext;
    setUndoStack((current) => [baseDiagram, ...current].slice(0, 80));
    setRedoStack([]);
    setDiagram(linkedNext);
    setLintResult(lintDiagram(linkedNext));
    if (message) setStatusMessage(message);
  }, []);

  const replaceDiagram = useCallback((next: DiagramModel, message?: string) => {
    diagramRef.current = next;
    setUndoStack([]);
    setRedoStack([]);
    setDiagram(next);
    setLintResult(lintDiagram(next));
    setSelectedObjectIds([]);
    setPendingPoints([]);
    setPendingAnchors([]);
    setActivePenPathId(null);
    if (message) setStatusMessage(message);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((current) => {
      const previous = current[0];
      if (!previous) return current;

      setRedoStack((r) => [diagramRef.current, ...r].slice(0, 80));
      diagramRef.current = previous;
      setDiagram(previous);
      setLintResult(lintDiagram(previous));
      setSelectedObjectIds([]);
      setPendingPoints([]);
      setPendingAnchors([]);
      setActivePenPathId(null);
      setStatusMessage("Undo.");
      return current.slice(1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((current) => {
      const next = current[0];
      if (!next) return current;

      setUndoStack((u) => [diagramRef.current, ...u].slice(0, 80));
      diagramRef.current = next;
      setDiagram(next);
      setLintResult(lintDiagram(next));
      setSelectedObjectIds([]);
      setPendingPoints([]);
      setPendingAnchors([]);
      setActivePenPathId(null);
      setStatusMessage("Redo.");
      return current.slice(1);
    });
  }, []);

  const newBlankFigure = useCallback(() => {
    const next = createBlankDiagram();
    commitDiagram(next, "New figure.");
    setSelectedObjectIds([]);
    setActiveTool("select");
    setPendingPoints([]);
    setPendingAnchors([]);
    setActivePenPathId(null);
  }, [commitDiagram]);

  const handleToolChange = useCallback((tool: EditorTool) => {
    setActiveTool(tool);
    setPendingPoints([]);
    setPendingAnchors([]);
    setActivePenPathId(null);
    setStatusMessage("Ready.");
  }, []);

  const handleCanvasPoint = useCallback((point: PointCoordinate) => {
    if (activeTool === "pen") {
      const currentDiagram = diagramRef.current;
      const activePenPath = activePenPathId
        ? currentDiagram.objects.find((object) => object.id === activePenPathId && object.type === "PenPath")
        : null;
      const penSnapPoints = activePenPath?.type === "PenPath" ? activePenPath.points : pendingPoints;
      const { point: snapped, anchor } = snapCreationTarget(point, activeTool, currentDiagram, snapToGrid, snapStep, penSnapPoints);

      if (activePenPath?.type === "PenPath") {
        const lastPoint = activePenPath.points[activePenPath.points.length - 1];
        if (lastPoint && pointDistance(lastPoint, snapped) < 0.025) {
          setStatusMessage("Pen pin unchanged.");
          return;
        }

        const nextObjects = currentDiagram.objects.map((object) =>
          object.id === activePenPath.id
            ? {
                ...activePenPath,
                points: [...activePenPath.points, snapped],
                anchors: [...(activePenPath.anchors ?? activePenPath.points.map(() => null)), anchor],
              }
            : object,
        );
        const next: DiagramModel = {
          ...currentDiagram,
          objects: nextObjects,
          metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
        };
        commitDiagram(next, "Pen pin added.");
        setSelectedObjectIds([activePenPath.id]);
        setPendingPoints([]);
        setPendingAnchors([]);
        return;
      }

      const lastPendingPoint = pendingPoints[pendingPoints.length - 1];
      if (lastPendingPoint && pointDistance(lastPendingPoint, snapped) < 0.025) {
        setStatusMessage("Pen pin unchanged.");
        return;
      }

      const nextPendingPoints = [...pendingPoints, snapped];
      const nextPendingAnchors = [...pendingAnchors, anchor];
      if (nextPendingPoints.length < 2) {
        setPendingPoints(nextPendingPoints);
        setPendingAnchors(nextPendingAnchors);
        setStatusMessage(`Pen pin: (${snapped.x}, ${snapped.y}).`);
        return;
      }

      const object = createPenPath(nextPendingPoints, currentDiagram.objects, "", nextPendingAnchors);
      if (!object) {
        setPendingPoints(nextPendingPoints);
        setStatusMessage("Add another pen pin.");
        return;
      }

      const next: DiagramModel = {
        ...currentDiagram,
        objects: [...currentDiagram.objects, object],
        metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
      };
      commitDiagram(next, "Pen path created.");
      setSelectedObjectIds([object.id]);
      setActivePenPathId(object.id);
      setPendingPoints([]);
      setPendingAnchors([]);
      return;
    }

    if (activeTool === "angle" && pendingPoints.length === 0) {
      const currentDiagram = diagramRef.current;
      const angleDraft = inferAngleAtPoint(currentDiagram, point);

      if (angleDraft) {
        const angleObject = createAngleObject(currentDiagram, angleDraft);
        const next: DiagramModel = {
          ...currentDiagram,
          objects: [...currentDiagram.objects, angleObject],
          metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
        };
        commitDiagram(next, "Angle marked.");
        setSelectedObjectIds([angleObject.id]);
        setPendingPoints([]);
        setPendingAnchors([]);
        return;
      }
    }

    if (activeTool === "point" && pendingPoints.length === 0) {
      const currentDiagram = diagramRef.current;
      const target = findObjectSnapTarget(point, currentDiagram);

      if (target.kind === "polygon-edge" && target.objectId && target.edgeIndex !== undefined) {
        const pinnedPoint = snapCreationTarget(target.point, activeTool, currentDiagram, false, snapStep).point;
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
        setPendingAnchors([]);
        return;
      }
    }

    const currentDiagram = diagramRef.current;
    const creation = snapCreationTarget(point, activeTool, currentDiagram, snapToGrid, snapStep);
    const snapped = creation.point;
    const result = createObjectFromTool(activeTool, snapped, pendingPoints, currentDiagram.objects, "");

    setPendingPoints(result.pendingPoints);
    if (!result.object) {
      setPendingAnchors((current) => [...current, creation.anchor]);
      if (activeTool === "angle") {
        setStatusMessage(result.pendingPoints.length === 1 ? "Angle: choose vertex." : "Angle: choose second ray.");
      } else {
        setStatusMessage(`${activeTool} start: (${snapped.x}, ${snapped.y}).`);
      }
      return;
    }

    const object = attachCreatedObject(result.object, [pendingAnchors[0] ?? null, creation.anchor]);
    const next: DiagramModel = {
      ...currentDiagram,
      objects: [...currentDiagram.objects, object],
      metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, `${object.type} created.`);
    setSelectedObjectIds([object.id]);
    setPendingAnchors([]);
  }, [activeTool, activePenPathId, pendingPoints, pendingAnchors, snapToGrid, snapStep, commitDiagram]);

  const handleCanvasDragCreate = useCallback((start: PointCoordinate, end: PointCoordinate) => {
    const currentDiagram = diagramRef.current;
    const startTarget = snapCreationTarget(start, activeTool, currentDiagram, snapToGrid, snapStep);
    const endTarget = snapCreationTarget(end, activeTool, currentDiagram, snapToGrid, snapStep);
    const object = createObjectFromDrag(activeTool, startTarget.point, endTarget.point, currentDiagram.objects, "");

    if (!object) return;

    const linkedObject = attachCreatedObject(object, [startTarget.anchor, endTarget.anchor]);
    const next: DiagramModel = {
      ...currentDiagram,
      objects: [...currentDiagram.objects, linkedObject],
      metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, `${linkedObject.type} created.`);
    setPendingPoints([]);
    setPendingAnchors([]);
    setSelectedObjectIds([linkedObject.id]);
  }, [activeTool, snapToGrid, snapStep, commitDiagram]);

  const handleGridChange = useCallback((value: boolean) => {
    const next = {
      ...diagramRef.current,
      gridVisible: value,
      metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
    };
    diagramRef.current = next;
    setDiagram(next);
    setStatusMessage(value ? "Grid on." : "Grid off.");
  }, []);

  const handleCoordinatesChange = useCallback((value: boolean) => {
    const next = {
      ...diagramRef.current,
      coordinatesVisible: value,
      metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
    };
    diagramRef.current = next;
    setDiagram(next);
    setStatusMessage(value ? "Coordinates on." : "Coordinates off.");
  }, []);

  const updateSelectedObject = useCallback((patch: ObjectPatch) => {
    const objectId = selectedObjectIds[0];
    if (!objectId) return;
    const currentDiagram = diagramRef.current;
    commitDiagram(updateDiagramObject(currentDiagram, objectId, patch), "Properties updated.", currentDiagram);
  }, [selectedObjectIds, commitDiagram]);

  const deleteSelectedObjects = useCallback(() => {
    if (selectedObjectIds.length === 0) return;

    const ids = new Set(selectedObjectIds);
    const next = {
      ...diagramRef.current,
      objects: diagramRef.current.objects.filter((object) => !ids.has(object.id)),
      metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, selectedObjectIds.length > 1 ? "Objects deleted." : "Object deleted.");
    if (activePenPathId && ids.has(activePenPathId)) setActivePenPathId(null);
    setSelectedObjectIds([]);
  }, [selectedObjectIds, activePenPathId, commitDiagram]);

  const handleLayerAction = useCallback((action: "front" | "up" | "down" | "back") => {
    if (selectedObjectIds.length === 0) return;

    const selected = new Set(selectedObjectIds);
    const objects = [...diagramRef.current.objects];
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
        ...diagramRef.current,
        objects: nextObjects,
        metadata: { ...diagramRef.current.metadata, updatedAt: new Date().toISOString() },
      },
      "Layer updated.",
    );
  }, [selectedObjectIds, commitDiagram]);

  const appendObjects = useCallback((objects: DiagramObject[], message: string) => {
    if (objects.length === 0) return;

    const currentDiagram = diagramRef.current;
    const next: DiagramModel = {
      ...currentDiagram,
      objects: [...currentDiagram.objects, ...objects],
      metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
    };
    commitDiagram(next, message, currentDiagram);
    setSelectedObjectIds(objects.map((object) => object.id));
    setPendingPoints([]);
    setPendingAnchors([]);
    setActivePenPathId(null);
  }, [commitDiagram]);

  const handlePlotExpression = useCallback((expressionInput: string) => {
    const currentDiagram = diagramRef.current;
    const result = createFunctionPlotObject(expressionInput, currentDiagram.viewport, currentDiagram.objects);
    if (!result.object) {
      setStatusMessage(result.error ?? "Invalid expression.");
      return false;
    }

    appendObjects([result.object], "Expression added.");
    return true;
  }, [appendObjects]);

  const handleEditExpression = useCallback((objectId: string, expressionInput: string) => {
    const currentDiagram = diagramRef.current;
    const existingIndex = currentDiagram.objects.findIndex((o) => o.id === objectId);
    if (existingIndex === -1) return false;

    const existingObject = currentDiagram.objects[existingIndex];
    const result = createFunctionPlotObject(expressionInput, currentDiagram.viewport, currentDiagram.objects);
    if (!result.object) {
      setStatusMessage(result.error ?? "Invalid expression.");
      return false;
    }

    const updatedObject = {
      ...result.object,
      id: objectId, // Maintain identity for selection/links
      style: existingObject.style,
      visibility: existingObject.visibility,
    };

    const nextObjects = [...currentDiagram.objects];
    nextObjects[existingIndex] = updatedObject as DiagramObject;

    const next = {
      ...currentDiagram,
      objects: nextObjects,
      metadata: { ...currentDiagram.metadata, updatedAt: new Date().toISOString() },
    };

    commitDiagram(next, "Expression updated.", currentDiagram);
    return true;
  }, [commitDiagram]);

  const adjustSnapStep = useCallback((direction: -1 | 1) => {
    setSnapStep((current) => {
      const steps = [0.1, 0.25, 0.5, 1, 2];
      const currentIndex = steps.findIndex((step) => Math.abs(step - current) < 0.0001);
      const safeIndex = currentIndex === -1 ? steps.indexOf(0.5) : currentIndex;
      const nextIndex = Math.max(0, Math.min(steps.length - 1, safeIndex + direction));
      setStatusMessage(`Snap ${steps[nextIndex]}.`);
      return steps[nextIndex];
    });
  }, []);

  const handleCanvasCommit = useCallback((next: DiagramModel, message?: string) => {
    commitDiagram(next, message, diagramRef.current);
  }, [commitDiagram]);

  const handleViewportChange = useCallback((viewport: DiagramViewport) => {
    setDiagram((current) => {
      const next = {
        ...current,
        viewport,
        metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
      };
      diagramRef.current = next;
      return next;
    });
  }, []);

  const handleApplySafeFixes = useCallback((activePresetId: string) => {
    const currentDiagram = diagramRef.current;
    const fixed = applySafeFixes(currentDiagram, activePresetId);
    commitDiagram(fixed, "Safe fixes applied.", currentDiagram);
  }, [commitDiagram]);

  const handleRunLinter = useCallback(() => {
    setLintResult(lintDiagram(diagramRef.current));
    setStatusMessage("Linter run.");
  }, []);

  useEffect(() => {
    function isEditingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = (event.key ?? "").toLowerCase();
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
        setPendingAnchors([]);
        setActivePenPathId(null);
        setStatusMessage("All objects selected.");
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        setActiveTool("select");
        setPendingPoints([]);
        setPendingAnchors([]);
        setActivePenPathId(null);
        setStatusMessage("Ready.");
        return;
      }

      if (key === "enter" && activeTool === "pen") {
        event.preventDefault();
        setPendingPoints([]);
        setPendingAnchors([]);
        setActivePenPathId(null);
        setStatusMessage("Pen path finished.");
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
      if (key === "b") handleToolChange("pen");
      if (key === "n") handleToolChange("segment");
      if (key === "s") handleToolChange("line");
      if (key === "c") handleToolChange("circle");
      if (key === "r") handleToolChange("rectangle");
      if (key === "t") handleToolChange("triangle");
      if (key === "q") handleToolChange("angle");
      if (key === "a") handleToolChange("vector");
      if (key === "l") handleToolChange("label");
      if (key === "g") handleGridChange(!diagramRef.current.gridVisible);
      if (key === "x") handleCoordinatesChange(!(diagramRef.current.coordinatesVisible ?? true));
      if (key === "1") handleToolChange("select");
      if (key === "2") handleToolChange("point");
      if (key === "3") handleToolChange("line");
      if (key === "4") handleToolChange("pen");
      if (key === "5") handleToolChange("circle");
      if (key === "6") handleToolChange("vector");
      if (key === "[") adjustSnapStep(-1);
      if (key === "]") adjustSnapStep(1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }); // Intentionally without dependency array — re-registers on every render to capture latest closure state

  return {
    diagram,
    selectedObjectIds,
    setSelectedObjectIds,
    lintResult,
    statusMessage,
    setStatusMessage,
    activeTool,
    pendingPoints,
    activePenPathId,
    snapToGrid,
    setSnapToGrid,
    snapStep,
    setSnapStep,
    undo,
    redo,
    newBlankFigure,
    handleToolChange,
    handleCanvasPoint,
    handleCanvasDragCreate,
    handleGridChange,
    handleCoordinatesChange,
    updateSelectedObject,
    deleteSelectedObjects,
    handleLayerAction,
    handlePlotExpression,
    handleEditExpression,
    handleCanvasCommit,
    handleViewportChange,
    handleApplySafeFixes,
    handleRunLinter,
    replaceDiagram,
  };
}

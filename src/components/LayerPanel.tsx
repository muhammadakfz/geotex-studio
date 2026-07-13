import { useState } from "react";
import { ChevronsDown, ChevronsUp, ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { DiagramModel, DiagramObject } from "@/lib/diagram-types";

interface LayerPanelProps {
  diagram: DiagramModel;
  selectedObjectIds?: string[];
  onSelectObjects: (ids: string[]) => void;
  onLayerAction: (action: "front" | "up" | "down" | "back") => void;
  onEditExpression?: (objectId: string, expression: string) => void;
  onCreateExpression?: (expression: string) => void;
}

const commandExamples = [
  "A=(1,2)",
  "f(x)=sin(x)",
  "Segment(A,B)",
  "Circle(A,2)",
  "Polygon(A,B,C)",
  "M=Midpoint(A,B)",
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function coordinate(point: { x: number; y: number }): string {
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
}

function pointName(diagram: DiagramModel, pointId?: string): string | null {
  if (!pointId) return null;

  const point = diagram.objects.find((object) => object.id === pointId && object.type === "Point");
  return point?.label || point?.name || pointId;
}

function getAlgebraicString(object: DiagramObject, diagram: DiagramModel): string {
  if (object.type === "Point") return `${object.label || object.name} = ${coordinate(object.coordinates)}`;
  if (object.type === "Line" && object.pointIds?.length === 2) {
    return `Line(${object.pointIds.map((id) => pointName(diagram, id) ?? id).join(", ")})`;
  }
  if (object.type === "Line") return `Line(${coordinate(object.through[0])}, ${coordinate(object.through[1])})`;
  if (object.type === "Segment" && object.startPointId && object.endPointId) {
    return `Segment(${pointName(diagram, object.startPointId) ?? object.startPointId}, ${pointName(diagram, object.endPointId) ?? object.endPointId})`;
  }
  if (object.type === "Segment") return `Segment(${coordinate(object.start)}, ${coordinate(object.end)})`;
  if (object.type === "Vector" && object.startPointId && object.endPointId) {
    return `Vector(${pointName(diagram, object.startPointId) ?? object.startPointId}, ${pointName(diagram, object.endPointId) ?? object.endPointId})`;
  }
  if (object.type === "Vector") return `Vector(${coordinate(object.start)}, ${coordinate(object.end)})`;
  if (object.type === "Circle") {
    const centerName = pointName(diagram, object.centerPointId);
    return `Circle(${centerName ?? coordinate(object.center)}, ${formatNumber(object.radius)})`;
  }
  if (object.type === "Polygon") {
    const refs = object.pointIds?.map((id) => pointName(diagram, id) ?? id);
    const edgeLabels = object.edgeLabels?.filter((label) => label.trim());
    const suffix = edgeLabels?.length ? ` | edges: ${edgeLabels.join(", ")}` : "";
    return `${refs?.length ? `Polygon(${refs.join(", ")})` : `Polygon(${object.points.length} vertices)`}${suffix}`;
  }
  if (object.type === "FunctionPlot") return `${object.label || "f(x)"} = ${object.expression}`;
  if (object.type === "Angle" && object.pointIds?.length === 3) {
    return `Angle(${object.pointIds.map((id) => pointName(diagram, id) ?? id).join(", ")})`;
  }
  if (object.type === "Angle") return `Angle(${coordinate(object.start)}, ${coordinate(object.vertex)}, ${coordinate(object.end)})`;
  return object.semanticRole;
}

function editableExpressionFor(object: DiagramObject, diagram: DiagramModel): string {
  if (object.type === "Point") return `${object.label || object.name}=${coordinate(object.coordinates).replace(" ", "")}`;
  if (object.type === "FunctionPlot") return `${object.label || "f(x)"}=${object.expression}`;
  return getAlgebraicString(object, diagram).replaceAll(" ", "");
}

export function LayerPanel({
  diagram,
  selectedObjectIds = [],
  onSelectObjects,
  onLayerAction,
  onEditExpression,
  onCreateExpression,
}: LayerPanelProps) {
  const selectedCount = selectedObjectIds.length;
  const objectCount = diagram.objects.length;
  const selectedSet = new Set(selectedObjectIds);
  const layerObjects = [...diagram.objects];
  const disabled = selectedCount === 0;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleEditSubmit = (objectId: string) => {
    if (editingId === objectId && onEditExpression) {
      onEditExpression(objectId, editValue);
    }
    setEditingId(null);
  };

  const handleCreateSubmit = () => {
    if (newValue.trim() && onCreateExpression) {
      onCreateExpression(newValue);
      setNewValue("");
    }
  };

  return (
    <section className="tool-panel flex h-full flex-col">
      <div className="panel-heading shrink-0">
        <span>Algebra</span>
        <span className="status-pill">{selectedCount > 0 ? `${selectedCount}/${objectCount}` : objectCount}</span>
      </div>

      <div className="mb-3 grid shrink-0 grid-cols-4 gap-2">
        <button type="button" onClick={() => onLayerAction("front")} disabled={disabled} title="Bring to front" className="layer-button">
          <ChevronsUp className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => onLayerAction("up")} disabled={disabled} title="Move up" className="layer-button">
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => onLayerAction("down")} disabled={disabled} title="Move down" className="layer-button">
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => onLayerAction("back")} disabled={disabled} title="Send to back" className="layer-button">
          <ChevronsDown className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1 pb-4">
        {diagram.objects.length === 0 ? (
          <div className="panel-empty">
            No objects yet.
          </div>
        ) : null}
        {layerObjects.map((object) => {
          const isSelected = selectedSet.has(object.id);
          const isEditing = editingId === object.id;

          return (
            <div
              key={object.id}
              className={`layer-card ${
                isSelected
                  ? "layer-card-active"
                  : ""
              }`}
            >
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left"
                onClick={(event) => {
                  if (event.shiftKey) {
                    onSelectObjects(
                      isSelected
                        ? selectedObjectIds.filter((id) => id !== object.id)
                        : [...selectedObjectIds, object.id],
                    );
                    return;
                  }
                  onSelectObjects([object.id]);
                }}
              >
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span className="truncate">{object.name}</span>
                  <span className="layer-type-badge">
                    {object.type}
                  </span>
                </div>
              </button>

              <div className="layer-expression">
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleEditSubmit(object.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEditSubmit(object.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full bg-transparent font-mono text-xs outline-none"
                    placeholder="e.g. A=(2,3)"
                  />
                ) : (
                  <div
                    className="cursor-text truncate font-mono text-xs"
                  onClick={() => {
                    setEditingId(object.id);
                      setEditValue(editableExpressionFor(object, diagram));
                  }}
                >
                    {getAlgebraicString(object, diagram)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="expression-entry">
          <Plus className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSubmit();
            }}
            aria-label="New algebra expression"
            placeholder="A=(1,2), f(x)=sin(x), Segment(A,B)..."
            className="w-full bg-transparent font-mono text-xs text-black outline-none"
          />
        </div>

        <div className="algebra-command-grid">
          {commandExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="algebra-chip"
              onClick={() => setNewValue(example)}
              title={example}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

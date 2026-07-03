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

function getAlgebraicString(object: DiagramObject): string {
  if (object.type === "Point") return `${object.name}=(${object.coordinates.x}, ${object.coordinates.y})`;
  if (object.type === "Line" && object.pointIds?.length === 2) return `Line(${object.pointIds[0]}, ${object.pointIds[1]})`;
  if (object.type === "Line") return `Line((${object.through[0].x}, ${object.through[0].y}), (${object.through[1].x}, ${object.through[1].y}))`;
  if (object.type === "Segment" && object.startPointId && object.endPointId) return `Segment(${object.startPointId}, ${object.endPointId})`;
  if (object.type === "Segment") return `Segment((${object.start.x}, ${object.start.y}), (${object.end.x}, ${object.end.y}))`;
  if (object.type === "Vector") return `Vector((${object.start.x}, ${object.start.y}), (${object.end.x}, ${object.end.y}))`;
  if (object.type === "Circle") return `Circle((${object.center.x}, ${object.center.y}), ${object.radius.toFixed(2)})`;
  if (object.type === "Polygon") return `Polygon(${object.points.length} vertices)`;
  if (object.type === "FunctionPlot") return `f(x) = ${object.expression}`;
  if (object.type === "Angle") return `Angle(${object.start.x}, ${object.vertex.x}, ${object.end.x})`;
  return object.semanticRole;
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
                      const prefix = (object.type === "Point" || object.type === "Line" || object.type === "Circle") ? `${object.name}=` : "";
                      setEditValue(`${prefix}${getAlgebraicString(object)}`);
                    }}
                  >
                    {getAlgebraicString(object)}
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
            placeholder="New expression..."
            className="w-full bg-transparent font-mono text-xs text-black outline-none"
          />
        </div>
      </div>
    </section>
  );
}

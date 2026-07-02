import { ChevronsDown, ChevronsUp, ChevronDown, ChevronUp } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";

interface LayerPanelProps {
  diagram: DiagramModel;
  selectedObjectIds?: string[];
  onSelectObjects: (ids: string[]) => void;
  onLayerAction: (action: "front" | "up" | "down" | "back") => void;
}

export function LayerPanel({
  diagram,
  selectedObjectIds = [],
  onSelectObjects,
  onLayerAction,
}: LayerPanelProps) {
  const selectedCount = selectedObjectIds.length;
  const objectCount = diagram.objects.length;
  const selectedSet = new Set(selectedObjectIds);
  const layerObjects = [...diagram.objects].reverse();
  const disabled = selectedCount === 0;

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Layer</span>
        <span className="status-pill">{selectedCount > 0 ? `${selectedCount}/${objectCount}` : objectCount}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
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

      <div className="mt-3 space-y-2">
        {diagram.objects.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
            No objects yet.
          </div>
        ) : null}
        {layerObjects.map((object, index) => (
          <button
            key={object.id}
            type="button"
            onClick={(event) => {
              if (event.shiftKey) {
                onSelectObjects(
                  selectedSet.has(object.id)
                    ? selectedObjectIds.filter((id) => id !== object.id)
                    : [...selectedObjectIds, object.id],
                );
                return;
              }
              onSelectObjects([object.id]);
            }}
            className={`w-full rounded-md border px-3 py-2 text-left transition ${
              selectedSet.has(object.id)
                ? "border-black bg-black text-white"
                : "border-black bg-white text-black hover:bg-neutral-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="truncate">
                {index + 1}. {object.name}
              </span>
              <span className={`shrink-0 text-xs font-medium ${selectedSet.has(object.id) ? "text-white" : "text-neutral-500"}`}>
                {object.type}
              </span>
            </div>
            <div className={`mt-1 truncate text-xs ${selectedSet.has(object.id) ? "text-white" : "text-neutral-500"}`}>
              {object.semanticRole}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

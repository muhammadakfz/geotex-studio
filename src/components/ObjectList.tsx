import type { DiagramModel } from "@/lib/diagram-types";

interface ObjectListProps {
  diagram: DiagramModel;
  selectedObjectIds?: string[];
  onSelectObjects: (ids: string[]) => void;
}

export function ObjectList({ diagram, selectedObjectIds = [], onSelectObjects }: ObjectListProps) {
  const selectedSet = new Set(selectedObjectIds);

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Objects</span>
        <span className="status-pill">{diagram.objects.length}</span>
      </div>
      <div className="space-y-2">
        {diagram.objects.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
            No objects yet.
          </div>
        ) : null}
        {diagram.objects.map((object) => (
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
                ? "border-blue-300 bg-blue-50 text-blue-950"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="truncate">{object.name}</span>
              <span className="shrink-0 text-xs font-medium text-stone-500">{object.type}</span>
            </div>
            <div className="mt-1 truncate text-xs text-stone-500">{object.semanticRole}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

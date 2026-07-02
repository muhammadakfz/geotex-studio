"use client";

import {
  Circle,
  Crosshair,
  Grid2X2,
  Hand,
  Hash,
  Hexagon,
  MousePointer2,
  MoveUpRight,
  Slash,
  Square,
  Trash2,
  Triangle,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EditorTool } from "@/lib/diagram-editor";

interface FigureBuilderPanelProps {
  activeTool: EditorTool;
  snapToGrid: boolean;
  gridVisible: boolean;
  coordinatesVisible: boolean;
  hasSelection: boolean;
  pendingCount: number;
  onToolChange: (tool: EditorTool) => void;
  onSnapChange: (value: boolean) => void;
  onGridChange: (value: boolean) => void;
  onCoordinatesChange: (value: boolean) => void;
  onDeleteSelected: () => void;
}

const tools = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "hand", label: "Pan", shortcut: "H", icon: Hand },
  { id: "point", label: "Point", shortcut: "P", icon: Crosshair },
  { id: "segment", label: "Segment", shortcut: "S", icon: Slash },
  { id: "circle", label: "Circle", shortcut: "C", icon: Circle },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "triangle", label: "Triangle", shortcut: "T", icon: Triangle },
  { id: "angle", label: "Angle", shortcut: "Q", icon: Hexagon },
  { id: "vector", label: "Vector", shortcut: "A", icon: MoveUpRight },
  { id: "label", label: "Label", shortcut: "L", icon: Type },
] satisfies { id: EditorTool; label: string; shortcut: string; icon: LucideIcon }[];

export function FigureBuilderPanel({
  activeTool,
  snapToGrid,
  gridVisible,
  coordinatesVisible,
  hasSelection,
  pendingCount,
  onToolChange,
  onSnapChange,
  onGridChange,
  onCoordinatesChange,
  onDeleteSelected,
}: FigureBuilderPanelProps) {
  return (
    <section className="tool-rail" aria-label="Figure tools">
      <div className="flex flex-col gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              title={`${tool.label} (${tool.shortcut})`}
              aria-label={tool.label}
              onClick={() => onToolChange(tool.id)}
              className={activeTool === tool.id ? "rail-button-active" : "rail-button"}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onSnapChange(!snapToGrid)}
          title="Snap to grid"
          aria-label="Snap to grid"
          className={snapToGrid ? "rail-button-active" : "rail-button"}
        >
          <Crosshair className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onGridChange(!gridVisible)}
          title="Grid (G)"
          aria-label="Grid"
          className={gridVisible ? "rail-button-active" : "rail-button"}
        >
          <Grid2X2 className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onCoordinatesChange(!coordinatesVisible)}
          title="Coordinates (X)"
          aria-label="Coordinates"
          className={coordinatesVisible ? "rail-button-active" : "rail-button"}
        >
          <Hash className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          title="Delete"
          aria-label="Delete"
          className="rail-button disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
        {pendingCount > 0 ? <span className="rail-counter">{pendingCount}</span> : null}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  Circle,
  Crosshair,
  DraftingCompass,
  Grid2X2,
  Hand,
  Hash,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Square,
  Trash2,
  Triangle,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EditorTool } from "@/lib/diagram-editor";

type ToolOption = { id: EditorTool; label: string; shortcut: string; icon: LucideIcon };

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
  { id: "pen", label: "Pen", shortcut: "B", icon: Pencil },
  { id: "angle", label: "Angle", shortcut: "Q", icon: DraftingCompass },
  { id: "label", label: "Label", shortcut: "L", icon: Type },
] satisfies ToolOption[];

const shapeTools = [
  { id: "circle", label: "Circle", shortcut: "C", icon: Circle },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "triangle", label: "Triangle", shortcut: "T", icon: Triangle },
] satisfies ToolOption[];

const linearTools = [
  { id: "line", label: "Line", shortcut: "S", icon: Minus },
  { id: "segment", label: "Segment", shortcut: "N", icon: Minus },
  { id: "vector", label: "Vector", shortcut: "A", icon: MoveUpRight },
] satisfies ToolOption[];

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
  const [openGroup, setOpenGroup] = useState<"shape" | "linear" | null>(null);

  function selectTool(tool: EditorTool) {
    onToolChange(tool);
    setOpenGroup(null);
  }

  function renderToolButton(tool: ToolOption) {
    const Icon = tool.icon;
    return (
      <button
        key={tool.id}
        type="button"
        title={`${tool.label} (${tool.shortcut})`}
        aria-label={tool.label}
        onClick={() => selectTool(tool.id)}
        className={activeTool === tool.id ? "rail-button-active" : "rail-button"}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </button>
    );
  }

  function renderToolGroup(
    group: "shape" | "linear",
    label: string,
    fallbackIcon: LucideIcon,
    options: ToolOption[],
  ) {
    const activeOption = options.find((tool) => tool.id === activeTool);
    const Icon = activeOption?.icon ?? fallbackIcon;
    const active = Boolean(activeOption);

    return (
      <div className="rail-menu-wrap">
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-expanded={openGroup === group}
          onClick={() => setOpenGroup((current) => current === group ? null : group)}
          className={active ? "rail-button-active" : "rail-button"}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </button>
        {openGroup === group ? (
          <div className="rail-popover" role="menu" aria-label={label}>
            {options.map((tool) => {
              const OptionIcon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool.id)}
                  className={activeTool === tool.id ? "rail-option-active" : "rail-option"}
                  role="menuitem"
                >
                  <OptionIcon className="h-4 w-4" aria-hidden />
                  <span>{tool.label}</span>
                  <kbd>{tool.shortcut}</kbd>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="tool-rail" aria-label="Figure tools">
      <div className="rail-group">
        {tools.slice(0, 4).map(renderToolButton)}
        {renderToolGroup("shape", "Shape tools", Square, shapeTools)}
        {renderToolGroup("linear", "Line tools", MoveUpRight, linearTools)}
        {tools.slice(4).map(renderToolButton)}
      </div>

      <div className="rail-group rail-system-group">
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

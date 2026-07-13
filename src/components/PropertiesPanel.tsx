"use client";

import { Eye, EyeOff, FlipHorizontal2, FlipVertical2, Palette } from "lucide-react";
import type {
  DiagramObject,
  DiagramStyle,
  LabelPosition,
  SemanticRole,
} from "@/lib/diagram-types";
import { objectGeometry, type MirrorAxis, type ObjectGeometryPatch } from "@/lib/diagram-geometry";

export interface ObjectPatch {
  name?: string;
  label?: string;
  text?: string;
  edgeLabels?: string[];
  visibility?: boolean;
  semanticRole?: SemanticRole;
  style?: Partial<DiagramStyle>;
  geometry?: ObjectGeometryPatch;
  lineKind?: "line" | "segment";
  transform?: { mirror?: MirrorAxis };
}

interface PropertiesPanelProps {
  object?: DiagramObject;
  onChange: (patch: ObjectPatch) => void;
}

const semanticRoles: SemanticRole[] = [
  "main-object",
  "construction-line",
  "force-vector",
  "velocity-vector",
  "acceleration-vector",
  "electric-field-vector",
  "theorem-label",
  "auxiliary-point",
  "function-curve",
  "area-region",
  "axis",
  "tangent-line",
];

const labelPositions: LabelPosition[] = [
  "above",
  "below",
  "left",
  "right",
  "above-left",
  "above-right",
  "below-left",
  "below-right",
  "center",
];

interface GeometryFieldProps {
  label: string;
  value: number;
  min?: number;
  onCommit: (value: number) => void;
}

function GeometryField({ label, value, min, onCommit }: GeometryFieldProps) {
  function commitDraft(rawValue: string, input: HTMLInputElement) {
    if (rawValue.trim() === "") {
      input.value = String(value);
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      input.value = String(value);
      return;
    }
    onCommit(parsed);
  }

  return (
    <label className="property-tile">
      <span>{label}</span>
      <input
        key={`${label}-${value}`}
        type="number"
        step="0.1"
        min={min}
        defaultValue={value}
        onBlur={(event) => commitDraft(event.currentTarget.value, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          commitDraft(event.currentTarget.value, event.currentTarget);
          event.currentTarget.blur();
        }}
        className="property-input"
      />
    </label>
  );
}

function colorValue(color: string | undefined, fallback: string): string {
  if (!color || color === "transparent") return fallback;
  return color.startsWith("#") ? color : fallback;
}

function canFill(object: DiagramObject): boolean {
  return ["Circle", "Polygon", "Point", "Label"].includes(object.type);
}

function canMirror(object: DiagramObject): boolean {
  return object.type !== "Point" && object.type !== "Label" && object.type !== "Circle";
}

function polygonEdgeLabels(object: Extract<DiagramObject, { type: "Polygon" }>): string[] {
  return Array.from({ length: object.points.length }, (_, index) => object.edgeLabels?.[index] ?? "");
}

export function PropertiesPanel({ object, onChange }: PropertiesPanelProps) {
  if (!object) {
    return (
      <section className="tool-panel">
        <div className="panel-heading">
          <span>Properties</span>
          <span className="status-pill">none</span>
        </div>
        <div className="panel-empty">
          No selection.
        </div>
      </section>
    );
  }

  const stroke = colorValue(object.style.stroke, "#111111");
  const fill = colorValue(object.style.fill, "#ffffff");
  const fillEnabled = Boolean(object.style.fill && object.style.fill !== "transparent");
  const strokeWidth = object.style.strokeWidth ?? 1.25;
  const opacity = object.style.opacity ?? 1;
  const geometry = objectGeometry(object);

  function updateGeometry(key: keyof ObjectGeometryPatch, value: number) {
    onChange({ geometry: { [key]: value } });
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Properties</span>
        <span className="status-pill">{object.type}</span>
      </div>

      <div className="grid gap-3">
        <label className="property-row">
          <span>Name</span>
          <input
            value={object.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className="property-input"
          />
        </label>

        <label className="property-row">
          <span>Label</span>
          <input
            value={object.type === "Label" ? object.text : object.label ?? ""}
            onChange={(event) =>
              onChange(
                object.type === "Label"
                  ? { label: event.target.value, text: event.target.value }
                  : { label: event.target.value },
              )
            }
            className="property-input"
          />
        </label>

        <label className="property-row">
          <span>Role</span>
          <select
            value={object.semanticRole}
            onChange={(event) => onChange({ semanticRole: event.target.value as SemanticRole })}
            className="property-input"
          >
            {semanticRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        {object.type === "Line" || object.type === "Segment" ? (
          <label className="property-row">
            <span>Kind</span>
            <select
              value={object.type === "Line" ? "line" : "segment"}
              onChange={(event) => onChange({ lineKind: event.target.value as "line" | "segment" })}
              className="property-input"
            >
              <option value="segment">Segment</option>
              <option value="line">Line</option>
            </select>
          </label>
        ) : null}

        <div className="geometry-grid">
          <GeometryField label="X" value={geometry.x} onCommit={(value) => updateGeometry("x", value)} />
          <GeometryField label="Y" value={geometry.y} onCommit={(value) => updateGeometry("y", value)} />
          <GeometryField label="W" value={geometry.w} min={0} onCommit={(value) => updateGeometry("w", value)} />
          <GeometryField label="H" value={geometry.h} min={0} onCommit={(value) => updateGeometry("h", value)} />
        </div>

        {object.type === "Polygon" ? (
          <div className="edge-label-editor">
            <div className="edge-label-heading">
              <span>Edge labels</span>
              <span>{object.points.length}</span>
            </div>
            {polygonEdgeLabels(object).map((edgeLabel, index, labels) => (
              <label key={`${object.id}-edge-${index}`} className="edge-label-row">
                <span>{`E${index + 1}`}</span>
                <input
                  value={edgeLabel}
                  placeholder={index === 0 ? "a, AB, 12, ..." : ""}
                  onChange={(event) => {
                    const next = [...labels];
                    next[index] = event.target.value;
                    onChange({ edgeLabels: next });
                  }}
                  className="property-input"
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ transform: { mirror: "horizontal" } })}
            disabled={!canMirror(object)}
            title="Mirror horizontal"
            className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FlipHorizontal2 className="h-4 w-4" aria-hidden />
            Mirror H
          </button>
          <button
            type="button"
            onClick={() => onChange({ transform: { mirror: "vertical" } })}
            disabled={!canMirror(object)}
            title="Mirror vertical"
            className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FlipVertical2 className="h-4 w-4" aria-hidden />
            Mirror V
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="property-tile">
            <span>Stroke</span>
            <input
              type="color"
              value={stroke}
              onInput={(event) => onChange({ style: { stroke: event.currentTarget.value } })}
              className="color-input"
            />
          </label>
          <label className="property-tile">
            <span>Fill</span>
            <input
              type="color"
              value={fill}
              disabled={!canFill(object) || !fillEnabled}
              onInput={(event) => onChange({ style: { fill: event.currentTarget.value } })}
              className="color-input disabled:opacity-40"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ style: { fill: fillEnabled ? "transparent" : fill } })}
            disabled={!canFill(object)}
            title="Toggle fill"
            className={fillEnabled ? "icon-button" : "icon-button-secondary disabled:opacity-40"}
          >
            <Palette className="h-4 w-4" aria-hidden />
            {fillEnabled ? "Fill" : "Outline"}
          </button>
          <button
            type="button"
            onClick={() => onChange({ visibility: !object.visibility })}
            title="Toggle visibility"
            className={object.visibility ? "icon-button-secondary" : "icon-button"}
          >
            {object.visibility ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            {object.visibility ? "Visible" : "Hidden"}
          </button>
        </div>

        <label className="property-stack">
          <span>Line width {strokeWidth.toFixed(1)}</span>
          <input
            type="range"
            min="0.4"
            max="5"
            step="0.1"
            value={strokeWidth}
            onChange={(event) => onChange({ style: { strokeWidth: Number(event.target.value) } })}
          />
        </label>

        <label className="property-row">
          <span>Line</span>
          <select
            value={object.style.dashed ? "dashed" : "solid"}
            onChange={(event) => onChange({ style: { dashed: event.target.value === "dashed" } })}
            className="property-input"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </label>

        <label className="property-stack">
          <span>Opacity {Math.round(opacity * 100)}%</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => onChange({ style: { opacity: Number(event.target.value) } })}
          />
        </label>

        {object.type === "Point" ? (
          <label className="property-stack">
            <span>Point size {object.style.pointSize ?? 3.2}</span>
            <input
              type="range"
              min="1.5"
              max="9"
              step="0.1"
              value={object.style.pointSize ?? 3.2}
              onChange={(event) => onChange({ style: { pointSize: Number(event.target.value) } })}
            />
          </label>
        ) : null}

        <label className="property-row">
          <span>Label pos</span>
          <select
            value={object.style.labelPosition ?? "above"}
            onChange={(event) => onChange({ style: { labelPosition: event.target.value as LabelPosition } })}
            className="property-input"
          >
            {labelPositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

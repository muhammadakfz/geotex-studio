import type { DiagramStyle, SemanticRole } from "./diagram-types";

export type StylePresetCategory = "olympiad" | "physics" | "paper" | "beamer" | "teaching" | "custom";

export interface StylePresetConfig {
  canvas: {
    gridVisible: boolean;
    background: string;
  };
  defaultObjectStyle: DiagramStyle;
  roleStyles: Partial<Record<SemanticRole, DiagramStyle>>;
  labelStyle: {
    fontSize: number;
    normalizeLatex: boolean;
  };
  export: {
    scale: number;
    grayscaleSafe: boolean;
    columnWidthCm: number;
  };
}

export interface StylePreset {
  id: string;
  name: string;
  category: StylePresetCategory;
  isSystem: boolean;
  config: StylePresetConfig;
}

const ink = "#111111";
const muted = "#60646c";
const blue = "#1d4ed8";
const emerald = "#047857";

export const systemStylePresets: StylePreset[] = [
  {
    id: "olympiad-geometry",
    name: "Olympiad Geometry",
    category: "olympiad",
    isSystem: true,
    config: {
      canvas: { gridVisible: false, background: "#ffffff" },
      defaultObjectStyle: { stroke: ink, strokeWidth: 1.1, fill: "transparent" },
      roleStyles: {
        "main-object": { stroke: ink, strokeWidth: 1.25 },
        "construction-line": { stroke: muted, strokeWidth: 0.75, dashed: true, opacity: 0.75 },
        "auxiliary-point": { pointSize: 2.3, stroke: ink, fill: ink },
        "theorem-label": { stroke: ink, fontSize: 13 },
      },
      labelStyle: { fontSize: 13, normalizeLatex: true },
      export: { scale: 1, grayscaleSafe: true, columnWidthCm: 8.5 },
    },
  },
  {
    id: "physics-report",
    name: "Physics Report",
    category: "physics",
    isSystem: true,
    config: {
      canvas: { gridVisible: false, background: "#ffffff" },
      defaultObjectStyle: { stroke: ink, strokeWidth: 1.1, fill: "transparent" },
      roleStyles: {
        "force-vector": { stroke: ink, strokeWidth: 1.7, arrow: true },
        "velocity-vector": { stroke: "#334155", strokeWidth: 1.6, arrow: true },
        "acceleration-vector": { stroke: "#475569", strokeWidth: 1.6, arrow: true },
        "construction-line": { stroke: muted, strokeWidth: 0.8, dashed: true },
        "main-object": { stroke: ink, strokeWidth: 1.3 },
      },
      labelStyle: { fontSize: 14, normalizeLatex: true },
      export: { scale: 1, grayscaleSafe: true, columnWidthCm: 9 },
    },
  },
  {
    id: "thesis-paper",
    name: "Thesis / Paper",
    category: "paper",
    isSystem: true,
    config: {
      canvas: { gridVisible: false, background: "#ffffff" },
      defaultObjectStyle: { stroke: ink, strokeWidth: 1.0, fill: "transparent" },
      roleStyles: {
        "main-object": { stroke: ink, strokeWidth: 1.15 },
        "construction-line": { stroke: "#737373", strokeWidth: 0.7, dashed: true, opacity: 0.8 },
        "function-curve": { stroke: ink, strokeWidth: 1.25 },
        "tangent-line": { stroke: "#525252", strokeWidth: 0.9, dashed: true },
        axis: { stroke: ink, strokeWidth: 0.95, arrow: true },
      },
      labelStyle: { fontSize: 11, normalizeLatex: true },
      export: { scale: 0.95, grayscaleSafe: true, columnWidthCm: 8 },
    },
  },
  {
    id: "beamer-presentation",
    name: "Beamer Presentation",
    category: "beamer",
    isSystem: true,
    config: {
      canvas: { gridVisible: false, background: "#ffffff" },
      defaultObjectStyle: { stroke: ink, strokeWidth: 1.35, fill: "transparent" },
      roleStyles: {
        "main-object": { stroke: ink, strokeWidth: 1.7 },
        "force-vector": { stroke: "#0f172a", strokeWidth: 2, arrow: true },
        "function-curve": { stroke: "#0f172a", strokeWidth: 1.8 },
        "construction-line": { stroke: muted, strokeWidth: 1, dashed: true },
      },
      labelStyle: { fontSize: 16, normalizeLatex: true },
      export: { scale: 1.12, grayscaleSafe: true, columnWidthCm: 11 },
    },
  },
  {
    id: "teaching",
    name: "Teaching",
    category: "teaching",
    isSystem: true,
    config: {
      canvas: { gridVisible: true, background: "#fbfdff" },
      defaultObjectStyle: { stroke: ink, strokeWidth: 1.2, fill: "transparent" },
      roleStyles: {
        "main-object": { stroke: blue, strokeWidth: 1.5 },
        "construction-line": { stroke: "#64748b", strokeWidth: 1, dashed: true },
        "force-vector": { stroke: emerald, strokeWidth: 1.8, arrow: true },
        "function-curve": { stroke: "#7c2d12", strokeWidth: 1.6 },
        "area-region": { fill: "#dbeafe", stroke: blue, opacity: 0.45 },
      },
      labelStyle: { fontSize: 15, normalizeLatex: true },
      export: { scale: 1.05, grayscaleSafe: false, columnWidthCm: 10 },
    },
  },
];

export function getStylePreset(id: string): StylePreset {
  return systemStylePresets.find((preset) => preset.id === id) ?? systemStylePresets[0];
}

export function validateStylePresetConfig(value: unknown): value is StylePresetConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<StylePresetConfig>;
  return Boolean(
    config.canvas &&
      typeof config.canvas.gridVisible === "boolean" &&
      typeof config.canvas.background === "string" &&
      config.defaultObjectStyle &&
      config.roleStyles &&
      config.labelStyle &&
      typeof config.labelStyle.fontSize === "number" &&
      typeof config.labelStyle.normalizeLatex === "boolean" &&
      config.export &&
      typeof config.export.scale === "number" &&
      typeof config.export.grayscaleSafe === "boolean" &&
      typeof config.export.columnWidthCm === "number",
  );
}

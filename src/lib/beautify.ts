import type { DiagramModel, DiagramObject, DiagramStyle } from "./diagram-types";
import { cloneDiagram, isVectorRole } from "./diagram-types";
import { normalizeLatexLabel } from "./latex-normalizer";
import { getStylePreset } from "./style-presets";

function mergeStyle(base: DiagramStyle, next: DiagramStyle): DiagramStyle {
  return { ...base, ...next };
}

function beautifyObject(object: DiagramObject, presetId: string): DiagramObject {
  const preset = getStylePreset(presetId);
  const roleStyle = preset.config.roleStyles[object.semanticRole] ?? {};
  const normalizedStyle = mergeStyle(
    mergeStyle(preset.config.defaultObjectStyle, roleStyle),
    object.style,
  );

  if (object.semanticRole === "construction-line") {
    normalizedStyle.strokeWidth = Math.min(normalizedStyle.strokeWidth ?? 0.8, 0.8);
    normalizedStyle.dashed = true;
    normalizedStyle.opacity = normalizedStyle.opacity ?? 0.78;
  }

  if (object.semanticRole === "main-object") {
    normalizedStyle.strokeWidth = Math.max(normalizedStyle.strokeWidth ?? 1.15, 1.15);
  }

  if (object.type === "Point") {
    normalizedStyle.pointSize = 3;
    normalizedStyle.fill = normalizedStyle.fill ?? "#111111";
  }

  if (object.type === "Vector" || isVectorRole(object.semanticRole)) {
    normalizedStyle.arrow = true;
    normalizedStyle.strokeWidth = Math.max(normalizedStyle.strokeWidth ?? 1.4, 1.45);
  }

  const normalizedLabel = normalizeLatexLabel(object.label, {
    type: object.type,
    semanticRole: object.semanticRole,
  });

  if (object.type === "Label") {
    return {
      ...object,
      label: normalizedLabel,
      text: normalizeLatexLabel(object.text, {
        type: object.type,
        semanticRole: object.semanticRole,
      }),
      style: normalizedStyle,
    };
  }

  return {
    ...object,
    label: normalizedLabel,
    style: normalizedStyle,
  };
}

export function beautifyDiagram(diagram: DiagramModel, presetId = diagram.metadata?.preset ?? "thesis-paper"): DiagramModel {
  const copy = cloneDiagram(diagram);
  const preset = getStylePreset(presetId);

  copy.gridVisible = preset.config.canvas.gridVisible;
  copy.metadata = {
    ...copy.metadata,
    preset: preset.id,
    updatedAt: new Date().toISOString(),
  };
  copy.objects = copy.objects.map((object) => beautifyObject(object, preset.id));

  return copy;
}

export function applySafeFixes(diagram: DiagramModel, presetId?: string): DiagramModel {
  return beautifyDiagram(diagram, presetId);
}

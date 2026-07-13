import type { DiagramModel, DiagramObject } from "./diagram-types";
import { applyObjectGeometryPatch, mirrorObject } from "./diagram-geometry";
import type { ObjectPatch } from "@/components/PropertiesPanel";

export function patchObject(object: DiagramObject, patch: ObjectPatch): DiagramObject {
  const { style, text, edgeLabels, geometry, lineKind, transform, ...rest } = patch;
  let base = geometry ? applyObjectGeometryPatch(object, geometry) : object;

  if (lineKind && object.type !== (lineKind === "line" ? "Line" : "Segment")) {
    base = convertLineKind(base, lineKind);
  }

  if (transform?.mirror) {
    base = mirrorObject(base, transform.mirror);
  }

  const next = {
    ...base,
    ...rest,
    ...(base.type === "Polygon" && edgeLabels
      ? { edgeLabels: edgeLabels.slice(0, base.points.length) }
      : {}),
    style: {
      ...base.style,
      ...style,
    },
  };

  if (object.type === "Label" && text !== undefined) {
    return { ...next, text } as DiagramObject;
  }

  return next as DiagramObject;
}

export function convertLineKind(object: DiagramObject, lineKind: "line" | "segment"): DiagramObject {
  if (lineKind === "line" && object.type === "Segment") {
    return {
      id: object.id,
      name: object.name.replace(/^Segment/, "Line"),
      type: "Line",
      label: object.label,
      visibility: object.visibility,
      through: [object.start, object.end],
      pointIds: object.startPointId && object.endPointId ? [object.startPointId, object.endPointId] : undefined,
      anchors: [object.startAnchor ?? null, object.endAnchor ?? null],
      semanticRole: "construction-line",
      style: object.style,
    };
  }

  if (lineKind === "segment" && object.type === "Line") {
    return {
      id: object.id,
      name: object.name.replace(/^Line/, "Segment"),
      type: "Segment",
      label: object.label,
      visibility: object.visibility,
      start: object.through[0],
      end: object.through[1],
      startPointId: object.pointIds?.[0],
      endPointId: object.pointIds?.[1],
      startAnchor: object.anchors?.[0] ?? undefined,
      endAnchor: object.anchors?.[1] ?? undefined,
      semanticRole: "main-object",
      style: object.style,
    };
  }

  return object;
}

export function updateDiagramObject(diagram: DiagramModel, objectId: string, patch: ObjectPatch): DiagramModel {
  return {
    ...diagram,
    objects: diagram.objects.map((object) =>
      object.id === objectId ? patchObject(object, patch) : object,
    ),
    metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
  };
}

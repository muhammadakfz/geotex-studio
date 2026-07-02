import { describe, expect, it } from "vitest";
import { toDiagramInsertPayload } from "@/lib/db/diagrams";
import { toDiagramVersionInsertPayload } from "@/lib/db/diagram-versions";
import { toStylePresetInsertPayload } from "@/lib/db/style-presets";
import { systemStylePresets, validateStylePresetConfig } from "@/lib/style-presets";
import { calculusFixture, geometryFixture } from "./fixtures";

describe("database payload helpers", () => {
  it("creates a diagram save payload with jsonb object model shape", () => {
    const diagram = calculusFixture();
    const payload = toDiagramInsertPayload("project-id", "owner-id", {
      name: diagram.name,
      diagramType: diagram.diagramType,
      objectModel: diagram,
      latestTikzCode: "\\begin{tikzpicture}\\end{tikzpicture}",
      latestLintScore: 92,
    });

    expect(payload.project_id).toBe("project-id");
    expect(payload.owner_id).toBe("owner-id");
    expect(payload.diagram_type).toBe("calculus");
    expect(payload.object_model).toMatchObject({ id: diagram.id, objects: expect.any(Array) });
  });

  it("creates a diagram version payload", () => {
    const diagram = geometryFixture();
    const payload = toDiagramVersionInsertPayload("diagram-id", "owner-id", 3, diagram, "tikz", 88, []);

    expect(payload.diagram_id).toBe("diagram-id");
    expect(payload.version_number).toBe(3);
    expect(payload.linter_score).toBe(88);
  });

  it("validates and serializes style preset configs", () => {
    const preset = systemStylePresets[0];
    expect(validateStylePresetConfig(preset.config)).toBe(true);

    const payload = toStylePresetInsertPayload("owner-id", "Custom", "custom", preset.config);
    expect(payload.is_system).toBe(false);
    expect(payload.config).toMatchObject({ canvas: { gridVisible: false } });
  });
});

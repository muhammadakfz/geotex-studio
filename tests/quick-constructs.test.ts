import { describe, expect, it } from "vitest";
import { createFunctionPlotObject, createQuickConstruct, normalizeFunctionExpression, sampleFunctionPlot } from "@/lib/quick-constructs";

describe("quick constructs", () => {
  it("normalizes common function input syntax", () => {
    expect(normalizeFunctionExpression("y = sin(x)^2")).toBe("Math.sin(x)**2");
    expect(normalizeFunctionExpression("f(x)=2x + 1")).toBe("2*x + 1");
  });

  it("samples function plots across the current viewport", () => {
    const plot = sampleFunctionPlot("x^2", { minX: -1, maxX: 1, minY: -1, maxY: 2 }, 3);

    expect(plot.samples).toEqual([
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it("creates a FunctionPlot object for the command bar", () => {
    const result = createFunctionPlotObject("cos(x)", { minX: 0, maxX: 1, minY: -1, maxY: 1 }, []);

    expect(result.object).toMatchObject({
      type: "FunctionPlot",
      expression: "cos(x)",
      semanticRole: "function-curve",
    });
  });

  it("creates linked math and physics templates", () => {
    const rightTriangle = createQuickConstruct("right-triangle", []);
    const freeBody = createQuickConstruct("free-body", []);
    const basis = createQuickConstruct("vector-basis", []);

    expect(rightTriangle.map((object) => object.type)).toEqual(["Point", "Point", "Point", "Polygon", "Angle"]);
    expect(rightTriangle.find((object) => object.type === "Polygon")).toMatchObject({
      pointIds: [
        rightTriangle[0].id,
        rightTriangle[1].id,
        rightTriangle[2].id,
      ],
    });
    expect(freeBody.filter((object) => object.type === "Vector")).toHaveLength(3);
    expect(basis.filter((object) => object.type === "Vector")).toHaveLength(2);
  });
});

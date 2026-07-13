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
    const result = createFunctionPlotObject("g(x)=cos(x)", { minX: 0, maxX: 1, minY: -1, maxY: 1 }, []);

    expect(result.object).toMatchObject({
      type: "FunctionPlot",
      expression: "cos(x)",
      label: "g(x)",
      semanticRole: "function-curve",
    });
  });

  it("creates GeoGebra-style objects from algebra commands", () => {
    const viewport = { minX: -2, maxX: 4, minY: -2, maxY: 4 };
    const pointA = createFunctionPlotObject("A=(0,0)", viewport, []).object!;
    const pointB = createFunctionPlotObject("B=(4,0)", viewport, [pointA]).object!;
    const pointC = createFunctionPlotObject("C=(0,3)", viewport, [pointA, pointB]).object!;
    const objects = [pointA, pointB, pointC];

    expect(createFunctionPlotObject("s=Segment(A,B)", viewport, objects).object).toMatchObject({
      type: "Segment",
      label: "s",
      startPointId: pointA.id,
      endPointId: pointB.id,
    });
    expect(createFunctionPlotObject("Circle(A,B)", viewport, objects).object).toMatchObject({
      type: "Circle",
      centerPointId: pointA.id,
      radius: 4,
    });
    expect(createFunctionPlotObject("Polygon(A,B,C)", viewport, objects).object).toMatchObject({
      type: "Polygon",
      pointIds: [pointA.id, pointB.id, pointC.id],
    });
    expect(createFunctionPlotObject("alpha=Angle(B,A,C)", viewport, objects).object).toMatchObject({
      type: "Angle",
      label: "alpha",
      pointIds: [pointB.id, pointA.id, pointC.id],
    });
    expect(createFunctionPlotObject("M=Midpoint(A,B)", viewport, objects).object).toMatchObject({
      type: "Point",
      label: "M",
      coordinates: { x: 2, y: 0 },
      semanticRole: "auxiliary-point",
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

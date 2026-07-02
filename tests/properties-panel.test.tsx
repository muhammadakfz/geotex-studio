// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { geometryFixture } from "./fixtures";

describe("PropertiesPanel", () => {
  it("emits style patches from color inputs", () => {
    const object = geometryFixture().objects[0];
    const onChange = vi.fn();
    const { container } = render(<PropertiesPanel object={object} onChange={onChange} />);
    const colors = container.querySelectorAll<HTMLInputElement>('input[type="color"]');

    fireEvent.input(colors[1], { target: { value: "#ff0000" } });

    expect(onChange).toHaveBeenCalledWith({ style: { fill: "#ff0000" } });
  });

  it("emits geometry patches from dimension inputs", () => {
    const object = geometryFixture().objects.find((item) => item.type === "Polygon");
    const onChange = vi.fn();
    const { getByRole } = render(<PropertiesPanel object={object} onChange={onChange} />);
    const widthInput = getByRole("spinbutton", { name: "W" });

    fireEvent.change(widthInput, { target: { value: "5.5" } });
    fireEvent.blur(widthInput);

    expect(onChange).toHaveBeenCalledWith({ geometry: { w: 5.5 } });
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostStatusInset,
  observeHostStatusInset,
} from "../../../presentation/composables/coforge/host-status-inset";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const bounds = (
  element: Element,
  x: number,
  y: number,
  width: number,
  height: number,
) =>
  vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(x, y, width, height));
function fixture(doc = document) {
  const root = doc.createElement("div");
  const bar = doc.createElement("div");
  bar.className = "status-bar";
  doc.body.append(root, bar);
  bounds(root, 0, 0, 800, 600);
  const position = bounds(bar, 500, 580, 300, 20);
  return { root, bar, position };
}

describe("actual native status-bar occlusion", () => {
  it("reserves only visible bottom-edge overlap, excluding other panes and host-flow space", () => {
    const { root, bar, position } = fixture();
    expect(hostStatusInset(root)).toBe(20);
    position.mockReturnValue(new DOMRect(500, 600, 300, 20));
    expect(hostStatusInset(root)).toBe(0);
    position.mockReturnValue(new DOMRect(900, 580, 300, 20));
    expect(hostStatusInset(root)).toBe(0);
    position.mockReturnValue(new DOMRect(500, 590, 300, 40));
    expect(hostStatusInset(root)).toBe(10);
    position.mockReturnValue(new DOMRect(500, 300, 300, 20));
    expect(hostStatusInset(root)).toBe(0);
    position.mockReturnValue(new DOMRect(500, 580, 300, 20));
    bar.style.visibility = "hidden";
    expect(hostStatusInset(root)).toBe(0);
  });
  it("updates measured padding when host geometry changes and releases listeners on disposal", async () => {
    const { root, bar, position } = fixture();
    const dispose = observeHostStatusInset(root);
    try {
      expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
        "20px",
      );
      position.mockReturnValue(new DOMRect(500, 590, 300, 30));
      window.dispatchEvent(new Event("resize"));
      await vi.waitFor(() =>
        expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
          "10px",
        ),
      );
      bar.remove();
      await vi.waitFor(() =>
        expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
          "0px",
        ),
      );
      document.body.append(bar);
      await vi.waitFor(() =>
        expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
          "10px",
        ),
      );
      dispose();
      position.mockReturnValue(new DOMRect(500, 580, 300, 20));
      window.dispatchEvent(new Event("resize"));
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve()),
        ),
      );
      expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe("");
    } finally {
      dispose();
    }
  });
  it("rebinds to the root owner document after moving into another window document", async () => {
    const { root } = fixture();
    const dispose = observeHostStatusInset(root);
    const other = document.implementation.createHTMLDocument(
      "Another native window",
    );
    const otherBar = other.createElement("div");
    otherBar.className = "status-bar";
    bounds(otherBar, 500, 590, 300, 10);
    other.body.append(otherBar);
    try {
      expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
        "20px",
      );
      other.body.append(root);
      await vi.waitFor(() =>
        expect(root.style.getPropertyValue("--cf-host-status-inset")).toBe(
          "10px",
        ),
      );
      expect(hostStatusInset(root)).toBe(10);
    } finally {
      dispose();
    }
  });
});

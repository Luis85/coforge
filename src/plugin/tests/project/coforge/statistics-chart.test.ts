import { describe, expect, it } from "vitest";
import { chartGeometry, inspectSeries } from "../../../presentation/composables/coforge/statistics-chart";
import type { StatisticsSeries } from "../../../features/coforge/domain/stream-statistics";
const series = (): StatisticsSeries => ({
  id: "a",
  startedAt: "2026-10-27T10:00:00Z",
  missing: 1,
  sampled: 4,
  points: [
    { minute: 0, value: 0, at: "", breakBefore: true, gapSeconds: 0 },
    { minute: 1, value: 10, at: "", breakBefore: false, gapSeconds: 0 },
    { minute: 2, value: null, at: "", breakBefore: false, gapSeconds: 0 },
    { minute: 5, value: 20, at: "", breakBefore: true, gapSeconds: 120 },
  ],
});
describe("statistics chart geometry", () => {
  it("breaks lines across missing intervals and keeps an isolated observation visible", () => {
    const model = chartGeometry([series()], 320);
    expect(model.lines[0]?.paths).toHaveLength(2);
    expect(model.lines[0]?.isolated).toHaveLength(1);
    expect(model.xTicks.length).toBeLessThanOrEqual(5);
    expect(model.yTicks.every((tick) => Number.isFinite(tick.position))).toBe(true);
  });
  it("bounds display geometry for long recordings while retaining extrema", () => {
    const source = series();
    source.points = Array.from({ length: 10000 }, (_, minute) => ({
      minute,
      value: minute === 4231 ? 9999 : minute % 10,
      at: "",
      breakBefore: minute === 0,
      gapSeconds: 0,
    }));
    const model = chartGeometry([source], 1000);
    expect(model.lines[0]!.retained.length).toBeLessThanOrEqual(604);
    expect(model.lines[0]!.retained.some((point) => point.value === 9999)).toBe(true);
    expect(model.reduced).toBe(true);
  });
  it("inspects actual observations without interpolating gaps or extending shorter streams", () => {
    expect(inspectSeries(series(), 1)?.value).toBe(10);
    expect(inspectSeries(series(), 3)).toBeNull();
    expect(inspectSeries(series(), 8)).toBeNull();
  });
});

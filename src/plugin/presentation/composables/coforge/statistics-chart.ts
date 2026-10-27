import type { MetricPoint, StatisticsSeries } from "../../../features/coforge/domain/stream-statistics";
const LIMIT = 600;
/** Preserve bucket extrema and real discontinuities while bounding SVG work for long recordings. */
function retainedPoints(points: readonly MetricPoint[]): MetricPoint[] {
  const kept = new Set<number>([0, points.length - 1]);
  const size = points.length <= LIMIT ? 1 : Math.ceil(points.length / ((LIMIT - 4) / 2));
  for (let start = 0; start < points.length; start += size) {
    let min = -1;
    let max = -1;
    for (let index = start; index < Math.min(points.length, start + size); index++) {
      const value = points[index]!.value;
      if (value === null) continue;
      if (min < 0 || value < points[min]!.value!) min = index;
      if (max < 0 || value > points[max]!.value!) max = index;
    }
    if (min >= 0) kept.add(min);
    if (max >= 0) kept.add(max);
  }
  let group = 0;
  let lastGroup = -1;
  return points.flatMap((point, index) => {
    if (point.breakBefore || point.value === null) group++;
    if (!kept.has(index) || point.value === null) return [];
    const result = { ...point, breakBefore: lastGroup !== group };
    lastGroup = group;
    return [result];
  });
}
export function inspectSeries(series: StatisticsSeries, minute: number): MetricPoint | null {
  const points = series.points;
  if (!points.length || minute < points[0]!.minute || minute > points[points.length - 1]!.minute) return null;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid]!.minute < minute) low = mid + 1;
    else high = mid;
  }
  const right = points[low]!;
  const left = points[Math.max(0, low - 1)]!;
  const point = Math.abs(left.minute - minute) <= Math.abs(right.minute - minute) ? left : right;
  return point.value !== null && Math.abs(point.minute - minute) <= 0.6 ? point : null;
}
export function chartGeometry(series: readonly StatisticsSeries[], measuredWidth: number, integer = false) {
  const width = Math.max(240, measuredWidth);
  const height = width < 520 ? 260 : 320;
  const left = width < 520 ? 48 : 64;
  const right = width - 20;
  const top = 24;
  const bottom = height - 44;
  let xMax = 1;
  let min = 0;
  let max = 0;
  let valid = 0;
  for (const line of series)
    for (const point of line.points) {
      xMax = Math.max(xMax, point.minute);
      if (point.value !== null) {
        min = Math.min(min, point.value);
        max = Math.max(max, point.value);
        valid++;
      }
    }
  const range = Math.max(1, max - min);
  const power = 10 ** Math.floor(Math.log10(range / 4));
  const fraction = range / 4 / power;
  const step = Math.max(integer ? 1 : 0, (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power);
  const yMin = Math.floor(min / step) * step;
  const yMax = Math.max(yMin + step, Math.ceil(max / step) * step);
  const x = (minute: number) => left + (minute / xMax) * (right - left);
  const y = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => ({
    value: yMin + step * i,
    position: y(yMin + step * i),
  }));
  const tickCount = width < 520 ? 3 : 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => ({
    value: (xMax * i) / (tickCount - 1),
    position: x((xMax * i) / (tickCount - 1)),
  }));
  const lines = series.map((line) => {
    const retained = retainedPoints(line.points);
    const segments: MetricPoint[][] = [];
    for (const point of retained) {
      if (point.breakBefore || !segments.length) segments.push([]);
      segments[segments.length - 1]!.push(point);
    }
    return {
      id: line.id,
      retained,
      paths: segments.map((segment) =>
        segment
          .map((point, index) => `${index ? "L" : "M"}${x(point.minute).toFixed(2)},${y(point.value!).toFixed(2)}`)
          .join(" "),
      ),
      isolated: segments
        .filter((segment) => segment.length === 1)
        .map((segment) => ({ x: x(segment[0]!.minute), y: y(segment[0]!.value!) })),
    };
  });
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    xMax,
    x,
    y,
    xTicks,
    yTicks,
    lines,
    valid,
    reduced: series.some((line) => line.points.length > LIMIT),
  };
}

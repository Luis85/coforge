import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from "vue";
import type { StatisticsSeries } from "../../../features/coforge/domain/stream-statistics";
import type { StatisticsMetric } from "../../../features/coforge/domain/statistics-metrics";
import { useStudioStore } from "../../stores/coforge-studio";
import { chartGeometry, inspectSeries } from "./statistics-chart";
import { elapsedTime, statisticNumber, streamDate } from "./statistics-format";

export function useStatisticsChart(props: { series: readonly StatisticsSeries[]; metric: StatisticsMetric }) {
  const store = useStudioStore();
  const width = ref(640);
  const element = ref<HTMLElement | null>(null);
  const titleId = `cf-statistics-${crypto.randomUUID()}`;
  let observer: ResizeObserver | undefined;
  const resize = () => {
    width.value = Math.max(240, element.value?.clientWidth || 640);
  };
  onMounted(() => {
    resize();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        width.value = Math.max(240, entries[0]?.contentRect.width || 640);
      });
      if (element.value) observer.observe(element.value);
    }
    window.addEventListener("resize", resize);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("resize", resize);
  });
  const geometry = computed(() => chartGeometry(props.series, width.value, props.metric.decimals === 0));
  watch(
    () => [props.series, props.metric.id],
    () => {
      store.statisticsCursor = props.series[0]?.points.filter((point) => point.value !== null).at(-1)?.minute ?? 0;
    },
    { immediate: true },
  );
  const inspected = computed(() =>
    props.series.map((series) => ({
      id: series.id,
      date: streamDate(series.startedAt),
      point: inspectSeries(series, store.statisticsCursor),
    })),
  );
  return reactive({
    store,
    geometry,
    titleId,
    inspected,
    elapsed: elapsedTime,
    format: statisticNumber,
    axis: (value: number, decimals: number) =>
      Math.abs(value) >= 10000
        ? value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
        : statisticNumber(value, decimals),
    streamDate,
    bind: (value: Element | ComponentPublicInstance | null) => {
      element.value = value instanceof HTMLElement ? value : null;
    },
    inspect: (event: PointerEvent) => {
      if (!(event.currentTarget instanceof SVGElement)) return;
      const box = event.currentTarget.getBoundingClientRect();
      const chart = geometry.value;
      const pixel = ((event.clientX - box.left) / box.width) * chart.width;
      store.statisticsCursor = Math.max(
        0,
        Math.min(chart.xMax, ((pixel - chart.left) / (chart.right - chart.left)) * chart.xMax),
      );
    },
    cursorX: computed(() => geometry.value.x(store.statisticsCursor)),
    cursorText: computed(
      () =>
        `Elapsed ${elapsedTime(store.statisticsCursor)}. ${inspected.value.map((item) => `${item.date}: ${statisticNumber(item.point?.value, props.metric.decimals)} ${props.metric.unit}`).join(". ")}`,
    ),
  });
}

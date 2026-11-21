import { onMounted, onBeforeUnmount } from "vue";

/** Calls fn now and every `ms` while the tab is visible. */
export function usePolling(fn, ms = 10000) {
  let timer = null;
  const tick = () => {
    if (document.visibilityState === "visible") fn();
  };
  const onVis = () => document.visibilityState === "visible" && fn();
  onMounted(() => {
    fn();
    timer = setInterval(tick, ms);
    document.addEventListener("visibilitychange", onVis);
  });
  onBeforeUnmount(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  });
}

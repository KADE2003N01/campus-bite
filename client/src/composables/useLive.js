import { onMounted, onBeforeUnmount } from "vue";
import { on } from "./useRealtime.js";

/**
 * Run `fn` whenever any of the given realtime events arrive (and after a reconnect),
 * for as long as the calling component is mounted.
 */
export function useLive(events, fn) {
  const offs = [];
  onMounted(() => {
    for (const e of [...events, "reconnected"]) offs.push(on(e, fn));
  });
  onBeforeUnmount(() => offs.forEach((off) => off()));
}

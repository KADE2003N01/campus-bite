import { ref } from "vue";

const toasts = ref([]);
let seq = 0;

const DEFAULTS = {
  success: { title: "Done", duration: 3500 },
  error: { title: "Something went wrong", duration: 6000 },
  warning: { title: "Heads up", duration: 5000 },
  info: { title: "", duration: 3500 },
};

/**
 * toast.success("Saved")                       → uses default title
 * toast.error("Card declined", "Payment failed") → custom title
 */
export function useToast() {
  function push(kind, message, title, opts = {}) {
    const id = ++seq;
    const d = { ...(DEFAULTS[kind] || DEFAULTS.info), ...opts };
    toasts.value.push({ id, kind, message, title: title ?? d.title, duration: d.duration });
    if (toasts.value.length > 4) toasts.value.shift();
    setTimeout(() => dismiss(id), d.duration);
  }
  function dismiss(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }
  return {
    toasts,
    dismiss,
    show: (m, t, o) => push("info", m, t, o),
    info: (m, t, o) => push("info", m, t, o),
    success: (m, t) => push("success", m, t),
    warning: (m, t) => push("warning", m, t),
    error: (m, t) => push("error", m, t),
  };
}

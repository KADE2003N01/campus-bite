// Promise-based in-app confirmation, used instead of the browser's window.confirm().
//   if (await confirmDialog({ title, body, confirmLabel, cancelLabel, danger })) { ... }
import { ref } from "vue";

export const confirmState = ref(null); // { title, body, confirmLabel, cancelLabel, danger, resolve }

export function confirmDialog(options) {
  // a newer question replaces an unanswered one (counted as "no")
  confirmState.value?.resolve(false);
  return new Promise((resolve) => {
    confirmState.value = { confirmLabel: "Confirm", cancelLabel: "Cancel", danger: false, ...options, resolve };
  });
}

export function answerConfirm(value) {
  const s = confirmState.value;
  confirmState.value = null;
  s?.resolve(value);
}

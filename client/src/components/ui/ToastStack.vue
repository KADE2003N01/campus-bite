<script setup>
import { useToast } from "../../composables/useToast.js";
const { toasts, dismiss } = useToast();

// Conventional toast colours so the meaning is instant: green = success, red = error, amber = warning, blue = info.
const STYLE = {
  success: { box: "bg-[#15803d] text-white", icon: "bg-white/20 text-white", label: "Success" },
  error: { box: "bg-[#dc2626] text-white", icon: "bg-white/20 text-white", label: "Error" },
  warning: { box: "bg-[#f59e0b] text-[#3b2400]", icon: "bg-black/10 text-[#3b2400]", label: "Warning" },
  info: { box: "bg-[#2563eb] text-white", icon: "bg-white/20 text-white", label: "Notice" },
};
</script>

<template>
  <!-- errors interrupt screen readers; everything else waits politely -->
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2.5 px-4 sm:top-5">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        :role="t.kind === 'error' ? 'alert' : 'status'"
        :aria-live="t.kind === 'error' ? 'assertive' : 'polite'"
        :class="STYLE[t.kind].box"
        class="pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl py-3.5 pl-4 pr-3 shadow-[0_14px_36px_-10px_rgba(0,0,0,0.45)]"
      >
        <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" :class="STYLE[t.kind].icon" :aria-label="STYLE[t.kind].label">
          <svg v-if="t.kind === 'success'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <svg v-else-if="t.kind === 'error'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M7 7l10 10M17 7L7 17" /></svg>
          <svg v-else-if="t.kind === 'warning'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 7v6" /><circle cx="12" cy="17.2" r="0.6" fill="currentColor" /></svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 11v6" /><circle cx="12" cy="7.2" r="0.6" fill="currentColor" /></svg>
        </span>
        <div class="min-w-0 flex-1 text-sm">
          <p v-if="t.title" class="font-semibold">{{ t.title }}</p>
          <p class="leading-snug opacity-95" :class="t.title && 'mt-0.5'">{{ t.message }}</p>
        </div>
        <button class="-mr-1 -mt-1 rounded-md p-1.5 opacity-80 hover:bg-black/10 hover:opacity-100" aria-label="Dismiss notification" @click="dismiss(t.id)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span class="toast-timer absolute bottom-0 left-0 h-1 bg-current opacity-30" :style="{ animationDuration: `${t.duration}ms` }" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
.toast-timer {
  width: 100%;
  animation: toast-timer linear forwards;
}
@keyframes toast-timer {
  from { width: 100%; }
  to { width: 0%; }
}
</style>

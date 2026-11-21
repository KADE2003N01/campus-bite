<script setup>
import { watch, onBeforeUnmount } from "vue";
const props = defineProps({
  open: Boolean,
  title: String,
  width: { type: String, default: "max-w-lg" },
});
const emit = defineEmits(["close"]);
const onKey = (e) => e.key === "Escape" && emit("close");
watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? "hidden" : "";
    v ? window.addEventListener("keydown", onKey) : window.removeEventListener("keydown", onKey);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  document.body.style.overflow = "";
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 sm:items-center sm:p-6" @mousedown.self="emit('close')">
        <div class="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-card shadow-2xl sm:rounded-xl" :class="width" role="dialog" :aria-label="title">
          <header v-if="title" class="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 class="display text-xl font-semibold">{{ title }}</h2>
            <button class="-mr-2 rounded-md p-2 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close" @click="emit('close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <div class="overflow-y-auto px-5 py-5">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="flex justify-end gap-2 border-t border-line px-5 py-3.5">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

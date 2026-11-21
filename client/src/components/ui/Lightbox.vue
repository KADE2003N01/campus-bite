<script setup>
import { watch, onBeforeUnmount } from "vue";
const props = defineProps({ photos: Array, index: Number });
const emit = defineEmits(["close", "update:index"]);
const go = (d) => emit("update:index", (props.index + d + props.photos.length) % props.photos.length);
const onKey = (e) => {
  if (props.index == null) return;
  if (e.key === "Escape") emit("close");
  if (e.key === "ArrowRight") go(1);
  if (e.key === "ArrowLeft") go(-1);
};
watch(
  () => props.index,
  (v) => (v != null ? window.addEventListener("keydown", onKey) : window.removeEventListener("keydown", onKey)),
);
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="index != null && photos?.length" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" @click.self="emit('close')">
        <img :src="photos[index].url" class="max-h-[85vh] max-w-full rounded-md object-contain" alt="Customer photo" />
        <p v-if="photos[index].caption" class="absolute bottom-6 left-1/2 max-w-md -translate-x-1/2 text-center text-sm text-white/80">{{ photos[index].caption }}</p>
        <button class="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Close" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <template v-if="photos.length > 1">
          <button class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous" @click="go(-1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next" @click="go(1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <span class="absolute left-4 top-5 font-mono text-xs text-white/60">{{ index + 1 }} / {{ photos.length }}</span>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

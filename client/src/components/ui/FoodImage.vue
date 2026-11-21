<script setup>
import { ref, computed } from "vue";
const props = defineProps({
  src: String,
  alt: { type: String, default: "" },
  rounded: { type: String, default: "rounded-lg" },
  eager: Boolean,
});
const failed = ref(false);
const palette = [
  ["#F3F3D9", "#4A4A4A"],
  ["#E3E8ED", "#56697E"],
  ["#E6E6E6", "#4A4A4A"],
  ["#EDEDD3", "#6D8196"],
];
const tone = computed(() => palette[(props.alt.length * 7 + (props.alt.charCodeAt(0) || 0)) % palette.length]);
const letter = computed(() => props.alt.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "·");
</script>

<template>
  <div class="relative overflow-hidden" :class="rounded" :style="{ background: tone[0] }">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <div v-else class="flex h-full w-full items-center justify-center" aria-hidden="true">
      <span class="display text-[2.2em] italic leading-none opacity-70" :style="{ color: tone[1] }">{{ letter }}</span>
    </div>
    <slot />
  </div>
</template>

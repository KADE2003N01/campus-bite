<script setup>
import { ref, computed } from "vue";
const props = defineProps({
  src: String,
  alt: { type: String, default: "" },
  rounded: { type: String, default: "rounded-xl" },
  eager: Boolean,
});
const failed = ref(false);
// placeholder tiles (no photo): palette tints, with darker versions for dark mode
const palette = [
  "bg-[#F3F3D9] text-[#4A4A4A] dark:bg-[#2b2b26] dark:text-[#CBCBCB]",
  "bg-[#E3E8ED] text-[#56697E] dark:bg-[#2a323b] dark:text-[#aebfd0]",
  "bg-[#E6E6E6] text-[#4A4A4A] dark:bg-[#2c2c2c] dark:text-[#CBCBCB]",
  "bg-[#EDEDD3] text-[#6D8196] dark:bg-[#29291f] dark:text-[#aebfd0]",
];
const tone = computed(() => palette[(props.alt.length * 7 + (props.alt.charCodeAt(0) || 0)) % palette.length]);
const letter = computed(() => props.alt.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "·");
</script>

<template>
  <div class="relative overflow-hidden" :class="[rounded, tone]">
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
      <span class="display text-[2.2em] italic leading-none opacity-70" >{{ letter }}</span>
    </div>
    <slot />
  </div>
</template>

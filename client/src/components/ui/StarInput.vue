<script setup>
import { ref } from "vue";
const model = defineModel({ type: Number, default: 0 });
const hover = ref(0);
const words = ["", "Bad", "Not great", "Okay", "Good", "Excellent"];
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="flex" @mouseleave="hover = 0">
      <button
        v-for="i in 5"
        :key="i"
        type="button"
        class="p-0.5"
        :aria-label="`${i} star${i > 1 ? 's' : ''}`"
        @mouseenter="hover = i"
        @click="model = i"
      >
        <svg width="34" height="34" viewBox="0 0 20 20">
          <path
            :fill="(hover || model) >= i ? '#4A4A4A' : '#CBCBCB'"
            class="transition-colors"
            d="M10 1.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L10 15l-5.3 2.8 1.1-5.9L1.4 7.8l6-.8z"
          />
        </svg>
      </button>
    </div>
    <span class="text-sm font-semibold text-ink-2">{{ words[hover || model] }}</span>
  </div>
</template>

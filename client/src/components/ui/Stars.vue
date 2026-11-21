<script setup>
const props = defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 14 },
});
const fill = (i) => Math.max(0, Math.min(1, props.value - (i - 1)));
</script>

<template>
  <span class="inline-flex items-center gap-[1px]" :aria-label="`${value} out of 5`">
    <svg v-for="i in 5" :key="i" :width="size" :height="size" viewBox="0 0 20 20">
      <defs>
        <linearGradient :id="`s${i}-${Math.round(value * 10)}`">
          <stop :offset="`${fill(i) * 100}%`" stop-color="#4A4A4A" />
          <stop :offset="`${fill(i) * 100}%`" stop-color="#CBCBCB" />
        </linearGradient>
      </defs>
      <path
        :fill="`url(#s${i}-${Math.round(value * 10)})`"
        d="M10 1.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L10 15l-5.3 2.8 1.1-5.9L1.4 7.8l6-.8z"
      />
    </svg>
  </span>
</template>

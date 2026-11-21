<script setup>
import { computed } from "vue";
import { STATUS } from "../../lib/format.js";
const props = defineProps({ status: String, short: Boolean });
const s = computed(() => STATUS[props.status] || { label: props.status, tone: "muted" });
const tones = {
  honey: "bg-paper-2 text-ink ring-1 ring-line-2",
  sky: "bg-sky-soft text-sky",
  plum: "bg-plum-soft text-plum",
  forest: "bg-forest text-white",
  muted: "bg-paper-2 text-ink-2",
  chili: "bg-danger-soft text-danger",
};
</script>

<template>
  <span class="tag" :class="tones[s.tone]">
    <span class="h-1.5 w-1.5 rounded-full bg-current" :class="status === 'SUBMITTED' && 'animate-pulse'" />
    {{ short ? s.short : s.label }}
  </span>
</template>

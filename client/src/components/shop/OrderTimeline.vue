<script setup>
import { computed } from "vue";
import { clock } from "../../lib/format.js";

const props = defineProps({ order: Object });
const steps = computed(() => {
  const o = props.order;
  return [
    { key: "SUBMITTED", label: "Submitted", at: o.created_at },
    { key: "ACCEPTED", label: "Accepted by the vendor", at: o.accepted_at },
    { key: "PREPARING", label: "Preparing", at: null },
    { key: "READY", label: "Ready for pickup", at: o.ready_at },
    { key: "COMPLETED", label: "Completed", at: o.completed_at },
  ];
});
const order = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
// Once picked up, every step is done (no "in progress" dot).
const current = computed(() => (props.order.status === "COMPLETED" ? order.length : order.indexOf(props.order.status)));
</script>

<template>
  <ol class="relative">
    <li v-for="(s, i) in steps" :key="s.key" class="relative flex gap-4 pb-6 last:pb-0">
      <span v-if="i < steps.length - 1" class="absolute left-[9px] top-5 h-full w-[2px]" :class="i < current ? 'bg-forest' : 'bg-line'" />
      <span
        class="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
        :class="i < current ? 'border-forest bg-forest' : i === current ? 'border-forest bg-card' : 'border-line-2 bg-card'"
      >
        <svg v-if="i < current" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M5 12l5 5 9-10" /></svg>
        <span v-else-if="i === current" class="h-2 w-2 animate-pulse rounded-full bg-forest" />
      </span>
      <div class="flex flex-1 items-baseline justify-between gap-3">
        <p class="text-sm" :class="i <= current ? 'font-semibold text-ink' : 'text-muted'">{{ s.label }}</p>
        <p v-if="s.at && i <= current" class="num font-mono text-xs text-muted">{{ clock(s.at) }}</p>
      </div>
    </li>
  </ol>
</template>

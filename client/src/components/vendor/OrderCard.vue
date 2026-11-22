<script setup>
import { computed } from "vue";
import { rwf, clock, minutesUntil, PAYMENT } from "../../lib/format.js";

const props = defineProps({ order: Object, busy: Boolean, now: Number, fresh: Boolean });
const emit = defineEmits(["advance", "cancel"]);

const NEXT = {
  SUBMITTED: { status: "ACCEPTED", label: "Accept" },
  ACCEPTED: { status: "PREPARING", label: "Start preparing" },
  PREPARING: { status: "READY", label: "Mark ready" },
  READY: { status: "COMPLETED", label: "Mark completed" },
};
const next = computed(() => NEXT[props.order.status]);

const mins = computed(() => {
  void props.now;
  return minutesUntil(props.order.pickup_time);
});
// "in 25 min", "in 1 h 10", "8 min late", "2 h late"
const span = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 && m < 600 ? ` ${m % 60}` : ""}`);
const countdown = computed(() => {
  const m = mins.value;
  if (m > 0) return `in ${span(m)}`;
  if (m === 0) return "now";
  return `${span(-m)} late`;
});
const paid = computed(() => props.order.payment_status === "PAID");
</script>

<template>
  <article
    class="rounded-lg border bg-card p-3 text-sm shadow-[0_1px_0_rgba(0,0,0,0.03)] transition"
    :class="fresh ? 'border-honey ring-2 ring-honey/30' : 'border-line'"
  >
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-mono text-[0.8rem] font-semibold tracking-wide">{{ order.code }}</p>
        <p class="truncate font-medium">{{ order.student?.name }}</p>
        <a v-if="order.student?.phone" :href="`tel:${order.student.phone}`" class="num text-xs text-muted hover:text-ink">{{ order.student.phone }}</a>
      </div>
      <div class="shrink-0 text-right">
        <p class="num font-semibold">{{ clock(order.pickup_time) }}</p>
        <p class="num text-xs font-semibold" :class="mins < 0 && order.status !== 'READY' ? 'text-danger' : mins <= 10 ? 'text-ink' : 'text-muted'">
          {{ countdown }}
        </p>
      </div>
    </header>

    <ul class="mt-2.5 space-y-0.5 border-t border-dashed border-line pt-2.5">
      <li v-for="it in order.items" :key="it.id" class="flex gap-2">
        <span class="num w-6 shrink-0 font-semibold">{{ it.quantity }}×</span>
        <span class="min-w-0 flex-1">{{ it.menu_item.name }}</span>
      </li>
    </ul>

    <p v-if="order.note" class="mt-2 rounded bg-honey-soft px-2 py-1.5 text-xs font-medium text-ink">“{{ order.note }}”</p>

    <div class="mt-2.5 flex items-center justify-between gap-2 text-xs">
      <span class="tag" :class="paid ? 'bg-forest-soft text-forest' : 'bg-paper-2 text-ink-2'">
        {{ PAYMENT[order.payment_method] }} · {{ paid ? "Paid" : order.payment_method === "CASH" ? "Collect cash" : "Awaiting payment" }}
      </span>
      <span class="num font-semibold">{{ rwf(order.total_amount) }}</span>
    </div>

    <div class="mt-3 flex gap-2">
      <button class="btn btn-sm flex-1" :class="order.status === 'READY' ? 'btn-dark' : 'btn-primary'" :disabled="busy" @click="emit('advance', next.status)">
        {{ next.label }}
      </button>
      <button class="btn btn-sm btn-ghost text-danger" :disabled="busy" @click="emit('cancel')">Cancel</button>
    </div>
  </article>
</template>

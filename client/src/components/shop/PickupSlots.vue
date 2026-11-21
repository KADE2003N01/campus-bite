<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import api from "../../composables/useApi.js";
import { clock, minutesUntil } from "../../lib/format.js";

const model = defineModel({ type: String });
const props = defineProps({ vendor: Object });
const slots = ref([]);
const loading = ref(true);

async function load() {
  if (!props.vendor?.id) return;
  try {
    slots.value = (await api.get(`/vendors/${props.vendor.id}/slots`)).data.slots;
  } catch {
    slots.value = [];
  } finally {
    loading.value = false;
  }
  const current = slots.value.find((s) => s.time === model.value);
  if (!current || current.full) model.value = slots.value.find((s) => !s.full)?.time || "";
}

watch(() => props.vendor?.id, load, { immediate: true });
const timer = setInterval(load, 60000); // keep "spots left" honest while the student decides
onBeforeUnmount(() => clearInterval(timer));
defineExpose({ reload: load });

const left = (s) => s.capacity - s.taken;
const inTime = (iso) => {
  const m = minutesUntil(iso);
  return m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
};
</script>

<template>
  <div>
    <div v-if="loading" class="grid grid-cols-3 gap-2 sm:grid-cols-6"><div v-for="i in 6" :key="i" class="skeleton h-14" /></div>
    <fieldset v-else-if="slots.length" class="grid grid-cols-3 gap-2 sm:grid-cols-6">
      <legend class="sr-only">Pickup time</legend>
      <button
        v-for="(s, i) in slots"
        :key="s.time"
        type="button"
        :disabled="s.full"
        :aria-pressed="model === s.time"
        :aria-label="`${clock(s.time)}${s.full ? ', full' : ''}`"
        class="rounded-md border px-2 py-2 text-center transition disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:opacity-60"
        :class="model === s.time ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card hover:border-ink'"
        @click="model = s.time"
      >
        <span class="num block text-sm font-semibold">{{ clock(s.time) }}</span>
        <span class="block text-[0.7rem]" :class="model === s.time ? 'text-paper/80' : 'text-muted'">
          <template v-if="s.full">Full</template>
          <template v-else-if="left(s) <= 2">{{ left(s) }} left</template>
          <template v-else-if="i === 0">Earliest</template>
          <template v-else>{{ inTime(s.time) }}</template>
        </span>
      </button>
    </fieldset>
    <p v-else class="rounded-md border border-line bg-paper-2 px-4 py-3 text-sm text-ink">
      No pickup times left today. {{ vendor?.shop_name }} closes at {{ vendor?.closes_at }}. Your basket is saved for later.
    </p>
    <p v-if="slots.length" class="hint">Each 10-minute slot takes a limited number of orders so the counter doesn't get crowded.</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { rwf, when, PAYMENT } from "../../lib/format.js";
import StatusPill from "../../components/ui/StatusPill.vue";
import FoodImage from "../../components/ui/FoodImage.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const orders = ref([]);
const loading = ref(true);
const error = ref("");
const tab = ref("active");

const ACTIVE = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"];
const active = computed(() => orders.value.filter((o) => ACTIVE.includes(o.status)));
const past = computed(() => orders.value.filter((o) => !ACTIVE.includes(o.status)));
const list = computed(() => (tab.value === "active" ? active.value : past.value));
const toReview = computed(() => past.value.filter((o) => o.status === "COMPLETED" && !o.review).length);
const spent = computed(() => past.value.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total_amount, 0));

onMounted(async () => {
  try {
    orders.value = (await api.get("/orders")).data;
    if (!active.value.length) tab.value = "past";
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="display text-[2.2rem] font-semibold">Your orders</h1>
      <p v-if="past.length" class="num text-sm text-muted">{{ past.length }} past orders · {{ rwf(spent) }} spent</p>
    </div>

    <div class="mt-6 flex gap-6 border-b border-line">
      <button v-for="t in [['active', 'In progress', active.length], ['past', 'Past', past.length]]" :key="t[0]" class="relative pb-3 text-sm font-semibold" :class="tab === t[0] ? 'text-ink' : 'text-muted hover:text-ink'" @click="tab = t[0]">
        {{ t[1] }} <span class="num font-normal text-muted">{{ t[2] }}</span>
        <span v-if="tab === t[0]" class="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />
      </button>
    </div>

    <p v-if="toReview && tab === 'past'" class="mt-5 rounded-md bg-honey-soft px-4 py-3 text-sm text-ink">
      {{ toReview }} order{{ toReview > 1 ? "s" : "" }} waiting for your rating. Reviews with photos help other students pick.
    </p>

    <div v-if="loading" class="mt-6 space-y-3"><div v-for="i in 4" :key="i" class="skeleton h-24" /></div>
    <p v-else-if="error" class="mt-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

    <ul v-else-if="list.length" class="mt-6 space-y-3">
      <li v-for="o in list" :key="o.id">
        <RouterLink :to="`/orders/${o.id}`" class="card flex gap-4 p-4 transition hover:shadow-[var(--shadow-pop)]">
          <FoodImage :src="o.items[0]?.menu_item.image_url || o.vendor.cover_url" :alt="o.vendor.shop_name" class="h-20 w-20 shrink-0 text-xl" rounded="rounded-md" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-semibold">{{ o.vendor.shop_name }}</p>
              <StatusPill :status="o.status" />
            </div>
            <p class="mt-0.5 truncate text-sm text-ink-2">{{ o.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(", ") }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span class="font-mono">{{ o.code }}</span>
              <span>{{ ACTIVE.includes(o.status) ? `Pickup ${when(o.pickup_time)}` : when(o.created_at) }}</span>
              <span>{{ PAYMENT[o.payment_method] }}</span>
              <span class="num font-semibold text-ink">{{ rwf(o.total_amount) }}</span>
              <span v-if="o.status === 'COMPLETED' && !o.review" class="font-semibold text-chili">Rate this order →</span>
              <span v-else-if="o.review" class="text-honey">{{ "★".repeat(o.review.rating) }}</span>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>

    <EmptyState v-else class="mt-8" :title="tab === 'active' ? 'Nothing cooking right now' : 'No past orders yet'" body="When you order, you'll be able to follow it here from kitchen to counter.">
      <RouterLink to="/" class="btn btn-primary">Find something to eat</RouterLink>
    </EmptyState>
  </div>
</template>

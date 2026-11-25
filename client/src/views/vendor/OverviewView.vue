<script setup>
import { ref, computed, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { rwf, num, ago, STATUS } from "../../lib/format.js";
import { assetUrl } from "../../lib/urls.js";
import KpiCard from "../../components/vendor/KpiCard.vue";
import FoodImage from "../../components/ui/FoodImage.vue";
import Stars from "../../components/ui/Stars.vue";

const toast = useToast();
const stats = ref(null);
const reviews = ref([]);
const loading = ref(true);
const hover = ref(null);

async function load() {
  try {
    const [s, r] = await Promise.all([api.get("/vendor/stats"), api.get("/vendor/reviews")]);
    stats.value = s.data;
    reviews.value = r.data.reviews.slice(0, 3);
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const delta = computed(() => {
  const y = stats.value?.yesterday.revenue;
  if (!y) return null;
  return Math.round(((stats.value.today.revenue - y) / y) * 100);
});

const maxRev = computed(() => Math.max(1, ...(stats.value?.series || []).map((d) => d.revenue)));
const hours = computed(() => (stats.value?.busy_hours || []).slice(6, 23).map((n, i) => ({ h: i + 6, n })));
const maxHour = computed(() => Math.max(1, ...hours.value.map((h) => h.n)));

const queue = computed(() =>
  ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"].map((s) => ({ s, label: STATUS[s].short, n: stats.value?.queue?.[s] || 0 })),
);

function dayName(date) {
  return new Date(date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
</script>

<template>
  <div v-if="loading" class="space-y-4">
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="skeleton h-28" />
    </div>
    <div class="skeleton h-64" />
  </div>

  <div v-else-if="stats" class="space-y-6">
    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard label="Sales today" :value="rwf(stats.today.revenue)" :delta="delta" :sub="`vs ${num(stats.yesterday.revenue)} yesterday`" />
      <KpiCard label="Orders today" :value="String(stats.today.orders)" :sub="`${stats.yesterday.orders} yesterday`" />
      <KpiCard label="Avg. order" :value="rwf(stats.today.avg_order)" sub="today" />
      <KpiCard label="Rating" :value="stats.rating.count ? stats.rating.average.toFixed(1) : '—'" :sub="`${stats.rating.count} reviews`">
        <Stars class="mt-1.5" :value="stats.rating.average" :size="13" />
      </KpiCard>
    </div>

    <!-- Live queue -->
    <RouterLink to="/vendor/orders" class="card flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 transition hover:shadow-[var(--shadow-pop)]">
      <span class="eyebrow">Live queue</span>
      <span v-for="q in queue" :key="q.s" class="flex items-baseline gap-1.5 text-sm">
        <span class="num text-lg font-semibold" :class="q.s === 'SUBMITTED' && q.n ? 'text-chili' : ''">{{ q.n }}</span>
        <span class="text-muted">{{ q.label }}</span>
      </span>
      <span class="ml-auto text-sm font-semibold text-forest">Open board →</span>
    </RouterLink>

    <div class="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <!-- Revenue chart -->
      <section class="card p-4 sm:p-5">
        <div class="flex items-baseline justify-between">
          <h2 class="font-semibold">Sales, last 14 days</h2>
          <span class="num text-sm text-muted">{{ rwf(stats.series.reduce((s, d) => s + d.revenue, 0)) }}</span>
        </div>
        <div class="relative mt-5 flex h-48 items-end gap-1 sm:gap-1.5" @mouseleave="hover = null">
          <div
            v-for="(d, i) in stats.series"
            :key="d.date"
            class="group relative flex h-full flex-1 cursor-default flex-col justify-end"
            @mouseenter="hover = i"
          >
            <div
              class="w-full rounded-t-[3px] transition-colors"
              :class="i === stats.series.length - 1 ? 'bg-chili' : hover === i ? 'bg-forest-2' : 'bg-forest'"
              :style="{ height: `${Math.max(2, (d.revenue / maxRev) * 100)}%` }"
            />
            <div
              v-if="hover === i"
              class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
            >
              <p class="font-semibold">{{ dayName(d.date) }}</p>
              <p class="num">{{ rwf(d.revenue) }} · {{ d.orders }} orders</p>
            </div>
          </div>
        </div>
        <div class="mt-2 flex justify-between text-[0.7rem] text-muted">
          <span>{{ dayName(stats.series[0].date) }}</span>
          <span>Today</span>
        </div>
      </section>

      <!-- 30-day facts -->
      <section class="card divide-y divide-line">
        <h2 class="px-4 py-3 font-semibold sm:px-5">Last 30 days</h2>
        <dl class="divide-y divide-line text-sm">
          <div class="flex justify-between px-4 py-2.5 sm:px-5"><dt class="text-muted">Revenue</dt><dd class="num font-semibold">{{ rwf(stats.last30.revenue) }}</dd></div>
          <div class="flex justify-between px-4 py-2.5 sm:px-5"><dt class="text-muted">Orders</dt><dd class="num font-semibold">{{ num(stats.last30.orders) }}</dd></div>
          <div class="flex justify-between px-4 py-2.5 sm:px-5">
            <dt class="text-muted">Cancelled</dt>
            <dd class="num font-semibold" :class="stats.last30.cancel_rate > 10 && 'text-danger'">{{ stats.last30.cancelled }} ({{ stats.last30.cancel_rate }}%)</dd>
          </div>
          <div class="flex justify-between px-4 py-2.5 sm:px-5"><dt class="text-muted">Customers</dt><dd class="num font-semibold">{{ stats.last30.customers }}</dd></div>
          <div class="flex justify-between px-4 py-2.5 sm:px-5">
            <dt class="text-muted">Came back again</dt>
            <dd class="num font-semibold">{{ stats.last30.repeat_customers }} <span class="font-normal text-muted">({{ stats.last30.customers ? Math.round((stats.last30.repeat_customers / stats.last30.customers) * 100) : 0 }}%)</span></dd>
          </div>
          <div class="flex justify-between px-4 py-2.5 sm:px-5"><dt class="text-muted">Avg. prep time</dt><dd class="num font-semibold">{{ stats.avg_prep_minutes != null ? `${stats.avg_prep_minutes} min` : "—" }}</dd></div>
        </dl>
      </section>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Top sellers -->
      <section class="card">
        <div class="flex items-baseline justify-between px-4 py-3 sm:px-5">
          <h2 class="font-semibold">Top sellers</h2>
          <RouterLink to="/vendor/menu" class="text-sm font-semibold text-forest hover:underline">Menu</RouterLink>
        </div>
        <ol v-if="stats.top_items.length" class="divide-y divide-line border-t border-line">
          <li v-for="(it, i) in stats.top_items" :key="it.id" class="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span class="num w-4 text-sm text-muted">{{ i + 1 }}</span>
            <FoodImage :src="it.image_url" :alt="it.name" class="h-10 w-10 shrink-0 text-[0.55rem]" rounded="rounded-md" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ it.name }}</span>
            <span class="num text-right text-sm">
              <span class="font-semibold">{{ it.qty }}</span> <span class="text-muted">sold</span>
              <span class="block text-xs text-muted">{{ rwf(it.revenue) }}</span>
            </span>
          </li>
        </ol>
        <p v-else class="border-t border-line px-5 py-8 text-center text-sm text-muted">No sales yet.</p>
      </section>

      <!-- Busy hours -->
      <section class="card p-4 sm:p-5">
        <h2 class="font-semibold">When customers pick up</h2>
        <p class="text-xs text-muted">Pickups by hour, last 30 days</p>
        <div class="mt-5 flex h-32 items-end gap-[3px]">
          <div v-for="h in hours" :key="h.h" class="flex h-full flex-1 flex-col justify-end" :title="`${h.h}:00 — ${h.n} pickups`">
            <div class="w-full rounded-t-[2px]" :class="h.n === maxHour ? 'bg-honey' : 'bg-line-2'" :style="{ height: `${Math.max(3, (h.n / maxHour) * 100)}%` }" />
          </div>
        </div>
        <div class="mt-1.5 flex justify-between text-[0.7rem] text-muted num">
          <span>06</span><span>10</span><span>14</span><span>18</span><span>22</span>
        </div>
      </section>
    </div>

    <!-- Latest reviews -->
    <section class="card">
      <div class="flex items-baseline justify-between px-4 py-3 sm:px-5">
        <h2 class="font-semibold">Latest reviews</h2>
        <RouterLink to="/vendor/reviews" class="text-sm font-semibold text-forest hover:underline">
          All reviews<span v-if="stats.rating.unreplied"> · {{ stats.rating.unreplied }} need a reply</span>
        </RouterLink>
      </div>
      <ul v-if="reviews.length" class="divide-y divide-line border-t border-line">
        <li v-for="r in reviews" :key="r.id" class="flex gap-4 px-4 py-3 sm:px-5">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <Stars :value="r.rating" :size="12" />
              <span class="font-semibold">{{ r.author }}</span>
              <span class="text-xs text-muted">{{ ago(r.created_at) }}</span>
              <span v-if="!r.vendor_reply" class="tag bg-honey-soft text-ink">No reply</span>
            </div>
            <p class="mt-1 line-clamp-2 text-sm text-ink-2">{{ r.comment || "No comment, just a rating." }}</p>
          </div>
            <img v-if="r.photos.length" :src="assetUrl(r.photos[0].url)" alt="" class="h-14 w-14 shrink-0 rounded-md object-cover" />
        </li>
      </ul>
      <p v-else class="border-t border-line px-5 py-8 text-center text-sm text-muted">No reviews yet.</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { useShopStore } from "../../stores/shop.js";
import Stars from "../../components/ui/Stars.vue";
import Lightbox from "../../components/ui/Lightbox.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import ReviewItem from "../../components/vendor/ReviewItem.vue";

const toast = useToast();
const shop = useShopStore();
const all = ref([]); // unfiltered, for the summary
const list = ref([]);
const filter = ref("all");
const loading = ref(true);
const lbPhotos = ref([]);
const lbIndex = ref(null);

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get("/vendor/reviews", { params: filter.value === "all" ? {} : { filter: filter.value } });
    list.value = data.reviews;
    if (filter.value === "all") all.value = data.reviews;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  await load();
});
watch(filter, load);

const summary = computed(() => {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of all.value) {
    dist[r.rating]++;
    sum += r.rating;
  }
  const n = all.value.length;
  return {
    n,
    avg: n ? sum / n : 0,
    dist,
    unreplied: all.value.filter((r) => !r.vendor_reply).length,
    photos: all.value.filter((r) => r.photos.length).length,
    max: Math.max(1, ...Object.values(dist)),
  };
});

function onUpdated(r) {
  for (const arr of [list.value, all.value]) {
    const i = arr.findIndex((x) => x.id === r.id);
    if (i >= 0) arr[i] = r;
  }
  if (filter.value === "unreplied" && r.vendor_reply) list.value = list.value.filter((x) => x.id !== r.id);
}

function openPhoto(review, i) {
  lbPhotos.value = review.photos.map((p) => ({ url: p.url, caption: `${review.author} · ${review.rating}★` }));
  lbIndex.value = i;
}

const FILTERS = computed(() => [
  { k: "all", label: "All", n: summary.value.n },
  { k: "unreplied", label: "Needs reply", n: summary.value.unreplied },
  { k: "photos", label: "With photos", n: summary.value.photos },
  { k: "low", label: "3 stars or less", n: summary.value.dist[1] + summary.value.dist[2] + summary.value.dist[3] },
]);
</script>

<template>
  <div>
    <section class="card mb-5 grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:gap-8">
      <div>
        <p class="display text-5xl font-semibold leading-none num">{{ summary.n ? summary.avg.toFixed(1) : "—" }}</p>
        <Stars class="mt-2" :value="summary.avg" :size="16" />
        <p class="mt-1 text-sm text-muted">{{ summary.n }} reviews · shown publicly as {{ shop.profile?.rating_avg?.toFixed(1) }}</p>
      </div>
      <div class="space-y-1.5 self-center">
        <div v-for="s in [5, 4, 3, 2, 1]" :key="s" class="flex items-center gap-3 text-sm">
          <span class="num w-3 text-muted">{{ s }}</span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
            <div class="h-full rounded-full" :class="s >= 4 ? 'bg-forest' : s === 3 ? 'bg-line-2' : 'bg-danger'" :style="{ width: `${(summary.dist[s] / summary.max) * 100}%` }" />
          </div>
          <span class="num w-8 text-right text-xs text-muted">{{ summary.dist[s] }}</span>
        </div>
      </div>
    </section>

    <div class="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <button v-for="f in FILTERS" :key="f.k" class="chip" :class="filter === f.k && 'chip-on'" @click="filter = f.k">
        {{ f.label }} <span class="num opacity-60">{{ f.n }}</span>
      </button>
    </div>

    <div v-if="loading" class="space-y-2"><div v-for="i in 4" :key="i" class="skeleton h-28" /></div>
    <EmptyState
      v-else-if="!list.length"
      :title="filter === 'unreplied' ? 'All caught up' : 'No reviews here'"
      :body="filter === 'unreplied' ? 'You have replied to every review.' : 'Reviews appear after customers pick up their orders.'"
    />
    <ul v-else class="card divide-y divide-line">
      <ReviewItem v-for="r in list" :key="r.id" :review="r" @updated="onUpdated" @photo="openPhoto" />
    </ul>

    <Lightbox :photos="lbPhotos" :index="lbIndex" @close="lbIndex = null" @update:index="(i) => (lbIndex = i)" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useCartStore } from "../../stores/cart.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";
import { confirmDialog } from "../../composables/useConfirm.js";
import { rwf } from "../../lib/format.js";
import FoodImage from "../../components/ui/FoodImage.vue";

const route = useRoute();
const router = useRouter();
const cart = useCartStore();
const auth = useAuthStore();
const toast = useToast();

const q = ref(route.query.q || "");
const category = ref(route.query.category || "");
const maxPrice = ref(Number(route.query.max) || 0);
const sort = ref("price");
const openOnly = ref(false);
const items = ref([]);
const categories = ref([]);
const loading = ref(false);
const searched = ref(false);
const error = ref("");

const results = computed(() => {
  let list = items.value;
  if (openOnly.value) list = list.filter((i) => i.vendor.is_open);
  const sorted = [...list];
  if (sort.value === "rating") sorted.sort((a, b) => b.vendor.rating_avg - a.vendor.rating_avg);
  else if (sort.value === "fast") sorted.sort((a, b) => a.vendor.prep_minutes - b.vendor.prep_minutes);
  else sorted.sort((a, b) => a.price - b.price);
  return sorted;
});
const cheapest = computed(() => (results.value.length ? Math.min(...results.value.map((i) => i.price)) : 0));
const priciest = computed(() => (results.value.length ? Math.max(...results.value.map((i) => i.price)) : 0));

async function run() {
  if (!q.value.trim() && !category.value) {
    items.value = [];
    searched.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const params = {};
    if (q.value.trim()) params.q = q.value.trim();
    if (category.value) params.category = category.value;
    if (maxPrice.value) params.max = maxPrice.value;
    items.value = (await api.get("/menu/search", { params })).data.items;
    searched.value = true;
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function submit() {
  router.replace({ query: { ...(q.value.trim() && { q: q.value.trim() }), ...(category.value && { category: category.value }), ...(maxPrice.value && { max: maxPrice.value }) } });
}

watch(() => route.query, (qs) => {
  q.value = qs.q || "";
  category.value = qs.category || "";
  maxPrice.value = Number(qs.max) || 0;
  run();
});

async function add(item) {
  if (auth.isVendor) return;
  if (!item.vendor.is_open) return toast.warning(`${item.vendor.shop_name} isn't taking orders right now. Try another shop.`, "Shop closed");
  try {
    const { data } = await api.get(`/vendors/${item.vendor.id}`);
    if (!cart.canAdd(data.vendor)) {
      const ok = await confirmDialog({
        title: "Start a new basket?",
        body: `Your basket has ${cart.itemCount} item${cart.itemCount > 1 ? "s" : ""} from ${cart.vendor.shop_name}. Each order goes to one shop, so adding ${item.name} from ${data.vendor.shop_name} will clear it.`,
        confirmLabel: "Start new basket",
        cancelLabel: "Keep my basket",
      });
      if (!ok) return;
    }
    cart.addItem(item, data.vendor);
    toast.success(`${item.name} is in your basket.`, "Added to basket");
  } catch (e) {
    toast.error(errMsg(e));
  }
}

onMounted(async () => {
  run();
  try {
    categories.value = (await api.get("/menu/categories")).data.categories.slice(0, 14);
  } catch {
    /* optional */
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <h1 class="display text-[2.2rem] font-semibold">Compare dishes across campus</h1>
    <p class="mt-1 text-ink-2">Same craving, different prices. Find who does it cheapest, fastest or best.</p>

    <form class="mt-6 flex flex-col gap-2 sm:flex-row" @submit.prevent="submit">
      <input v-model="q" class="field h-11 flex-1" placeholder="What are you hungry for?" aria-label="Dish name" autofocus />
      <select v-model.number="maxPrice" class="field h-11 sm:w-44" aria-label="Maximum price">
        <option :value="0">Any price</option>
        <option :value="1000">Under 1,000 RWF</option>
        <option :value="2000">Under 2,000 RWF</option>
        <option :value="3000">Under 3,000 RWF</option>
        <option :value="5000">Under 5,000 RWF</option>
      </select>
      <button class="btn btn-primary h-11 px-6">Search</button>
    </form>

    <div class="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        v-for="c in categories"
        :key="c.name"
        class="chip"
        :class="category === c.name && 'chip-on'"
        @click="category = category === c.name ? '' : c.name; submit()"
      >
        {{ c.name }} <span class="text-xs opacity-60">{{ c.count }}</span>
      </button>
    </div>

    <p v-if="error" class="mt-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

    <div v-if="searched && results.length" class="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <p class="text-sm text-ink-2">
        <strong>{{ results.length }}</strong> dishes
        <template v-if="results.length > 1"> · <span class="num">{{ rwf(cheapest) }}</span> to <span class="num">{{ rwf(priciest) }}</span></template>
      </p>
      <div class="flex items-center gap-3 text-sm">
        <label class="flex items-center gap-2"><input v-model="openOnly" type="checkbox" class="accent-forest" /> Open now</label>
        <select v-model="sort" class="field h-9 w-auto text-sm" aria-label="Sort">
          <option value="price">Cheapest first</option>
          <option value="rating">Best rated shop</option>
          <option value="fast">Fastest kitchen</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="mt-6 space-y-3"><div v-for="i in 5" :key="i" class="skeleton h-20" /></div>

    <ul v-else-if="results.length" class="mt-2 divide-y divide-line">
      <li v-for="item in results" :key="item.id" class="flex items-center gap-4 py-4">
        <FoodImage :src="item.image_url" :alt="item.name" class="h-16 w-16 shrink-0 text-lg sm:h-20 sm:w-20" rounded="rounded-md" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-semibold">{{ item.name }}</p>
            <span v-if="item.price === cheapest && results.length > 1" class="tag bg-forest-soft text-forest">Lowest price</span>
          </div>
          <RouterLink :to="`/shops/${item.vendor.id}#item-${item.id}`" class="text-sm text-ink-2 hover:underline">
            {{ item.vendor.shop_name }}
          </RouterLink>
          <p class="mt-0.5 text-xs text-muted">
            <span v-if="item.vendor.rating_count">★ {{ item.vendor.rating_avg.toFixed(1) }} · </span>{{ item.vendor.prep_minutes }} min ·
            <span :class="item.vendor.is_open ? 'text-forest' : 'text-danger'">{{ item.vendor.is_open ? "Open" : "Closed" }}</span>
          </p>
        </div>
        <div class="text-right">
          <p class="num font-semibold">{{ rwf(item.price) }}</p>
          <button v-if="!auth.isVendor" class="btn btn-outline btn-sm mt-1.5" :disabled="!item.vendor.is_open" @click="add(item)">Add</button>
        </div>
      </li>
    </ul>

    <div v-else-if="searched" class="mt-10 text-center">
      <p class="display text-2xl font-semibold">No shops in and around campus sell "{{ q || category }}" yet</p>
      <p class="mt-1 text-sm text-muted">Try a broader word, like "rice" or "juice".</p>
    </div>

    <div v-else class="mt-10 grid gap-3 sm:grid-cols-3">
      <RouterLink v-for="t in ['Chapati', 'Burger', 'Smoothie', 'Brochettes', 'Coffee', 'Fried rice']" :key="t" :to="{ query: { q: t } }" class="card px-4 py-4 text-sm font-semibold hover:shadow-[var(--shadow-pop)]">
        {{ t }} <span class="float-right text-muted">→</span>
      </RouterLink>
    </div>
  </div>
</template>

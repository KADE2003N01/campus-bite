<script setup>
import { ref, computed, onMounted } from "vue";
import { useLive } from "../../composables/useLive.js";
import { useRouter } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useAuthStore } from "../../stores/auth.js";
import { rwf, clock, withinHours, STATUS } from "../../lib/format.js";
import ShopCard from "../../components/shop/ShopCard.vue";
import FoodImage from "../../components/ui/FoodImage.vue";

const auth = useAuthStore();
const router = useRouter();

const vendors = ref([]);
const popular = ref([]);
const active = ref([]);
const loading = ref(true);
const error = ref("");

const howSteps = [
  ["Pick a shop and add food", "Menus and prices are open to everyone, no account needed."],
  ["Choose a pickup time", "Pay with MoMo, Airtel Money, or cash when you collect."],
  ["Collect with your code", "Your order page tells you the moment it's ready."],
];

const q = ref("");
const cuisine = ref("");
const openOnly = ref(false);
const sort = ref("recommended");

const greeting = computed(() => {
  const h = new Date().getHours();
  const part = h < 11 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return auth.isStudent ? `${part}, ${auth.firstName}.` : null;
});

const meal = computed(() => {
  const h = new Date().getHours();
  if (h < 10) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "A snack";
  return "Dinner";
});

const cuisines = computed(() => [...new Set(vendors.value.map((v) => v.cuisine).filter(Boolean))].sort());
const liveCount = computed(() => vendors.value.filter((v) => v.is_open && withinHours(v)).length);

const shown = computed(() => {
  let list = vendors.value;
  if (cuisine.value) list = list.filter((v) => v.cuisine === cuisine.value);
  if (openOnly.value) list = list.filter((v) => v.is_open && withinHours(v));
  const live = (v) => (v.is_open && withinHours(v) ? 1 : 0);
  const sorted = [...list];
  if (sort.value === "rating") sorted.sort((a, b) => b.rating_avg - a.rating_avg);
  else if (sort.value === "fast") sorted.sort((a, b) => a.prep_minutes - b.prep_minutes);
  else if (sort.value === "cheap") sorted.sort((a, b) => (a.price_from || 1e9) - (b.price_from || 1e9));
  else sorted.sort((a, b) => live(b) - live(a) || b.rating_avg * Math.log(b.rating_count + 2) - a.rating_avg * Math.log(a.rating_count + 2));
  return sorted;
});

function search() {
  if (q.value.trim()) router.push({ name: "search", query: { q: q.value.trim() } });
}

useLive(["order.updated"], async () => {
  if (!auth.isStudent) return;
  try {
    active.value = (await api.get("/orders", { params: { scope: "active" } })).data;
  } catch {
    /* banner is optional */
  }
});

onMounted(async () => {
  try {
    const [v, p] = await Promise.all([api.get("/vendors"), api.get("/menu/popular")]);
    vendors.value = v.data.vendors;
    popular.value = p.data.items;
    if (auth.isStudent) active.value = (await api.get("/orders", { params: { scope: "active" } })).data;
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <!-- Live order banner -->
    <div v-if="active.length" class="border-b border-line bg-forest text-white">
      <RouterLink
        v-for="o in active.slice(0, 2)"
        :key="o.id"
        :to="`/orders/${o.id}`"
        class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 text-sm sm:px-6"
      >
        <span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-honey" />
        <span class="min-w-0 flex-1 truncate">
          <span class="font-mono font-semibold">{{ o.code }}</span>
          · {{ o.vendor.shop_name }} · {{ STATUS[o.status].label }}
          <span class="hidden sm:inline">· pickup {{ clock(o.pickup_time) }}</span>
        </span>
        <span class="shrink-0 font-semibold underline underline-offset-4">Track</span>
      </RouterLink>
    </div>

    <!-- Hero -->
    <section class="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <div class="grid items-end gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p v-if="greeting" class="text-sm font-semibold text-chili">{{ greeting }}</p>
          <p v-else class="eyebrow">UR-CST campus, Nyarugenge</p>
          <h1 class="display mt-3 text-[2.6rem] font-semibold leading-[1.02] sm:text-[3.6rem]">
            {{ meal }}, ready<br />when you walk up.
          </h1>
          <p class="mt-5 max-w-md text-[1.05rem] leading-relaxed text-ink-2">
            Order from the stalls and cafés around campus, pay with MoMo, and pick it up without queueing between lectures.
          </p>
          <form class="mt-7 flex max-w-lg gap-2" @submit.prevent="search">
            <div class="relative flex-1">
              <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input v-model="q" class="field h-12 pl-10 text-base" placeholder="Brochettes, chai, smoothie…" aria-label="Search dishes" />
            </div>
            <button class="btn btn-hot btn-lg">Search</button>
          </form>
          <p class="mt-3 text-sm text-muted">
            Try
            <RouterLink v-for="(t, i) in ['chapati', 'burger', 'juice', 'cake']" :key="t" :to="{ name: 'search', query: { q: t } }" class="text-ink-2 underline decoration-line-2 underline-offset-4 hover:decoration-ink">{{ t }}<template v-if="i < 3">, </template></RouterLink>
          </p>
        </div>

        <div class="relative hidden lg:block">
          <div class="grid grid-cols-5 grid-rows-2 gap-3">
            <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=72&auto=format&fit=crop" alt="Grilled brochettes" class="col-span-3 row-span-2 h-[340px] w-full rounded-2xl object-cover" />
            <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&q=72&auto=format&fit=crop" alt="Cappuccinos" class="col-span-2 h-[164px] w-full rounded-2xl object-cover" />
            <img src="https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=72&auto=format&fit=crop" alt="Samosas" class="col-span-2 h-[164px] w-full rounded-2xl object-cover" />
          </div>
          <div v-if="!loading" class="absolute -bottom-5 left-5 rounded-lg bg-card shadow-[var(--shadow-card)] px-4 py-3 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.4)]">
            <p class="num display text-2xl font-semibold leading-none">{{ liveCount }} <span class="text-base font-normal text-muted">of {{ vendors.length }}</span></p>
            <p class="mt-1 text-xs text-ink-2">kitchens taking orders right now</p>
          </div>
        </div>
      </div>
    </section>

    <!-- First-visit guidance: how pickup works -->
    <section v-if="!auth.isAuthenticated" class="mx-auto max-w-6xl px-4 pb-10 sm:px-6" aria-labelledby="how-title">
      <h2 id="how-title" class="sr-only">How pickup works</h2>
      <ol class="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <li v-for="(s, i) in howSteps" :key="i" class="bg-card px-5 py-4">
          <p class="font-mono text-xs text-muted">Step {{ i + 1 }}</p>
          <p class="mt-1 font-semibold">{{ s[0] }}</p>
          <p class="mt-0.5 text-sm text-ink-2">{{ s[1] }}</p>
        </li>
      </ol>
    </section>

    <!-- Popular dishes -->
    <section v-if="popular.length" class="border-y border-line bg-paper-2/60 py-9">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="display text-2xl font-semibold">What campus is eating</h2>
            <p class="text-sm text-muted">Most ordered in the last two weeks</p>
          </div>
          <RouterLink to="/search" class="link hidden text-sm sm:inline">Compare all dishes</RouterLink>
        </div>
        <div class="no-scrollbar -mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <RouterLink
            v-for="(d, i) in popular"
            :key="d.id"
            :to="`/shops/${d.vendor.id}#item-${d.id}`"
            class="group w-48 shrink-0 snap-start"
          >
            <FoodImage :src="d.image_url" :alt="d.name" class="aspect-square text-3xl">
              <span class="absolute left-2 top-2 rounded bg-ink px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-paper">#{{ i + 1 }}</span>
            </FoodImage>
            <p class="mt-2 truncate text-sm font-semibold group-hover:underline group-hover:underline-offset-4">{{ d.name }}</p>
            <p class="truncate text-xs text-muted">{{ d.vendor.shop_name }}</p>
            <p class="num mt-0.5 text-sm">{{ rwf(d.price) }} <span class="text-xs text-muted">· {{ d.sold_14d }} sold</span></p>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Shops -->
    <section id="shops" class="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="display text-[1.9rem] font-semibold">Shops on campus</h2>
          <p v-if="!loading" class="text-sm text-muted">{{ shown.length }} {{ shown.length === 1 ? "place" : "places" }}<template v-if="cuisine"> serving {{ cuisine.toLowerCase() }}</template></p>
        </div>
        <label class="flex items-center gap-2 text-sm text-ink-2">
          Sort
          <select v-model="sort" class="field h-9 w-auto pr-8 text-sm">
            <option value="recommended">Recommended</option>
            <option value="rating">Top rated</option>
            <option value="fast">Fastest</option>
            <option value="cheap">Cheapest</option>
          </select>
        </label>
      </div>

      <div class="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <button class="chip" :class="openOnly && 'chip-on'" @click="openOnly = !openOnly">
          <span class="h-1.5 w-1.5 rounded-full" :class="openOnly ? 'bg-honey' : 'bg-forest'" /> Open now
        </button>
        <span class="mx-1 hidden w-px self-stretch bg-line sm:block" />
        <button class="chip" :class="!cuisine && 'chip-on'" @click="cuisine = ''">All</button>
        <button v-for="c in cuisines" :key="c" class="chip" :class="cuisine === c && 'chip-on'" @click="cuisine = cuisine === c ? '' : c">{{ c }}</button>
      </div>

      <p v-if="error" class="mt-8 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

      <div v-if="loading" class="mt-7 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i"><div class="skeleton aspect-[16/10]" /><div class="skeleton mt-3 h-4 w-2/3" /><div class="skeleton mt-2 h-3 w-1/2" /></div>
      </div>
      <div v-else-if="shown.length" class="mt-7 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        <ShopCard v-for="v in shown" :key="v.id" :vendor="v" />
      </div>
      <div v-else-if="!error" class="mt-8 rounded-xl border border-dashed border-line-3 px-6 py-12 text-center">
        <p class="display text-xl font-semibold">Nothing matches that</p>
        <button class="link mt-2 text-sm" @click="cuisine = ''; openOnly = false">Clear filters</button>
      </div>
    </section>

    <!-- Vendor pitch (only for visitors) -->
    <section v-if="!auth.isAuthenticated" class="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
      <div class="grid overflow-hidden rounded-xl bg-ink text-paper md:grid-cols-2">
        <div class="p-8 sm:p-10">
          <p class="eyebrow text-paper/60">For stall owners</p>
          <h2 class="display mt-3 text-3xl font-semibold leading-tight">Run a kiosk or café on campus?</h2>
          <p class="mt-3 max-w-md text-paper/75">Get orders before the lunch rush, see what sells, and stop losing customers to the queue. Free while we're in pilot.</p>
          <RouterLink :to="{ name: 'register', query: { as: 'vendor' } }" class="btn btn-lg mt-6 bg-paper text-ink hover:bg-white">List your stall</RouterLink>
        </div>
        <img src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1000&q=70&auto=format&fit=crop" alt="Bakery counter" class="h-56 w-full object-cover md:h-full" />
      </div>
    </section>
  </div>
</template>

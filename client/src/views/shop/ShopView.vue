<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useCartStore } from "../../stores/cart.js";
import { useAuthStore } from "../../stores/auth.js";
import { rwf, withinHours } from "../../lib/format.js";
import DishRow from "../../components/shop/DishRow.vue";
import ReviewCard from "../../components/shop/ReviewCard.vue";
import FavButton from "../../components/shop/FavButton.vue";
import Stars from "../../components/ui/Stars.vue";
import Lightbox from "../../components/ui/Lightbox.vue";
import ConfirmDialog from "../../components/ui/ConfirmDialog.vue";
import FoodImage from "../../components/ui/FoodImage.vue";

const route = useRoute();
const cart = useCartStore();
const auth = useAuthStore();

const vendor = ref(null);
const items = ref([]);
const loading = ref(true);
const error = ref("");
const tab = ref("menu");
const menuQ = ref("");

const reviews = ref([]);
const summary = ref(null);
const reviewPhotos = ref([]);
const reviewTotal = ref(0);
const reviewFilter = ref({ rating: null, photos: false });
const reviewsLoading = ref(false);

const lightbox = ref({ photos: [], index: null });
const conflict = ref(null); // pending item when basket holds another shop

const live = computed(() => vendor.value && vendor.value.is_open && withinHours(vendor.value));
const canOrder = computed(() => live.value && !auth.isVendor);

const grouped = computed(() => {
  const term = menuQ.value.trim().toLowerCase();
  const list = term ? items.value.filter((i) => `${i.name} ${i.description || ""}`.toLowerCase().includes(term)) : items.value;
  const map = new Map();
  const popular = list.filter((i) => i.is_popular);
  if (popular.length && !term) map.set("Most ordered", popular);
  for (const i of list) {
    const k = i.category || "Other";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  return [...map.entries()];
});

const inBasketHere = computed(() => cart.vendorId === vendor.value?.id);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get(`/vendors/${route.params.id}`);
    vendor.value = data.vendor;
    items.value = data.items;
    document.title = `${data.vendor.shop_name} · CampusBite`;
    loadReviews(true);
    await nextTick();
    if (route.hash) document.querySelector(route.hash)?.scrollIntoView({ block: "center" });
  } catch (e) {
    error.value = e.response?.status === 404 ? "We couldn't find that shop." : errMsg(e);
  } finally {
    loading.value = false;
  }
}

async function loadReviews(reset = false) {
  reviewsLoading.value = true;
  try {
    const params = { take: 10, skip: reset ? 0 : reviews.value.length };
    if (reviewFilter.value.rating) params.rating = reviewFilter.value.rating;
    if (reviewFilter.value.photos) params.photos = 1;
    const { data } = await api.get(`/vendors/${route.params.id}/reviews`, { params });
    reviews.value = reset ? data.reviews : [...reviews.value, ...data.reviews];
    reviewTotal.value = data.total;
    summary.value = data.summary;
    if (reset && !reviewFilter.value.rating && !reviewFilter.value.photos) reviewPhotos.value = data.photos;
  } catch (e) {
    /* reviews are secondary; keep the menu usable */
  } finally {
    reviewsLoading.value = false;
  }
}

function setFilter(f) {
  reviewFilter.value = { ...reviewFilter.value, ...f };
  loadReviews(true);
}

function add(item) {
  if (!cart.canAdd(vendor.value)) {
    conflict.value = item;
    return;
  }
  cart.addItem(item, vendor.value);
}
function replaceBasket() {
  cart.clear();
  cart.addItem(conflict.value, vendor.value);
  conflict.value = null;
}
function dec(item) {
  cart.setQty(item.id, cart.qtyOf(item.id) - 1);
}

function openPhotos(list, index) {
  lightbox.value = { photos: list, index };
}
function openGalleryPhoto(i) {
  openPhotos(reviewPhotos.value.map((p) => ({ url: p.url })), i);
}

function jump(cat) {
  document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

watch(() => route.params.id, (id) => id && load(), { immediate: true });
</script>

<template>
  <div v-if="loading" class="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
    <div class="skeleton h-64 w-full" />
    <div class="skeleton mt-6 h-8 w-72" />
    <div class="skeleton mt-3 h-4 w-96 max-w-full" />
  </div>

  <div v-else-if="error" class="mx-auto max-w-xl px-4 py-24 text-center">
    <p class="display text-3xl font-semibold">{{ error }}</p>
    <RouterLink to="/" class="btn btn-outline mt-6">See all shops</RouterLink>
  </div>

  <div v-else-if="vendor">
    <!-- Cover -->
    <div class="mx-auto max-w-6xl sm:px-6 sm:pt-5">
      <FoodImage :src="vendor.cover_url" :alt="vendor.shop_name" eager class="h-52 text-6xl sm:h-72" rounded="sm:rounded-xl" />
    </div>

    <div class="mx-auto max-w-6xl px-4 sm:px-6">
      <!-- Header -->
      <header class="flex flex-col gap-5 border-b border-line pb-6 pt-6 md:flex-row md:items-end md:justify-between">
        <div class="min-w-0">
          <p class="eyebrow">{{ vendor.cuisine }}</p>
          <h1 class="display mt-1 text-[2.2rem] font-semibold leading-tight sm:text-[2.7rem]">{{ vendor.shop_name }}</h1>
          <p v-if="vendor.description" class="mt-2 max-w-2xl leading-relaxed text-ink-2">{{ vendor.description }}</p>
          <dl class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div v-if="vendor.rating_count" class="flex items-center gap-1.5">
              <Stars :value="vendor.rating_avg" />
              <button class="font-semibold underline-offset-4 hover:underline" @click="tab = 'reviews'">{{ vendor.rating_avg.toFixed(1) }} ({{ vendor.rating_count }})</button>
            </div>
            <div class="flex items-center gap-1.5 text-ink-2">
              <span class="h-2 w-2 rounded-full" :class="live ? 'bg-forest-2' : 'bg-danger'" />
              <span v-if="live">Open · until {{ vendor.closes_at }}</span>
              <span v-else-if="!vendor.is_open">Not taking orders right now</span>
              <span v-else>Closed · opens {{ vendor.opens_at }}</span>
            </div>
            <div class="text-ink-2">Ready in {{ vendor.prep_minutes }}–{{ vendor.prep_minutes + 10 }} min</div>
            <div class="text-ink-2">{{ vendor.location }}</div>
            <a :href="`tel:${vendor.phone}`" class="num text-ink-2 underline-offset-4 hover:underline">{{ vendor.phone }}</a>
          </dl>
        </div>
        <FavButton v-if="!auth.isVendor" :vendor-id="vendor.id" :value="vendor.is_favorite" class="shrink-0 self-start md:self-end" />
      </header>

      <!-- Tabs -->
      <div class="sticky top-16 z-30 -mx-4 border-b border-line bg-paper px-4 sm:-mx-6 sm:px-6">
        <div class="flex items-center gap-6">
          <button class="relative py-3.5 text-sm font-semibold" :class="tab === 'menu' ? 'text-ink' : 'text-muted hover:text-ink'" @click="tab = 'menu'">
            Menu <span class="font-normal text-muted">{{ items.length }}</span>
            <span v-if="tab === 'menu'" class="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />
          </button>
          <button class="relative py-3.5 text-sm font-semibold" :class="tab === 'reviews' ? 'text-ink' : 'text-muted hover:text-ink'" @click="tab = 'reviews'">
            Reviews <span class="font-normal text-muted">{{ vendor.rating_count }}</span>
            <span v-if="tab === 'reviews'" class="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />
          </button>
          <div v-if="tab === 'menu'" class="no-scrollbar ml-auto hidden gap-1 overflow-x-auto md:flex">
            <button v-for="[cat] in grouped" :key="cat" class="rounded px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-paper-2" @click="jump(cat)">{{ cat }}</button>
          </div>
        </div>
      </div>

      <div v-if="!live && !auth.isVendor" class="mt-6 rounded-md border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm text-ink">
        <strong>{{ vendor.shop_name }}</strong> isn't taking orders right now. You can still browse the menu{{ vendor.is_open ? ` — they open at ${vendor.opens_at}` : "" }}.
      </div>

      <!-- MENU -->
      <div v-show="tab === 'menu'" class="grid gap-10 pt-4 lg:grid-cols-[1fr_320px]">
        <div class="min-w-0">
          <input v-model="menuQ" class="field mt-2 max-w-sm" placeholder="Search this menu" aria-label="Search this menu" />
          <section v-for="[cat, list] in grouped" :id="`cat-${cat}`" :key="cat" class="scroll-mt-32 pt-8">
            <h2 class="display text-xl font-semibold">{{ cat }}</h2>
            <div class="divide-y divide-line">
              <DishRow
                v-for="item in list"
                :id="cat === 'Most ordered' ? undefined : `item-${item.id}`"
                :key="`${cat}-${item.id}`"
                :item="item"
                :qty="inBasketHere ? cart.qtyOf(item.id) : 0"
                :disabled="!canOrder"
                class="scroll-mt-36"
                @add="add(item)"
                @dec="dec(item)"
              />
            </div>
          </section>
          <p v-if="!grouped.length" class="py-12 text-center text-muted">No dishes match "{{ menuQ }}".</p>
        </div>

        <!-- Basket summary -->
        <aside class="hidden lg:block">
          <div class="sticky top-36 rounded-xl bg-card shadow-[var(--shadow-card)] p-5">
            <h3 class="display text-lg font-semibold">Your order</h3>
            <template v-if="inBasketHere && cart.items.length">
              <ul class="mt-3 space-y-2 text-sm">
                <li v-for="i in cart.items" :key="i.menu_item_id" class="flex justify-between gap-3">
                  <span><span class="num font-semibold">{{ i.quantity }}×</span> {{ i.name }}</span>
                  <span class="num shrink-0 text-ink-2">{{ rwf(i.price * i.quantity) }}</span>
                </li>
              </ul>
              <div class="mt-4 flex justify-between border-t border-line pt-3 font-semibold">
                <span>Subtotal</span><span class="num">{{ rwf(cart.subtotal) }}</span>
              </div>
              <RouterLink to="/checkout" class="btn btn-hot mt-4 w-full">Checkout</RouterLink>
            </template>
            <p v-else class="mt-2 text-sm text-muted">
              {{ canOrder ? "Tap Add on anything you fancy." : "Ordering opens when the shop does." }}
              <template v-if="cart.items.length && !inBasketHere"><br /><br />Your basket has items from <strong class="text-ink-2">{{ cart.vendor.shop_name }}</strong>.</template>
            </p>
          </div>
        </aside>
      </div>

      <!-- REVIEWS -->
      <div v-show="tab === 'reviews'" class="pt-8">
        <div v-if="summary && summary.count" class="grid gap-10 lg:grid-cols-[300px_1fr]">
          <aside>
            <div class="lg:sticky lg:top-36">
              <p class="num display text-6xl font-semibold leading-none">{{ summary.average.toFixed(1) }}</p>
              <Stars :value="summary.average" :size="18" class="mt-2" />
              <p class="mt-1 text-sm text-muted">{{ summary.count }} reviews from verified orders</p>
              <div class="mt-5 space-y-1.5">
                <button
                  v-for="s in [5, 4, 3, 2, 1]"
                  :key="s"
                  class="flex w-full items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-paper-2"
                  :class="reviewFilter.rating === s && 'bg-paper-2'"
                  @click="setFilter({ rating: reviewFilter.rating === s ? null : s })"
                >
                  <span class="num w-3 text-ink-2">{{ s }}</span>
                  <span class="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <span class="block h-full rounded-full bg-honey" :style="{ width: `${(summary.distribution[s] / summary.count) * 100}%` }" />
                  </span>
                  <span class="num w-8 text-right text-xs text-muted">{{ summary.distribution[s] }}</span>
                </button>
              </div>
            </div>
          </aside>

          <div class="min-w-0">
            <div v-if="reviewPhotos.length" class="mb-6">
              <p class="text-sm font-semibold">Photos from customers</p>
              <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                <button v-for="(p, i) in reviewPhotos" :key="p.id" class="h-28 w-28 shrink-0 overflow-hidden rounded-md hover:opacity-90" @click="openGalleryPhoto(i)">
                  <img :src="p.url" alt="Customer photo" loading="lazy" class="h-full w-full object-cover" />
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 border-b border-line pb-4">
              <button class="chip" :class="!reviewFilter.rating && !reviewFilter.photos && 'chip-on'" @click="setFilter({ rating: null, photos: false })">All</button>
              <button class="chip" :class="reviewFilter.photos && 'chip-on'" @click="setFilter({ photos: !reviewFilter.photos })">With photos</button>
              <span v-if="reviewFilter.rating" class="chip chip-on" @click="setFilter({ rating: null })">{{ reviewFilter.rating }} stars ×</span>
              <span class="ml-auto text-xs text-muted">{{ reviewTotal }} {{ reviewTotal === 1 ? "review" : "reviews" }}</span>
            </div>

            <div class="divide-y divide-line">
              <ReviewCard
                v-for="r in reviews"
                :key="r.id"
                :review="r"
                :shop-name="vendor.shop_name"
                @photo="(i) => openPhotos(r.photos, i)"
              />
            </div>
            <p v-if="!reviews.length && !reviewsLoading" class="py-10 text-center text-muted">No reviews match that filter.</p>
            <button v-if="reviews.length < reviewTotal" class="btn btn-outline mt-4 w-full" :disabled="reviewsLoading" @click="loadReviews()">
              {{ reviewsLoading ? "Loading…" : `Show more reviews (${reviewTotal - reviews.length} left)` }}
            </button>
          </div>
        </div>
        <div v-else class="py-14 text-center">
          <p class="display text-2xl font-semibold">No reviews yet</p>
          <p class="mt-1 text-sm text-muted">Order something and be the first to say how it was.</p>
        </div>
      </div>
    </div>

    <!-- Mobile basket bar -->
    <div v-if="inBasketHere && cart.items.length" class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card p-3 lg:hidden">
      <button class="btn btn-hot btn-lg w-full justify-between" @click="cart.open = true">
        <span class="num">{{ cart.itemCount }} item{{ cart.itemCount > 1 ? "s" : "" }}</span>
        <span>View basket</span>
        <span class="num">{{ rwf(cart.subtotal) }}</span>
      </button>
    </div>

    <Lightbox :photos="lightbox.photos" :index="lightbox.index" @close="lightbox.index = null" @update:index="(i) => (lightbox.index = i)" />
    <ConfirmDialog
      :open="!!conflict"
      title="Start a new basket?"
      :body="`Your basket has ${cart.itemCount} item${cart.itemCount > 1 ? 's' : ''} from ${cart.vendor?.shop_name}. Each order goes to one shop, so adding ${conflict?.name} will clear it.`"
      confirm-label="Start new basket"
      cancel-label="Keep my basket"
      @close="conflict = null"
      @confirm="replaceBasket"
    />
  </div>
</template>

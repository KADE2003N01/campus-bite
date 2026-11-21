<script setup>
import { computed } from "vue";
import { rwf, withinHours } from "../../lib/format.js";
import FoodImage from "../ui/FoodImage.vue";
import FavButton from "./FavButton.vue";

const props = defineProps({ vendor: Object });
const v = computed(() => props.vendor);
const live = computed(() => v.value.is_open && withinHours(v.value));
</script>

<template>
  <RouterLink :to="`/shops/${v.id}`" class="group block min-w-0">
    <FoodImage :src="v.cover_url" :alt="v.shop_name" class="aspect-[16/10] text-4xl" rounded="rounded-2xl">
      <div class="absolute right-2.5 top-2.5"><FavButton :vendor-id="v.id" :value="v.is_favorite" overlay /></div>
      <div v-if="!live" class="absolute inset-0 flex items-end bg-ink/45 p-3">
        <span class="tag bg-card text-ink">{{ v.is_open ? `Opens ${v.opens_at}` : "Not taking orders" }}</span>
      </div>
    </FoodImage>
    <div class="mt-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-[1.02rem] font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{{ v.shop_name }}</h3>
        <p class="truncate text-sm text-muted">{{ v.cuisine }} · {{ v.location }}</p>
      </div>
      <div v-if="v.rating_count" class="flex shrink-0 items-center gap-1 rounded-md bg-paper-2 px-2 py-1 text-sm font-semibold">
        <svg width="12" height="12" viewBox="0 0 20 20"><path fill="#4A4A4A" d="M10 1.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L10 15l-5.3 2.8 1.1-5.9L1.4 7.8l6-.8z" /></svg>
        <span class="num">{{ v.rating_avg.toFixed(1) }}</span>
      </div>
    </div>
    <p class="num mt-1 text-[0.8rem] text-ink-2">
      {{ v.prep_minutes }}–{{ v.prep_minutes + 10 }} min
      <span class="text-line-2">/</span>
      <template v-if="v.price_from">from {{ rwf(v.price_from) }}</template>
      <template v-if="v.rating_count"><span class="text-line-2"> / </span>{{ v.rating_count }} reviews</template>
    </p>
  </RouterLink>
</template>

<script setup>
import { rwf } from "../../lib/format.js";
import FoodImage from "../ui/FoodImage.vue";

defineProps({ item: Object, qty: { type: Number, default: 0 }, disabled: Boolean });
const emit = defineEmits(["add", "dec"]);
</script>

<template>
  <article class="flex gap-4 py-5" :class="!item.is_available && 'opacity-55'">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h4 class="font-semibold leading-snug">{{ item.name }}</h4>
        <span v-if="item.is_popular" class="tag bg-forest-soft text-forest">Popular</span>
        <span v-if="!item.is_available" class="tag bg-paper-2 text-muted">Sold out today</span>
      </div>
      <p v-if="item.description" class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{{ item.description }}</p>
      <div class="mt-2.5 flex items-center gap-3">
        <span class="num text-[0.95rem] font-semibold">{{ rwf(item.price) }}</span>
        <span v-if="item.sold_30d >= 10" class="text-xs text-muted">{{ item.sold_30d }} ordered this month</span>
      </div>
    </div>
    <div class="relative shrink-0">
      <FoodImage :src="item.image_url" :alt="item.name" class="h-28 w-28 text-2xl sm:h-32 sm:w-36" />
      <div v-if="item.is_available && !disabled" class="absolute -bottom-3 left-1/2 -translate-x-1/2">
        <button
          v-if="!qty"
          class="btn btn-sm border border-line-2 bg-card px-4 shadow-sm hover:border-ink"
          :aria-label="`Add ${item.name}`"
          @click="emit('add')"
        >
          Add
        </button>
        <div v-else class="inline-flex h-8 items-center overflow-hidden rounded-[7px] bg-ink text-paper shadow-sm">
          <button class="h-8 w-8 hover:bg-white/10" aria-label="Remove one" @click="emit('dec')">−</button>
          <span class="num w-6 text-center text-sm font-semibold">{{ qty }}</span>
          <button class="h-8 w-8 hover:bg-white/10" aria-label="Add one" @click="emit('add')">+</button>
        </div>
      </div>
    </div>
  </article>
</template>

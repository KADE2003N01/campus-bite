<script setup>
import { ago } from "../../lib/format.js";
import Stars from "../ui/Stars.vue";

defineProps({ review: Object, shopName: String });
const emit = defineEmits(["photo"]);
</script>

<template>
  <article class="py-6">
    <header class="flex items-center gap-3">
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-sm font-semibold text-ink-2">{{ review.author.slice(0, 1) }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ review.author }} <span class="ml-1 font-normal text-muted">· verified order</span></p>
        <div class="flex items-center gap-2 text-xs text-muted">
          <Stars :value="review.rating" :size="13" />
          <span>{{ ago(review.created_at) }}</span>
        </div>
      </div>
    </header>
    <p v-if="review.comment" class="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{{ review.comment }}</p>
    <p v-if="review.items?.length" class="mt-2 text-xs text-muted">Ordered: {{ review.items.join(", ") }}</p>
    <div v-if="review.photos.length" class="mt-3 flex gap-2">
      <button
        v-for="(p, i) in review.photos"
        :key="p.id"
        class="h-24 w-24 overflow-hidden rounded-md ring-offset-2 hover:ring-2 hover:ring-ink"
        :aria-label="`Open photo ${i + 1}`"
        @click="emit('photo', i)"
      >
        <img :src="p.url" alt="Customer photo" loading="lazy" class="h-full w-full object-cover" />
      </button>
    </div>
    <div v-if="review.vendor_reply" class="mt-4 border-l-2 border-forest pl-4">
      <p class="text-xs font-semibold text-forest">Reply from {{ shopName || "the owner" }}</p>
      <p class="mt-1 text-sm text-ink-2">{{ review.vendor_reply }}</p>
    </div>
  </article>
</template>

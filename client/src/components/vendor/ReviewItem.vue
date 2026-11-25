<script setup>
import { ref } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { ago } from "../../lib/format.js";
import { assetUrl } from "../../lib/urls.js";
import Stars from "../ui/Stars.vue";

const props = defineProps({ review: Object });
const emit = defineEmits(["updated", "photo"]);
const toast = useToast();
const editing = ref(!props.review.vendor_reply);
const draft = ref(props.review.vendor_reply || "");
const busy = ref(false);
const open = ref(false);

async function save(text) {
  busy.value = true;
  try {
    const { data } = await api.put(`/vendor/reviews/${props.review.id}/reply`, { reply: text });
    emit("updated", data.review);
    draft.value = data.review.vendor_reply || "";
    editing.value = !data.review.vendor_reply;
    open.value = false;
    toast.success(text ? "Reply posted" : "Reply removed");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <li class="px-4 py-4 sm:px-5">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Stars :value="review.rating" :size="14" />
      <span class="text-sm font-semibold">{{ review.author }}</span>
      <span class="text-xs text-muted">{{ ago(review.created_at) }}</span>
      <span class="ml-auto font-mono text-xs text-muted">{{ review.order_code }}</span>
    </div>
    <p v-if="review.items.length" class="mt-1 text-xs text-muted">Ordered: {{ review.items.join(", ") }}</p>
    <p class="mt-2 text-sm leading-relaxed" :class="review.comment ? 'text-ink' : 'italic text-muted'">{{ review.comment || "Left a rating without a comment." }}</p>
    <div v-if="review.photos.length" class="mt-3 flex flex-wrap gap-2">
      <button v-for="(p, i) in review.photos" :key="p.id" class="overflow-hidden rounded-md" @click="emit('photo', review, i)">
        <img :src="assetUrl(p.url)" alt="Customer photo" class="h-20 w-20 object-cover transition hover:opacity-85" loading="lazy" />
      </button>
    </div>

    <div v-if="review.vendor_reply && !editing" class="mt-3 rounded-md border-l-2 border-forest bg-forest-soft/60 px-3 py-2.5 text-sm">
      <p class="text-xs font-semibold text-forest">Your reply · {{ ago(review.replied_at) }}</p>
      <p class="mt-1 text-ink-2">{{ review.vendor_reply }}</p>
      <div class="mt-1.5 flex gap-3 text-xs font-semibold">
        <button class="text-forest hover:underline" @click="editing = true; open = true">Edit</button>
        <button class="text-danger hover:underline" :disabled="busy" @click="save('')">Remove</button>
      </div>
    </div>
    <div v-else class="mt-3">
      <button v-if="!open" class="text-sm font-semibold text-forest hover:underline" @click="open = true">Reply publicly</button>
      <form v-else class="space-y-2" @submit.prevent="save(draft.trim())">
        <textarea v-model="draft" class="field" rows="2" maxlength="600" placeholder="Thank them, or explain what you've changed. Everyone can see this." />
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" :disabled="busy || !draft.trim()">{{ busy ? "Posting…" : "Post reply" }}</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="open = false; editing = !review.vendor_reply; draft = review.vendor_reply || ''">Cancel</button>
        </div>
      </form>
    </div>
  </li>
</template>

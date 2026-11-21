<script setup>
import { ref, computed, onBeforeUnmount } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import Modal from "../ui/Modal.vue";
import StarInput from "../ui/StarInput.vue";

const props = defineProps({ open: Boolean, order: Object });
const emit = defineEmits(["close", "done"]);
const toast = useToast();

const rating = ref(0);
const comment = ref("");
const files = ref([]); // { file, url }
const busy = ref(false);
const MAX = 4;

const canSubmit = computed(() => rating.value > 0 && !busy.value);

function pick(e) {
  const chosen = [...e.target.files];
  e.target.value = "";
  for (const f of chosen) {
    if (files.value.length >= MAX) {
      toast.warning(`You can add up to ${MAX} photos.`, "Photo limit reached");
      break;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      toast.error(`${f.name} isn't a JPG, PNG or WebP image.`, "Unsupported file");
      continue;
    }
    if (f.size > 4 * 1024 * 1024) {
      toast.error(`${f.name} is over 4 MB. Try a smaller photo.`, "Photo too large");
      continue;
    }
    files.value.push({ file: f, url: URL.createObjectURL(f) });
  }
}
function drop(i) {
  URL.revokeObjectURL(files.value[i].url);
  files.value.splice(i, 1);
}
onBeforeUnmount(() => files.value.forEach((f) => URL.revokeObjectURL(f.url)));

async function submit() {
  busy.value = true;
  try {
    const fd = new FormData();
    fd.append("rating", rating.value);
    if (comment.value.trim()) fd.append("comment", comment.value.trim());
    files.value.forEach((f) => fd.append("photos", f.file));
    const { data } = await api.post(`/orders/${props.order.id}/review`, fd);
    toast.success("Other students can now see it on the shop page.", "Review posted");
    emit("done", data);
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" title="Rate your order" @close="emit('close')">
    <p class="text-sm text-muted">
      {{ order.vendor.shop_name }} · {{ order.items.map((i) => i.menu_item.name).join(", ") }}
    </p>
    <div class="mt-4"><StarInput v-model="rating" /></div>

    <label class="label mt-5" for="rv-comment">What was it like? <span class="font-normal text-muted">(optional)</span></label>
    <textarea id="rv-comment" v-model="comment" rows="4" maxlength="1000" class="field" placeholder="Taste, portion, was it ready on time…" />
    <p class="hint text-right">{{ comment.length }}/1000</p>

    <p class="label mt-3">Photos <span class="font-normal text-muted">(up to 4, helps other students a lot)</span></p>
    <div class="flex flex-wrap gap-2">
      <div v-for="(f, i) in files" :key="f.url" class="relative h-20 w-20 overflow-hidden rounded-md">
        <img :src="f.url" class="h-full w-full object-cover" alt="" />
        <button class="absolute right-1 top-1 rounded-full bg-ink/80 p-1 text-white" aria-label="Remove photo" @click="drop(i)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <label v-if="files.length < MAX" class="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-3 text-xs text-muted hover:border-ink hover:text-ink">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="12" cy="12.5" r="3.5" /><path d="M8 5l1.5-2h5L16 5" /></svg>
        Add photo
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" @change="pick" />
      </label>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('close')">Later</button>
      <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">{{ busy ? "Posting…" : "Post review" }}</button>
    </template>
  </Modal>
</template>

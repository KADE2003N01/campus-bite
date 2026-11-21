<script setup>
import { ref, watch } from "vue";
import Modal from "./Modal.vue";
const props = defineProps({
  open: Boolean,
  title: String,
  body: String,
  confirmLabel: { type: String, default: "Confirm" },
  cancelLabel: { type: String, default: "Keep it" },
  danger: Boolean,
  reasons: Array, // when set, user must pick/enter a reason
  busy: Boolean,
});
const emit = defineEmits(["close", "confirm"]);
const reason = ref("");
const custom = ref("");
watch(() => props.open, () => { reason.value = ""; custom.value = ""; });
function submit() {
  const r = reason.value === "__other" ? custom.value.trim() : reason.value;
  if (props.reasons && !r) return;
  emit("confirm", r);
}
</script>

<template>
  <Modal :open="open" :title="title" width="max-w-md" @close="emit('close')">
    <p v-if="body" class="text-sm text-ink-2">{{ body }}</p>
    <div v-if="reasons" class="mt-4 space-y-2">
      <label v-for="r in reasons" :key="r" class="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm hover:shadow-[var(--shadow-pop)]" :class="reason === r && 'border-ink bg-paper'">
        <input v-model="reason" type="radio" :value="r" class="accent-forest" /> {{ r }}
      </label>
      <label class="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm" :class="reason === '__other' && 'border-ink bg-paper'">
        <input v-model="reason" type="radio" value="__other" class="accent-forest" /> Something else
      </label>
      <input v-if="reason === '__other'" v-model="custom" class="field" placeholder="Short reason the customer will see" maxlength="200" />
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="emit('close')">{{ cancelLabel }}</button>
      <button
        class="btn"
        :class="danger ? 'btn-hot' : 'btn-primary'"
        :disabled="busy || (reasons && (!reason || (reason === '__other' && !custom.trim())))"
        @click="submit"
      >
        {{ busy ? "Working…" : confirmLabel }}
      </button>
    </template>
  </Modal>
</template>

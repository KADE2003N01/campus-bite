<script setup>
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps({ vendorId: Number, value: Boolean, overlay: Boolean });
const emit = defineEmits(["change"]);
const auth = useAuthStore();
const toast = useToast();
const router = useRouter();
const route = useRoute();
const on = ref(props.value);
watch(() => props.value, (v) => (on.value = v));

async function toggle() {
  if (!auth.isAuthenticated) return router.push({ name: "login", query: { redirect: route.fullPath } });
  if (!auth.isStudent) return;
  const next = !on.value;
  on.value = next;
  try {
    if (next) await api.put(`/favorites/${props.vendorId}`);
    else await api.delete(`/favorites/${props.vendorId}`);
    emit("change", next);
    if (next) toast.success("Find it any time under Saved shops.", "Shop saved");
  } catch (e) {
    on.value = !next;
    toast.error(errMsg(e));
  }
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="on"
    :aria-label="on ? 'Remove from saved' : 'Save shop'"
    class="inline-flex items-center justify-center rounded-full transition"
    :class="overlay ? 'h-9 w-9 bg-card/95 shadow-sm hover:bg-card' : 'h-9 w-9 border border-line-2 bg-card hover:border-ink-2'"
    @click.prevent.stop="toggle"
  >
    <svg width="17" height="17" viewBox="0 0 24 24" :fill="on ? '#6D8196' : 'none'" :stroke="on ? '#6D8196' : 'currentColor'" stroke-width="2">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  </button>
</template>

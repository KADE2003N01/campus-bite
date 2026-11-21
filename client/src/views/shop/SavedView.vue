<script setup>
import { ref, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import ShopCard from "../../components/shop/ShopCard.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const vendors = ref([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    vendors.value = (await api.get("/favorites")).data.vendors;
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <h1 class="display text-[2.2rem] font-semibold">Saved shops</h1>
    <p class="mt-1 text-ink-2">Your regulars, one tap away.</p>
    <p v-if="error" class="mt-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>
    <div v-if="loading" class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><div v-for="i in 3" :key="i" class="skeleton aspect-[16/10]" /></div>
    <div v-else-if="vendors.length" class="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      <ShopCard v-for="v in vendors" :key="v.id" :vendor="v" />
    </div>
    <EmptyState v-else-if="!error" class="mt-8" title="No saved shops yet" body="Tap the heart on any shop to keep it here.">
      <RouterLink to="/" class="btn btn-primary">Browse shops</RouterLink>
    </EmptyState>
  </div>
</template>

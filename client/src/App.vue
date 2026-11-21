<script setup>
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import ShopLayout from "./layouts/ShopLayout.vue";
import ToastStack from "./components/ui/ToastStack.vue";
import { useAuthStore } from "./stores/auth.js";
import { start, stop } from "./composables/useRealtime.js";

const auth = useAuthStore();
watch(
  () => (auth.isAuthenticated ? auth.token : null),
  (token) => (token ? start(token) : stop()),
  { immediate: true },
);

const route = useRoute();
const layout = computed(() => (route.matched.length ? route.meta.layout || "shop" : null));
</script>

<template>
  <ShopLayout v-if="layout === 'shop'">
    <RouterView />
  </ShopLayout>
  <RouterView v-else-if="layout" />
  <ToastStack />
</template>

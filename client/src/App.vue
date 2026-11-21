<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import ShopLayout from "./layouts/ShopLayout.vue";
import ToastStack from "./components/ui/ToastStack.vue";

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

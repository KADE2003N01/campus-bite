<script setup>
defineProps({ title: String, body: String });
</script>

<template>
  <div class="rounded-xl border border-dashed border-line-3 px-6 py-14 text-center">
    <p class="display text-2xl font-semibold text-ink">{{ title }}</p>
    <p v-if="body" class="mx-auto mt-2 max-w-sm text-sm text-muted">{{ body }}</p>
    <div v-if="$slots.default" class="mt-5 flex justify-center gap-2"><slot /></div>
  </div>
</template>

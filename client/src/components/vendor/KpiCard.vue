<script setup>
defineProps({ label: String, value: String, sub: String, delta: Number });
</script>

<template>
  <div class="card px-4 py-4">
    <p class="eyebrow">{{ label }}</p>
    <p class="num mt-2 text-2xl font-semibold tracking-tight">{{ value }}</p>
    <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
      <span v-if="delta != null" class="num whitespace-nowrap font-semibold" :class="delta >= 0 ? 'text-forest' : 'text-danger'">
        {{ delta >= 0 ? "▲" : "▼" }} {{ Math.abs(delta) }}%
      </span>
      <span>{{ sub }}</span>
    </p>
    <slot />
  </div>
</template>

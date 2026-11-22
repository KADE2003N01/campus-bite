<script setup>
defineProps({ light: Boolean, compact: Boolean });
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg viewBox="0 0 32 32" class="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" :fill="light ? '#FFFFE3' : '#4A4A4A'" />
      <circle cx="16" cy="17.5" r="7.5" fill="none" :stroke="light ? '#4A4A4A' : '#FFFFE3'" stroke-width="3" />
      <path d="M16 5.5v6" stroke="#6D8196" stroke-width="3" stroke-linecap="round" />
    </svg>
    <span v-if="!compact" class="display text-[1.3rem] font-semibold leading-none" :class="light ? 'text-[#FFFFE3]' : 'text-ink'">CampusBite</span>
  </span>
</template>

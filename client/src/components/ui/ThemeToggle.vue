<script setup>
import { useTheme } from "../../composables/useTheme.js";
defineProps({ label: Boolean }); // show "Dark mode" text (sidebar / mobile menu)
const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isDark"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Light mode' : 'Dark mode'"
    class="inline-flex items-center gap-2 rounded-full transition"
    :class="label ? 'w-full justify-between px-3 py-2 text-sm' : 'h-9 w-9 justify-center hover:bg-paper-2'"
    @click="toggleTheme"
  >
    <span v-if="label">Dark mode</span>
    <svg v-if="isDark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </svg>
  </button>
</template>

<script setup>
import Logo from "../../components/ui/Logo.vue";
defineProps({ image: String, quote: String, who: String });
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
    <div class="flex flex-col px-6 py-6 sm:px-12">
      <RouterLink to="/" class="self-start"><Logo /></RouterLink>
      <div class="flex flex-1 items-center">
        <div class="mx-auto w-full max-w-sm py-10"><slot /></div>
      </div>
      <p class="text-xs text-muted">UR-CST · Group 5 project</p>
    </div>
    <div class="relative hidden lg:block">
      <img :src="image" alt="" class="absolute inset-0 h-full w-full object-cover" />
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-10 pt-32">
        <p class="display max-w-md text-2xl font-medium leading-snug text-white">“{{ quote }}”</p>
        <p class="mt-3 text-sm text-white/75">{{ who }}</p>
        <p class="mt-6 text-[0.7rem] text-white/60">Photo: Unsplash · illustrative · quote from a fictional demo user</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { useCartStore } from "../stores/cart.js";
import Logo from "../components/ui/Logo.vue";
import CartDrawer from "../components/shop/CartDrawer.vue";
import ThemeToggle from "../components/ui/ThemeToggle.vue";
import { onMounted, onBeforeUnmount } from "vue";
import { on } from "../composables/useRealtime.js";
import { useToast } from "../composables/useToast.js";

const toast = useToast();
let offLive = null;
onMounted(() => {
  offLive = on("order.updated", (o) => {
    if (!auth.isStudent) return;
    if (o.status === "READY") {
      toast.success(`Order ${o.code} is waiting at the counter. Show your pickup code.`, "Ready for pickup", { duration: 10000 });
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* not supported */
      }
    } else if (o.status === "ACCEPTED") toast.info(`${o.code} was accepted. You'll get an alert when it's ready.`, "Order accepted");
    else if (o.status === "CANCELLED" && route.name !== "order") toast.warning(`${o.code} was cancelled. Open it to see why.`, "Order cancelled");
  });
});
onBeforeUnmount(() => offLive?.()); 

const auth = useAuthStore();
const cart = useCartStore();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const q = ref(route.query.q || "");

watch(() => route.fullPath, () => (menuOpen.value = false));
watch(() => route.query.q, (v) => (q.value = v || ""));

function search() {
  const term = q.value.trim();
  if (term) router.push({ name: "search", query: { q: term } });
}

function logout() {
  auth.logout();
  cart.clear();
  router.push("/");
}

const links = [
  { to: "/", label: "Shops", exact: true },
  { to: "/search", label: "Compare dishes" },
  { to: "/about", label: "How it works" },
];
const isActive = (l) => (l.exact ? route.path === l.to : route.path.startsWith(l.to));
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 border-b border-line bg-card">
      <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <RouterLink to="/" class="shrink-0" aria-label="CampusBite home"><Logo /></RouterLink>

        <nav class="ml-4 hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium"
            :class="isActive(l) ? 'text-ink' : 'text-muted hover:text-ink'"
          >
            <span :class="isActive(l) && 'border-b-2 border-chili pb-[3px]'">{{ l.label }}</span>
          </RouterLink>
        </nav>

        <form class="relative ml-auto hidden w-64 xl:block" @submit.prevent="search">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input v-model="q" class="field h-9 pl-9 text-sm" placeholder="Search dishes, e.g. chapati" aria-label="Search dishes" />
        </form>

        <div class="ml-auto flex items-center gap-1 xl:ml-0">
          <template v-if="auth.isStudent">
            <RouterLink to="/orders" class="btn btn-ghost btn-sm hidden sm:inline-flex">Orders</RouterLink>
            <RouterLink to="/saved" class="btn btn-ghost btn-sm hidden sm:inline-flex">Saved</RouterLink>
          </template>

          <ThemeToggle class="text-ink-2" />

          <button
            v-if="!auth.isVendor"
            class="btn btn-sm relative ml-1"
            :class="cart.itemCount ? 'btn-dark' : 'btn-outline'"
            aria-label="Open basket"
            @click="cart.open = true"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            <span class="num">{{ cart.itemCount || "Basket" }}</span>
          </button>

          <div v-if="auth.isAuthenticated" class="relative ml-1 hidden sm:block">
            <details class="group">
              <summary class="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">
                {{ auth.firstName.slice(0, 1) }}
              </summary>
              <div class="absolute right-0 mt-2 w-52 rounded-lg bg-card shadow-[var(--shadow-card)] p-1.5 shadow-lg">
                <p class="px-3 pb-2 pt-1.5 text-xs text-muted">Signed in as<br /><span class="font-semibold text-ink">{{ auth.user.name }}</span></p>
                <RouterLink v-if="auth.isVendor" to="/vendor" class="block rounded-md px-3 py-2 text-sm hover:bg-paper-2">Back to my workspace</RouterLink>
                <template v-else>
                  <RouterLink to="/orders" class="block rounded-md px-3 py-2 text-sm hover:bg-paper-2">My orders</RouterLink>
                  <RouterLink to="/saved" class="block rounded-md px-3 py-2 text-sm hover:bg-paper-2">Saved shops</RouterLink>
                  <RouterLink to="/account" class="block rounded-md px-3 py-2 text-sm hover:bg-paper-2">Account</RouterLink>
                </template>
                <button class="block w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft" @click="logout">Log out</button>
              </div>
            </details>
          </div>
          <template v-else>
            <RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="btn btn-ghost btn-sm hidden sm:inline-flex">Log in</RouterLink>
            <RouterLink to="/register" class="btn btn-primary btn-sm hidden sm:inline-flex">Sign up</RouterLink>
          </template>

          <button class="btn btn-ghost btn-sm px-2 sm:hidden" aria-label="Menu" @click="menuOpen = !menuOpen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path v-if="!menuOpen" d="M4 7h16M4 12h16M4 17h16" /><path v-else d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      <div v-if="menuOpen" class="border-t border-line bg-paper px-4 pb-4 pt-3 sm:hidden">
        <form class="mb-3" @submit.prevent="search"><input v-model="q" class="field" placeholder="Search dishes" /></form>
        <nav class="flex flex-col text-[0.95rem]">
          <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="py-2.5 font-medium">{{ l.label }}</RouterLink>
          <template v-if="auth.isStudent">
            <RouterLink to="/orders" class="py-2.5 font-medium">My orders</RouterLink>
            <RouterLink to="/saved" class="py-2.5 font-medium">Saved shops</RouterLink>
            <RouterLink to="/account" class="py-2.5 font-medium">Account</RouterLink>
          </template>
          <button v-if="auth.isAuthenticated" class="py-2.5 text-left font-medium text-danger" @click="logout">Log out</button>
          <div v-else class="mt-2 grid grid-cols-2 gap-2">
            <RouterLink to="/login" class="btn btn-outline">Log in</RouterLink>
            <RouterLink to="/register" class="btn btn-primary">Sign up</RouterLink>
          </div>
        </nav>
      </div>
      <div v-if="route.query.preview && auth.isVendor" class="bg-ink py-2 text-center text-xs text-paper">
        You're previewing the customer view. <RouterLink to="/vendor" class="underline">Back to workspace</RouterLink>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="mt-20 border-t border-line">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p class="mt-3 max-w-xs text-muted">Pre-order from food stalls and cafés on the UR-CST campus in Nyarugenge. Pay with MoMo or cash, skip the queue.</p>
        </div>
        <div>
          <p class="eyebrow mb-3">For students</p>
          <ul class="space-y-2 text-ink-2">
            <li><RouterLink to="/" class="hover:text-ink">Browse shops</RouterLink></li>
            <li><RouterLink to="/search" class="hover:text-ink">Compare prices</RouterLink></li>
            <li><RouterLink to="/orders" class="hover:text-ink">Track an order</RouterLink></li>
            <li><RouterLink to="/about" class="hover:text-ink">How it works &amp; your data</RouterLink></li>
          </ul>
        </div>
        <div>
          <p class="eyebrow mb-3">For vendors</p>
          <ul class="space-y-2 text-ink-2">
            <li><RouterLink :to="{ name: 'register', query: { as: 'vendor' } }" class="hover:text-ink">List your stall</RouterLink></li>
            <li><RouterLink to="/login" class="hover:text-ink">Vendor login</RouterLink></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-line py-4 text-center text-xs text-muted">CampusBite · Academic prototype by Group 5, UR-CST · Food photos from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2">Unsplash</a> · Payments simulated</div>
    </footer>

    <CartDrawer />
  </div>
</template>

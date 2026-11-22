<script setup>
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { useShopStore } from "../stores/shop.js";
import { useToast } from "../composables/useToast.js";
import { usePolling } from "../composables/usePolling.js";
import { useLive } from "../composables/useLive.js";
import api, { errMsg } from "../composables/useApi.js";
import Logo from "../components/ui/Logo.vue";
import ThemeToggle from "../components/ui/ThemeToggle.vue";
import { Menu as MenuIcon, X, ExternalLink, LogOut } from "lucide-vue-next";

const auth = useAuthStore();
const shop = useShopStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const drawer = ref(false);
const toggling = ref(false);
const unreplied = ref(0);
let lastCount = null;
const sound = ref(localStorage.getItem("cb-chime") !== "off");
watch(sound, (v) => {
  try {
    localStorage.setItem("cb-chime", v ? "on" : "off");
  } catch {
    /* ignore */
  }
});
function chime() {
  if (!sound.value) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}

watch(() => route.fullPath, () => (drawer.value = false));

const nav = computed(() => [
  { to: "/vendor", label: "Overview", exact: true },
  { to: "/vendor/orders", label: "Orders", badge: shop.newOrders, hot: true },
  { to: "/vendor/menu", label: "Menu" },
  { to: "/vendor/reviews", label: "Reviews", badge: unreplied.value },
  { to: "/vendor/promotions", label: "Promotions" },
  { to: "/vendor/settings", label: "Shop settings" },
]);

function isActive(item) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to);
}

function setTitle(n) {
  const base = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = n > 0 ? `(${n}) ${base}` : base;
}

async function pollOrders() {
  try {
    // one cheap request for both sidebar badges
    const { data } = await api.get("/vendor/badges");
    const n = data.new_orders;
    if (lastCount !== null && n > lastCount) {
      toast.info(n - lastCount > 1 ? `${n - lastCount} new orders are waiting on the board.` : "A new order is waiting on the board.", "New order", { duration: 12000 });
      chime();
    }
    lastCount = n;
    shop.newOrders = n;
    unreplied.value = data.unreplied;
    setTitle(n);
  } catch {
    /* silent; next tick retries */
  }
}
useLive(["order.created", "order.updated"], pollOrders);
usePolling(pollOrders, 60000); // fallback if the live connection drops
watch(() => route.path, pollOrders);
router.afterEach(() => setTitle(shop.newOrders));

async function toggleOpen() {
  toggling.value = true;
  try {
    const v = await shop.toggleOpen();
    toast.success(v.is_open ? "You're accepting orders" : "Orders paused. Customers can still browse your menu.");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    toggling.value = false;
  }
}

function logout() {
  auth.logout();
  shop.reset();
  document.title = "CampusBite";
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-paper">
    <!-- Mobile top bar -->
    <header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-side-line bg-side px-4 text-side-ink lg:hidden">
      <button class="-ml-2 rounded-md p-2 hover:bg-white/10" aria-label="Open menu" @click="drawer = true">
        <MenuIcon class="h-5 w-5" />
      </button>
      <span class="truncate px-3 text-sm font-semibold">{{ shop.profile?.shop_name }}</span>
      <span class="flex items-center gap-1.5 text-xs" :class="shop.profile?.is_open ? 'text-[#d5dde5]' : 'text-line'">
        <span class="h-2 w-2 rounded-full" :class="shop.profile?.is_open ? 'bg-forest-2' : 'bg-line-2'" />
        {{ shop.profile?.is_open ? "Open" : "Paused" }}
      </span>
    </header>

    <!-- Drawer backdrop -->
    <Transition name="fade">
      <div v-if="drawer" class="fixed inset-0 z-40 bg-black/50 lg:hidden" @click="drawer = false" />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-side text-side-ink transition-transform duration-200 lg:translate-x-0"
      :class="drawer ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between px-5 pb-4 pt-5">
        <Logo light />
        <button class="rounded-md p-1.5 text-side-ink/75 hover:bg-white/10 lg:hidden" aria-label="Close menu" @click="drawer = false">
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="mx-3 rounded-lg border border-side-line bg-side-panel p-3">
        <p class="truncate text-sm font-semibold">{{ shop.profile?.shop_name }}</p>
        <p class="truncate text-xs text-side-ink/75">{{ shop.profile?.cuisine || "Food vendor" }} · {{ shop.profile?.opens_at }}–{{ shop.profile?.closes_at }}</p>
        <button
          class="mt-3 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition"
          :class="shop.profile?.is_open ? 'bg-forest-2 text-white hover:bg-forest' : 'bg-side-line text-side-ink hover:bg-white/10'"
          :disabled="toggling"
          @click="toggleOpen"
        >
          <span class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="shop.profile?.is_open ? 'bg-forest-2' : 'bg-line-2'" />
            {{ shop.profile?.is_open ? "Accepting orders" : "Orders paused" }}
          </span>
          <span class="relative h-5 w-9 rounded-full" :class="shop.profile?.is_open ? 'bg-forest-2' : 'bg-[#777777]'">
            <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" :class="shop.profile?.is_open ? 'left-[18px]' : 'left-0.5'" />
          </span>
        </button>
      </div>

      <nav class="mt-5 flex-1 space-y-0.5 overflow-y-auto px-3">
        <p class="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-side-ink/70">Workspace</p>
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center justify-between rounded-md px-3 py-2 text-sm transition"
          :class="isActive(item) ? 'bg-side-ink text-side font-semibold' : 'text-side-ink/75 hover:bg-white/5 hover:text-side-ink'"
        >
          {{ item.label }}
          <span
            v-if="item.badge"
            class="num min-w-[1.4rem] rounded px-1.5 text-center text-xs font-bold leading-5"
            :class="item.hot ? 'bg-chili text-white' : isActive(item) ? 'bg-side text-side-ink' : 'bg-white/15 text-side-ink'"
          >{{ item.badge }}</span>
        </RouterLink>
      </nav>

      <div class="border-t border-side-line p-3">
        <label class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-side-ink/85 hover:bg-white/5">
          Sound for new orders
          <input v-model="sound" type="checkbox" class="h-4 w-4 accent-[#6D8196]" />
        </label>
        <ThemeToggle label class="rounded-md text-side-ink/85 hover:bg-white/5" />
        <a
          v-if="shop.profile"
          :href="`/shops/${shop.profile.id}?preview=1`"
          target="_blank"
          rel="noopener"
          class="flex items-center justify-between rounded-md px-3 py-2 text-sm text-side-ink/75 hover:bg-white/5 hover:text-side-ink"
        >
          View my shop <ExternalLink class="h-3.5 w-3.5" />
        </a>
        <div class="mt-2 flex items-center justify-between gap-2 px-3 py-1.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{{ auth.user?.name }}</p>
            <p class="truncate text-xs text-side-ink/75">{{ auth.user?.email }}</p>
          </div>
          <button class="rounded-md p-2 text-side-ink/75 hover:bg-white/10 hover:text-side-ink" title="Log out" aria-label="Log out" @click="logout">
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Content -->
    <div class="lg:pl-64">
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="eyebrow">{{ shop.profile?.shop_name }}</p>
            <h1 class="display mt-1 text-3xl font-semibold">{{ route.meta.title }}</h1>
          </div>
          <div id="vendor-actions" class="flex flex-wrap items-center gap-2" />
        </div>
        <RouterView />
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useCartStore } from "../../stores/cart.js";
import { useAuthStore } from "../../stores/auth.js";
import { rwf } from "../../lib/format.js";
import FoodImage from "../ui/FoodImage.vue";

const cart = useCartStore();
const auth = useAuthStore();
const router = useRouter();

watch(() => cart.open, (v) => (document.body.style.overflow = v ? "hidden" : ""));

function checkout() {
  cart.open = false;
  if (!auth.isAuthenticated) router.push({ name: "login", query: { redirect: "/checkout" } });
  else router.push("/checkout");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="cart.open" class="fixed inset-0 z-50 bg-black/50" @click="cart.open = false" />
    </Transition>
    <Transition name="slide">
      <aside v-if="cart.open" class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-card shadow-2xl" aria-label="Basket">
        <header class="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 class="display text-xl font-semibold">Your basket</h2>
            <p v-if="cart.vendor" class="text-xs text-muted">
              From
              <RouterLink :to="`/shops/${cart.vendor.id}`" class="font-semibold text-ink-2 underline-offset-2 hover:underline" @click="cart.open = false">{{ cart.vendor.shop_name }}</RouterLink>
            </p>
          </div>
          <button class="rounded-md p-2 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close basket" @click="cart.open = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div v-if="!cart.items.length" class="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p class="display text-2xl font-semibold">Nothing here yet</p>
          <p class="mt-2 text-sm text-muted">Pick a shop, add a few things, and they'll show up here.</p>
          <RouterLink to="/" class="btn btn-outline mt-5" @click="cart.open = false">Browse shops</RouterLink>
        </div>

        <template v-else>
          <ul class="flex-1 divide-y divide-line overflow-y-auto px-5">
            <li v-for="item in cart.items" :key="item.menu_item_id" class="flex gap-3 py-4">
              <FoodImage :src="item.image_url" :alt="item.name" class="h-16 w-16 shrink-0 text-xs" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-semibold leading-snug">{{ item.name }}</p>
                  <p class="num shrink-0 text-sm font-semibold">{{ rwf(item.price * item.quantity) }}</p>
                </div>
                <p class="num text-xs text-muted">{{ rwf(item.price) }} each</p>
                <div class="mt-2 flex items-center justify-between">
                  <div class="inline-flex items-center rounded-md border border-line-2">
                    <button class="h-7 w-8 text-ink-2 hover:bg-paper-2" aria-label="Decrease" @click="cart.setQty(item.menu_item_id, item.quantity - 1)">−</button>
                    <span class="num w-7 text-center text-sm font-semibold">{{ item.quantity }}</span>
                    <button class="h-7 w-8 text-ink-2 hover:bg-paper-2" aria-label="Increase" @click="cart.setQty(item.menu_item_id, item.quantity + 1)">+</button>
                  </div>
                  <button class="text-xs text-muted underline-offset-2 hover:text-danger hover:underline" @click="cart.removeItem(item.menu_item_id)">Remove</button>
                </div>
              </div>
            </li>
          </ul>

          <footer class="border-t border-line px-5 pb-5 pt-4">
            <div class="flex items-baseline justify-between">
              <span class="text-sm text-ink-2">Subtotal</span>
              <span class="num display text-2xl font-semibold">{{ rwf(cart.subtotal) }}</span>
            </div>
            <p class="mt-1 text-xs text-muted">Promo codes and payment on the next step. No service fee.</p>
            <button class="btn btn-hot btn-lg mt-4 w-full" @click="checkout">Checkout</button>
            <button class="mt-2 w-full py-1 text-xs text-muted hover:text-ink" @click="cart.clear()">Empty basket</button>
          </footer>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

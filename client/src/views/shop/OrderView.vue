<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { usePolling } from "../../composables/usePolling.js";
import { useLive } from "../../composables/useLive.js";
import { useRealtime } from "../../composables/useRealtime.js";
import { rwf, clock, when, minutesUntil, STATUS, PAYMENT } from "../../lib/format.js";
import StatusPill from "../../components/ui/StatusPill.vue";
import Stars from "../../components/ui/Stars.vue";
import FoodImage from "../../components/ui/FoodImage.vue";
import ConfirmDialog from "../../components/ui/ConfirmDialog.vue";
import Lightbox from "../../components/ui/Lightbox.vue";
import OrderTimeline from "../../components/shop/OrderTimeline.vue";
import ReviewForm from "../../components/shop/ReviewForm.vue";
import { reorder } from "./reorder.js";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const order = ref(null);
const error = ref("");
const paying = ref(false);
const cancelOpen = ref(false);
const cancelling = ref(false);
const reviewOpen = ref(false);
const photoIndex = ref(null);
const placed = ref(!!route.query.placed);
const ease = ref(null);
async function rateEase(n) {
  ease.value = n;
  try {
    await api.post(`/orders/${order.value.id}/ease`, { rating: n });
  } catch {
    /* optional feedback; never block the student */
  }
}

const ACTIVE = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"];
const isActive = computed(() => order.value && ACTIVE.includes(order.value.status));
const needsPayment = computed(() => order.value && order.value.payment_method !== "CASH" && order.value.payment_status === "PENDING" && order.value.status !== "CANCELLED");
const eta = computed(() => (order.value ? minutesUntil(order.value.pickup_time) : 0));

const headline = computed(() => {
  const o = order.value;
  if (!o) return "";
  if (o.status === "READY") return "Ready at the counter";
  if (o.status === "COMPLETED") return "Enjoy your food";
  if (o.status === "CANCELLED") return "Order cancelled";
  if (o.status === "PREPARING") return "They're cooking it now";
  if (o.status === "ACCEPTED") return "The kitchen has your order";
  return "Waiting for the kitchen to accept";
});

async function load() {
  try {
    const { data } = await api.get(`/orders/${route.params.id}`);
    order.value = data;
    document.title = `${data.code} · ${STATUS[data.status].label}`;
  } catch (e) {
    error.value = e.response?.status === 404 ? "Order not found." : errMsg(e);
  }
}
const { connected } = useRealtime();
// Instant: the server pushes every change to this order. Polling only covers a dropped connection.
useLive(["order.updated"], (o) => (!o.id || o.id === order.value?.id) && load());
usePolling(() => {
  if (!order.value || ((isActive.value || needsPayment.value) && !connected.value)) load();
}, 15000);

async function pay() {
  paying.value = true;
  try {
    order.value = (await api.post(`/orders/${order.value.id}/pay`)).data;
    toast.success("The vendor can see your order is paid.", "Payment received");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    paying.value = false;
  }
}

async function cancel(reason) {
  cancelling.value = true;
  try {
    order.value = (await api.post(`/orders/${order.value.id}/cancel`, { reason })).data;
    cancelOpen.value = false;
    toast.warning(order.value.payment_status === "REFUNDED" ? "Your mobile money refund is on its way." : "The vendor won't prepare this order.", "Order cancelled");
  } catch (e) {
    toast.error(errMsg(e));
    cancelOpen.value = false;
    load();
  } finally {
    cancelling.value = false;
  }
}

async function again() {
  try {
    const { skipped, vendor } = await reorder(order.value);
    if (skipped) toast.warning(`${skipped} item${skipped > 1 ? "s are" : " is"} sold out today and ${skipped > 1 ? "were" : "was"} left out.`, "Some items unavailable");
    router.push(vendor.is_open ? "/checkout" : `/shops/${vendor.id}`);
  } catch (e) {
    toast.error(errMsg(e));
  }
}

function reviewed(review) {
  order.value = { ...order.value, review };
  reviewOpen.value = false;
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
    <RouterLink to="/orders" class="text-sm text-muted hover:text-ink">← All orders</RouterLink>

    <p v-if="error" class="mt-8 text-center text-lg">{{ error }}</p>
    <div v-else-if="!order" class="mt-6 space-y-4"><div class="skeleton h-40" /><div class="skeleton h-64" /></div>

    <template v-else>
      <div v-if="placed && order.status === 'SUBMITTED'" class="mt-4 flex items-start justify-between gap-3 rounded-md bg-forest px-4 py-3 text-sm text-white">
        <span>Order placed. {{ order.vendor.shop_name }} has been notified.</span>
        <button class="text-white/70 hover:text-white" aria-label="Dismiss" @click="placed = false">×</button>
      </div>

      <div v-if="placed && !order.ease_rating" class="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3 text-sm">
        <template v-if="!ease">
          <span class="text-ink-2">Quick question: how easy was it to place this order?</span>
          <span class="flex gap-1" role="group" aria-label="Ease of ordering, 1 is hard and 5 is very easy">
            <button v-for="n in 5" :key="n" class="btn btn-outline btn-sm w-10" :aria-label="`${n} of 5`" @click="rateEase(n)">{{ n }}</button>
          </span>
          <span class="text-xs text-muted">1 = hard · 5 = very easy</span>
        </template>
        <span v-else class="text-ink-2">Thanks, that helps us make ordering simpler.</span>
      </div>

      <div class="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div class="space-y-6">
          <!-- Status hero -->
          <section class="card overflow-hidden">
            <div class="p-6 sm:p-7" :class="order.status === 'READY' && 'bg-forest text-white'">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <StatusPill v-if="order.status !== 'READY'" :status="order.status" />
                  <span v-else class="tag bg-white/15 text-white"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-honey" /> Ready for pickup</span>
                  <h1 class="display mt-3 text-[2rem] font-semibold leading-tight">{{ headline }}</h1>
                  <p v-if="isActive" class="mt-1 text-sm" :class="order.status === 'READY' ? 'text-white/80' : 'text-ink-2'">
                    Pickup at <strong class="num">{{ clock(order.pickup_time) }}</strong>
                    <template v-if="eta > 0"> · in {{ eta }} min</template>
                    · {{ order.vendor.location }}
                  </p>
                  <p v-else class="mt-1 text-sm text-ink-2">{{ when(order.created_at) }}</p>
                  <p class="mt-2 max-w-md text-sm" :class="order.status === 'READY' ? 'text-white/90' : 'text-muted'">{{ STATUS[order.status].help }}</p>
                </div>
                <div class="text-right">
                  <p class="eyebrow" :class="order.status === 'READY' && 'text-white/70'">Pickup code</p>
                  <p class="font-mono text-3xl font-semibold tracking-wider">{{ order.code.replace("CB-", "") }}</p>
                  <p class="text-xs" :class="order.status === 'READY' ? 'text-white/70' : 'text-muted'">Show this at the counter</p>
                </div>
              </div>
            </div>

            <!-- Payment prompt (simulated mobile money push) -->
            <div v-if="needsPayment" class="border-t border-line border-l-4 border-l-warn bg-warn-soft p-6">
              <p class="font-semibold">Approve {{ rwf(order.total_amount) }} on your phone</p>
              <p class="mt-1 text-sm text-ink-2">
                We sent a payment request via {{ PAYMENT[order.payment_method] }} to <span class="num font-mono">{{ order.payment_phone }}</span>.
                Enter your PIN to confirm. The kitchen starts once you've paid.
              </p>
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button class="btn btn-dark" :disabled="paying" @click="pay">{{ paying ? "Checking…" : "I've approved it" }}</button>
                <span class="text-xs text-muted">Demo build: this button stands in for the operator's payment callback.</span>
              </div>
            </div>

            <div v-if="order.status === 'CANCELLED'" class="border-t border-line bg-danger-soft p-6 text-sm">
              <p><strong>{{ order.cancelled_by === "VENDOR" ? `${order.vendor.shop_name} cancelled` : "You cancelled" }}:</strong> {{ order.cancel_reason }}</p>
              <p v-if="order.payment_status === 'REFUNDED'" class="mt-1 text-ink-2">{{ rwf(order.total_amount) }} refunded to {{ order.payment_phone }}. Mobile money refunds usually land within minutes.</p>
            </div>

            <div v-if="order.status !== 'CANCELLED'" class="border-t border-line p-6 sm:p-7">
              <OrderTimeline :order="order" />
            </div>
          </section>

          <!-- Review -->
          <section v-if="order.status === 'COMPLETED'" class="card p-6">
            <template v-if="order.review">
              <p class="eyebrow">Your review</p>
              <Stars :value="order.review.rating" :size="18" class="mt-2" />
              <p v-if="order.review.comment" class="mt-2 text-ink-2">{{ order.review.comment }}</p>
              <div v-if="order.review.photos?.length" class="mt-3 flex gap-2">
                <button v-for="(p, i) in order.review.photos" :key="p.id" class="h-20 w-20 overflow-hidden rounded-md" @click="photoIndex = i">
                  <img :src="p.url" class="h-full w-full object-cover" alt="Your photo" />
                </button>
              </div>
              <div v-if="order.review.vendor_reply" class="mt-4 border-l-2 border-forest pl-4 text-sm">
                <p class="text-xs font-semibold text-forest">Reply from {{ order.vendor.shop_name }}</p>
                <p class="mt-1 text-ink-2">{{ order.review.vendor_reply }}</p>
              </div>
            </template>
            <div v-else class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="display text-xl font-semibold">How was it?</p>
                <p class="text-sm text-muted">Rate {{ order.vendor.shop_name }} and add a photo of your food.</p>
              </div>
              <button class="btn btn-primary" @click="reviewOpen = true">Write a review</button>
            </div>
          </section>
        </div>

        <!-- Receipt -->
        <aside class="space-y-4">
          <section class="card p-5">
            <RouterLink :to="`/shops/${order.vendor.id}`" class="flex items-center gap-3">
              <FoodImage :src="order.vendor.cover_url" :alt="order.vendor.shop_name" class="h-11 w-11 shrink-0 text-sm" rounded="rounded-md" />
              <div class="min-w-0">
                <p class="truncate font-semibold hover:underline">{{ order.vendor.shop_name }}</p>
                <p class="truncate text-xs text-muted">{{ order.vendor.location }}</p>
              </div>
            </RouterLink>
            <a :href="`tel:${order.vendor.phone}`" class="btn btn-outline btn-sm mt-3 w-full">Call {{ order.vendor.phone }}</a>

            <ul class="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
              <li v-for="i in order.items" :key="i.id" class="flex justify-between gap-3">
                <span><span class="num font-semibold">{{ i.quantity }}×</span> {{ i.menu_item.name }}</span>
                <span class="num shrink-0 text-ink-2">{{ rwf(i.subtotal) }}</span>
              </li>
            </ul>
            <p v-if="order.note" class="mt-3 rounded bg-paper-2 px-3 py-2 text-xs text-ink-2">Note: {{ order.note }}</p>
            <dl class="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div class="flex justify-between"><dt class="text-ink-2">Subtotal</dt><dd class="num">{{ rwf(order.subtotal) }}</dd></div>
              <div v-if="order.discount" class="flex justify-between text-forest"><dt>{{ order.promo_code }}</dt><dd class="num">−{{ rwf(order.discount) }}</dd></div>
              <div class="flex justify-between pt-1 font-semibold"><dt>Total</dt><dd class="num">{{ rwf(order.total_amount) }}</dd></div>
            </dl>
            <div class="mt-4 flex items-center justify-between rounded-md bg-paper-2 px-3 py-2 text-xs">
              <span>{{ PAYMENT[order.payment_method] }}</span>
              <span class="font-semibold" :class="order.payment_status === 'PAID' ? 'text-forest' : order.payment_status === 'REFUNDED' ? 'text-sky' : 'text-ink'">
                {{ order.payment_status === "PAID" ? "Paid" : order.payment_status === "REFUNDED" ? "Refunded" : order.payment_method === "CASH" ? "Pay at pickup" : "Awaiting payment" }}
              </span>
            </div>
          </section>

          <button v-if="order.status === 'SUBMITTED'" class="btn btn-danger w-full" @click="cancelOpen = true">Cancel order</button>
          <button v-if="!isActive" class="btn btn-outline w-full" @click="again">Order this again</button>
        </aside>
      </div>

      <ConfirmDialog
        :open="cancelOpen"
        title="Cancel this order?"
        body="The kitchen hasn't started yet, so this is free. Mobile money payments are refunded automatically."
        confirm-label="Cancel order"
        danger
        :busy="cancelling"
        :reasons="['Changed my plans', 'Ordered by mistake', 'Pickup time no longer works']"
        @close="cancelOpen = false"
        @confirm="cancel"
      />
      <ReviewForm v-if="order.status === 'COMPLETED' && !order.review" :open="reviewOpen" :order="order" @close="reviewOpen = false" @done="reviewed" />
      <Lightbox :photos="order.review?.photos || []" :index="photoIndex" @close="photoIndex = null" @update:index="(i) => (photoIndex = i)" />
    </template>
  </div>
</template>

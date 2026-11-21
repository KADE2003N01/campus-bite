<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import api, { errMsg } from "../../composables/useApi.js";
import { useCartStore } from "../../stores/cart.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";
import { rwf, withinHours } from "../../lib/format.js";
import PickupSlots from "../../components/shop/PickupSlots.vue";
import FoodImage from "../../components/ui/FoodImage.vue";

const cart = useCartStore();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const vendor = ref(null);
const pickup = ref("");
const method = ref("MOMO");
const phone = ref(auth.user?.phone || "");
const note = ref("");
const promoInput = ref("");
const promo = ref(null); // { code, percent_off, discount }
const promoError = ref("");
const checkingPromo = ref(false);
const placing = ref(false);
const problems = ref([]);
const slotsRef = ref(null);

const discount = computed(() => promo.value?.discount || 0);
const total = computed(() => cart.subtotal - discount.value);
const phoneOk = computed(() => method.value === "CASH" || /^07[2389]\d{7}$/.test(phone.value.replace(/\s/g, "")));
const live = computed(() => vendor.value && vendor.value.is_open && withinHours(vendor.value));
const canPlace = computed(() => cart.items.length && pickup.value && phoneOk.value && live.value && !problems.value.length && !placing.value);

const methods = [
  { id: "MOMO", name: "MTN MoMo", sub: "Approve the prompt on your phone", color: "#FFCC00" },
  { id: "AIRTEL", name: "Airtel Money", sub: "Approve the prompt on your phone", color: "#E40000" },
  { id: "CASH", name: "Cash at pickup", sub: "Pay the vendor when you collect", color: "#4A4A4A" },
];

onMounted(async () => {
  if (!cart.items.length) return;
  try {
    const { data } = await api.get(`/vendors/${cart.vendorId}`);
    vendor.value = data.vendor;
    // Reconcile basket with the live menu (price changes, sold-out items)
    const byId = new Map(data.items.map((i) => [i.id, i]));
    const issues = [];
    for (const line of cart.items) {
      const live = byId.get(line.menu_item_id);
      if (!live) issues.push(`${line.name} is no longer on the menu`);
      else if (!live.is_available) issues.push(`${line.name} is sold out`);
      else if (live.price !== line.price) {
        line.price = live.price;
        toast.warning(`${line.name} now costs ${rwf(live.price)}. Your total has been updated.`, "Price changed");
      }
    }
    problems.value = issues;
  } catch (e) {
    toast.error(errMsg(e));
  }
});

watch(() => cart.subtotal, () => {
  if (promo.value) applyPromo(promo.value.code);
});
watch(() => cart.items.length, () => {
  problems.value = problems.value.filter((p) => cart.items.some((i) => p.startsWith(i.name)));
});

async function applyPromo(code = promoInput.value) {
  if (!code.trim()) return;
  checkingPromo.value = true;
  promoError.value = "";
  try {
    const { data } = await api.post("/promos/validate", { vendor_id: cart.vendorId, code, subtotal: cart.subtotal });
    promo.value = data;
    promoInput.value = data.code;
  } catch (e) {
    promo.value = null;
    promoError.value = errMsg(e);
  } finally {
    checkingPromo.value = false;
  }
}

function removePromo() {
  promo.value = null;
  promoInput.value = "";
  promoError.value = "";
}

async function place() {
  placing.value = true;
  try {
    const { data } = await api.post("/orders", {
      vendor_id: cart.vendorId,
      pickup_time: pickup.value,
      note: note.value.trim() || undefined,
      items: cart.items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      promo_code: promo.value?.code,
      payment_method: method.value,
      payment_phone: method.value === "CASH" ? undefined : phone.value.replace(/\s/g, ""),
      checkout_seconds: cart.startedAt ? Math.round((Date.now() - cart.startedAt) / 1000) : undefined,
    });
    if (!auth.user.phone && method.value !== "CASH") auth.updateMe({ name: auth.user.name, phone: phone.value.replace(/\s/g, "") }).catch(() => {});
    cart.clear();
    router.replace({ name: "order", params: { id: data.id }, query: { placed: 1 } });
  } catch (e) {
    toast.error(errMsg(e));
    if (e.response?.status === 409) slotsRef.value?.reload();
  } finally {
    placing.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <div v-if="!cart.items.length" class="mx-auto max-w-md py-16 text-center">
      <h1 class="display text-3xl font-semibold">Your basket is empty</h1>
      <p class="mt-2 text-muted">Add a few things from a shop first.</p>
      <RouterLink to="/" class="btn btn-primary mt-6">Browse shops</RouterLink>
    </div>

    <template v-else>
      <RouterLink :to="`/shops/${cart.vendorId}`" class="text-sm text-muted hover:text-ink">← Back to {{ cart.vendor.shop_name }}</RouterLink>
      <h1 class="display mt-2 text-[2.2rem] font-semibold">Checkout</h1>

      <div class="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div class="space-y-6">
          <div v-if="vendor && !live" class="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            {{ vendor.shop_name }} stopped taking orders. Your basket is saved, so try again when they reopen.
          </div>
          <div v-if="problems.length" class="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            <p class="font-semibold">Fix your basket before ordering:</p>
            <ul class="mt-1 list-disc pl-5">
              <li v-for="p in problems" :key="p">{{ p }}</li>
            </ul>
            <button class="mt-2 underline" @click="cart.open = true">Edit basket</button>
          </div>

          <section class="card p-5 sm:p-6">
            <div class="flex items-baseline justify-between">
              <h2 class="display text-xl font-semibold"><span class="mr-2 font-mono text-sm text-muted">01</span>Pickup time</h2>
              <span v-if="vendor" class="text-xs text-muted">{{ vendor.location }}</span>
            </div>
            <p class="mt-1 text-sm text-muted">The kitchen needs about {{ cart.vendor.prep_minutes }} minutes. Your order page will show when it's ready.</p>
            <div class="mt-4"><PickupSlots ref="slotsRef" v-model="pickup" :vendor="vendor || cart.vendor" /></div>
          </section>

          <section class="card p-5 sm:p-6">
            <h2 class="display text-xl font-semibold"><span class="mr-2 font-mono text-sm text-muted">02</span>Payment</h2>
            <div class="mt-4 grid gap-2 sm:grid-cols-3">
              <label
                v-for="m in methods"
                :key="m.id"
                class="flex cursor-pointer flex-col rounded-lg border p-3.5 transition"
                :class="method === m.id ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line-2 hover:border-ink-2'"
              >
                <input v-model="method" type="radio" :value="m.id" class="sr-only" />
                <span class="flex items-center gap-2 text-sm font-semibold">
                  <span class="h-3 w-3 rounded-full" :style="{ background: m.color }" />{{ m.name }}
                </span>
                <span class="mt-1 text-xs text-muted">{{ m.sub }}</span>
              </label>
            </div>
            <div v-if="method !== 'CASH'" class="mt-4 max-w-xs">
              <label class="label" for="pay-phone">{{ method === "MOMO" ? "MoMo" : "Airtel Money" }} number</label>
              <input id="pay-phone" v-model="phone" inputmode="tel" class="field num" placeholder="078 812 3456" />
              <p v-if="phone && !phoneOk" class="hint text-danger">Use a Rwandan mobile number, e.g. 0788123456</p>
              <p v-else class="hint">You'll get a prompt to approve {{ rwf(total) }}.</p>
            </div>
          </section>

          <section class="card p-5 sm:p-6">
            <h2 class="display text-xl font-semibold"><span class="mr-2 font-mono text-sm text-muted">03</span>Note for the kitchen</h2>
            <textarea v-model="note" rows="2" maxlength="300" class="field mt-4" placeholder="Optional, e.g. no onions, extra pili-pili" />
          </section>
        </div>

        <aside>
          <div class="card sticky top-24 p-5 sm:p-6">
            <h2 class="display text-xl font-semibold">{{ cart.vendor.shop_name }}</h2>
            <ul class="mt-4 divide-y divide-line">
              <li v-for="i in cart.items" :key="i.menu_item_id" class="flex items-center gap-3 py-3">
                <FoodImage :src="i.image_url" :alt="i.name" class="h-12 w-12 shrink-0 text-xs" rounded="rounded-md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ i.name }}</p>
                  <div class="mt-0.5 inline-flex items-center rounded border border-line-2 text-xs">
                    <button class="px-2 py-0.5 hover:bg-paper-2" aria-label="Decrease" @click="cart.setQty(i.menu_item_id, i.quantity - 1)">−</button>
                    <span class="num w-5 text-center font-semibold">{{ i.quantity }}</span>
                    <button class="px-2 py-0.5 hover:bg-paper-2" aria-label="Increase" @click="cart.setQty(i.menu_item_id, i.quantity + 1)">+</button>
                  </div>
                </div>
                <span class="num text-sm font-medium">{{ rwf(i.price * i.quantity) }}</span>
              </li>
            </ul>

            <div class="mt-3 border-t border-line pt-4">
              <div v-if="promo" class="flex items-center justify-between rounded-md bg-forest-soft px-3 py-2 text-sm">
                <span><span class="font-mono font-semibold text-forest">{{ promo.code }}</span> · {{ promo.percent_off }}% off</span>
                <button class="text-xs text-forest underline" @click="removePromo">Remove</button>
              </div>
              <form v-else class="flex gap-2" @submit.prevent="applyPromo()">
                <input v-model="promoInput" class="field font-mono text-sm uppercase" placeholder="Promo code" aria-label="Promo code" />
                <button class="btn btn-outline" :disabled="!promoInput.trim() || checkingPromo">{{ checkingPromo ? "…" : "Apply" }}</button>
              </form>
              <p v-if="promoError" class="mt-1.5 text-xs text-danger">{{ promoError }}</p>
            </div>

            <dl class="mt-4 space-y-1.5 text-sm">
              <div class="flex justify-between"><dt class="text-ink-2">Subtotal</dt><dd class="num">{{ rwf(cart.subtotal) }}</dd></div>
              <div v-if="discount" class="flex justify-between text-forest"><dt>Discount</dt><dd class="num">−{{ rwf(discount) }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-2">Service fee</dt><dd class="text-muted">Free</dd></div>
              <div class="flex items-baseline justify-between border-t border-line pt-3">
                <dt class="font-semibold">Total</dt><dd class="num display text-2xl font-semibold">{{ rwf(total) }}</dd>
              </div>
            </dl>

            <button class="btn btn-hot btn-lg mt-5 w-full" :disabled="!canPlace" @click="place">
              {{ placing ? "Placing order…" : method === "CASH" ? "Place order" : `Place order · pay ${rwf(total)}` }}
            </button>
            <p class="mt-2 text-center text-xs text-muted">You can cancel for free until the kitchen accepts.</p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

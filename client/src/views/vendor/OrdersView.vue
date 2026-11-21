<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { usePolling } from "../../composables/usePolling.js";
import { useLive } from "../../composables/useLive.js";
import { useRealtime } from "../../composables/useRealtime.js";

const { connected } = useRealtime();
import { useShopStore } from "../../stores/shop.js";
import { rwf, num, when, PAYMENT } from "../../lib/format.js";
import OrderCard from "../../components/vendor/OrderCard.vue";
import StatusPill from "../../components/ui/StatusPill.vue";
import ConfirmDialog from "../../components/ui/ConfirmDialog.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const toast = useToast();
const shop = useShopStore();
const tab = ref("board");

// ── Live board ──
const board = ref([]);
const boardLoaded = ref(false);
const busyId = ref(null);
const seen = new Set();
const fresh = ref(new Set());
const now = ref(Date.now());
let clockTimer;

async function loadBoard() {
  try {
    const { data } = await api.get("/vendor/orders", { params: { status: "SUBMITTED,ACCEPTED,PREPARING,READY", board: 1 } });
    const newOnes = new Set(fresh.value);
    for (const o of data) {
      if (boardLoaded.value && !seen.has(o.id) && o.status === "SUBMITTED") newOnes.add(o.id);
      seen.add(o.id);
    }
    fresh.value = newOnes;
    board.value = data;
    shop.newOrders = data.filter((o) => o.status === "SUBMITTED").length;
  } catch (e) {
    if (!boardLoaded.value) toast.error(errMsg(e));
  } finally {
    boardLoaded.value = true;
  }
}
useLive(["order.created", "order.updated"], () => tab.value === "board" && loadBoard());
usePolling(() => tab.value === "board" && !connected.value && loadBoard(), 10000);
onMounted(() => (clockTimer = setInterval(() => (now.value = Date.now()), 30000)));
onBeforeUnmount(() => clearInterval(clockTimer));

const COLUMNS = [
  { status: "SUBMITTED", title: "New" },
  { status: "ACCEPTED", title: "Accepted" },
  { status: "PREPARING", title: "Preparing" },
  { status: "READY", title: "Ready" },
];
const byStatus = computed(() => {
  const m = { SUBMITTED: [], ACCEPTED: [], PREPARING: [], READY: [] };
  for (const o of board.value) m[o.status]?.push(o);
  return m;
});

const DONE_MSG = { ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Marked ready, customer notified", COMPLETED: "Order completed" };

async function advance(order, status) {
  busyId.value = order.id;
  try {
    const { data } = await api.patch(`/vendor/orders/${order.id}/status`, { status });
    const f = new Set(fresh.value);
    f.delete(order.id);
    fresh.value = f;
    if (status === "COMPLETED") board.value = board.value.filter((o) => o.id !== order.id);
    else Object.assign(order, data);
    shop.newOrders = board.value.filter((o) => o.status === "SUBMITTED").length;
    toast.success(`${order.code}: ${DONE_MSG[status]}`);
  } catch (e) {
    toast.error(errMsg(e));
    loadBoard();
  } finally {
    busyId.value = null;
  }
}

const cancelling = ref(null);
const cancelBusy = ref(false);
async function confirmCancel(reason) {
  const order = cancelling.value;
  cancelBusy.value = true;
  try {
    await api.patch(`/vendor/orders/${order.id}/status`, { status: "CANCELLED", reason });
    board.value = board.value.filter((o) => o.id !== order.id);
    shop.newOrders = board.value.filter((o) => o.status === "SUBMITTED").length;
    toast.warning(`${order.code} was cancelled${order.payment_status === "REFUNDED" ? " and the customer refunded" : ""}. They can see your reason.`, "Order cancelled");
    cancelling.value = null;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    cancelBusy.value = false;
  }
}

// ── History ──
const history = ref([]);
const histLoading = ref(false);
const q = ref("");
const days = ref(7);
let debounce;

async function loadHistory() {
  histLoading.value = true;
  try {
    const { data } = await api.get("/vendor/orders", {
      params: { status: "COMPLETED,CANCELLED", days: days.value, q: q.value.trim() || undefined, take: 500 },
    });
    history.value = data;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    histLoading.value = false;
  }
}
watch(tab, (t) => (t === "history" ? loadHistory() : loadBoard()));
watch(days, loadHistory);
watch(q, () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadHistory, 300);
});

const totals = computed(() => {
  const done = history.value.filter((o) => o.status === "COMPLETED");
  return {
    completed: done.length,
    cancelled: history.value.length - done.length,
    revenue: done.reduce((s, o) => s + o.total_amount, 0),
    discount: done.reduce((s, o) => s + o.discount, 0),
  };
});
const itemsText = (o) => o.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(", ");
</script>

<template>
  <div>
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex rounded-lg border border-line-2 bg-card p-0.5 text-sm">
        <button class="rounded-md px-4 py-1.5 font-semibold" :class="tab === 'board' ? 'bg-ink text-paper' : 'text-ink-2'" @click="tab = 'board'">
          Live board <span class="num ml-1 opacity-70">{{ board.length }}</span>
        </button>
        <button class="rounded-md px-4 py-1.5 font-semibold" :class="tab === 'history' ? 'bg-ink text-paper' : 'text-ink-2'" @click="tab = 'history'">History</button>
      </div>
      <p v-if="tab === 'board'" class="flex items-center gap-2 text-xs text-muted">
        <span class="h-1.5 w-1.5 rounded-full" :class="connected ? 'animate-pulse bg-[#15803d]' : 'bg-line-3'" />
        {{ connected ? "Live: new orders appear instantly" : "Reconnecting… checking every 10 seconds" }}
      </p>
    </div>

    <!-- Board -->
    <template v-if="tab === 'board'">
      <div v-if="!shop.profile?.is_open" class="mb-4 rounded-lg border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm text-ink">
        Orders are paused, so students can't place new orders. Use the switch in the sidebar to reopen.
      </div>
      <div v-if="!boardLoaded" class="grid gap-3 md:grid-cols-4">
        <div v-for="i in 4" :key="i" class="skeleton h-72" />
      </div>
      <div v-else class="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        <section v-for="col in COLUMNS" :key="col.status" class="w-[82vw] max-w-[320px] shrink-0 snap-start rounded-xl bg-paper-2 p-2.5 md:w-auto md:max-w-none">
          <header class="flex items-center justify-between px-1 pb-2.5 pt-0.5">
            <h2 class="text-sm font-semibold">{{ col.title }}</h2>
            <span class="num rounded px-1.5 text-xs font-bold leading-5" :class="col.status === 'SUBMITTED' && byStatus[col.status].length ? 'bg-chili text-white' : 'bg-line text-ink-2'">
              {{ byStatus[col.status].length }}
            </span>
          </header>
          <div class="space-y-2.5">
            <OrderCard
              v-for="o in byStatus[col.status]"
              :key="o.id"
              :order="o"
              :now="now"
              :fresh="fresh.has(o.id)"
              :busy="busyId === o.id"
              @advance="(s) => advance(o, s)"
              @cancel="cancelling = o"
            />
            <p v-if="!byStatus[col.status].length" class="rounded-lg border border-dashed border-line-3 px-3 py-6 text-center text-xs text-muted">Nothing here</p>
          </div>
        </section>
      </div>
    </template>

    <!-- History -->
    <template v-else>
      <div class="mb-4 flex flex-wrap gap-2">
        <input v-model="q" class="field max-w-xs flex-1" placeholder="Search code or customer name" type="search" />
        <select v-model="days" class="field w-auto">
          <option :value="1">Today</option>
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
        </select>
      </div>

      <p class="mb-3 text-sm text-ink-2">
        <span class="num font-semibold">{{ totals.completed }}</span> completed ·
        <span class="num font-semibold">{{ totals.cancelled }}</span> cancelled ·
        <span class="num font-semibold">{{ rwf(totals.revenue) }}</span> collected
        <span v-if="totals.discount" class="text-muted">({{ num(totals.discount) }} RWF in promo discounts)</span>
      </p>

      <div v-if="histLoading && !history.length" class="skeleton h-64" />
      <EmptyState v-else-if="!history.length" title="No orders in this range" body="Try a longer date range or a different search." />
      <div v-else class="card overflow-hidden">
        <table class="hidden w-full text-sm md:table">
          <thead class="border-b border-line bg-paper text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2.5 font-semibold">Order</th>
              <th class="px-4 py-2.5 font-semibold">Customer</th>
              <th class="px-4 py-2.5 font-semibold">Items</th>
              <th class="px-4 py-2.5 font-semibold">Pickup</th>
              <th class="px-4 py-2.5 font-semibold">Payment</th>
              <th class="px-4 py-2.5 font-semibold">Status</th>
              <th class="px-4 py-2.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="o in history" :key="o.id" class="align-top hover:bg-paper/60">
              <td class="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold">{{ o.code }}</td>
              <td class="px-4 py-2.5">{{ o.student?.name }}<span v-if="o.review" class="ml-1.5 text-xs text-honey">★{{ o.review.rating }}</span></td>
              <td class="max-w-[260px] px-4 py-2.5 text-ink-2">
                <span class="line-clamp-2">{{ itemsText(o) }}</span>
                <span v-if="o.cancel_reason" class="mt-0.5 block text-xs text-danger">{{ o.cancelled_by === "STUDENT" ? "Customer" : "You" }}: {{ o.cancel_reason }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-2.5 text-ink-2">{{ when(o.pickup_time) }}</td>
              <td class="whitespace-nowrap px-4 py-2.5 text-xs text-ink-2">{{ PAYMENT[o.payment_method] }}<span class="block text-muted">{{ o.payment_status.toLowerCase() }}</span></td>
              <td class="px-4 py-2.5"><StatusPill :status="o.status" short /></td>
              <td class="num whitespace-nowrap px-4 py-2.5 text-right font-semibold" :class="o.status === 'CANCELLED' && 'text-muted line-through'">{{ rwf(o.total_amount) }}</td>
            </tr>
          </tbody>
        </table>
        <ul class="divide-y divide-line md:hidden">
          <li v-for="o in history" :key="o.id" class="px-4 py-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-semibold">{{ o.code }}</span>
              <StatusPill :status="o.status" short />
            </div>
            <p class="mt-1 font-medium">{{ o.student?.name }}</p>
            <p class="text-ink-2">{{ itemsText(o) }}</p>
            <p v-if="o.cancel_reason" class="text-xs text-danger">{{ o.cancel_reason }}</p>
            <div class="mt-1 flex justify-between text-xs text-muted">
              <span>{{ when(o.pickup_time) }} · {{ PAYMENT[o.payment_method] }}</span>
              <span class="num font-semibold text-ink">{{ rwf(o.total_amount) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <ConfirmDialog
      :open="!!cancelling"
      :title="`Cancel ${cancelling?.code || ''}?`"
      :body="cancelling?.payment_status === 'PAID' ? 'The customer has paid by mobile money. They will be refunded automatically.' : 'The customer will see the reason you choose.'"
      confirm-label="Cancel order"
      danger
      :busy="cancelBusy"
      :reasons="['Item sold out', 'Kitchen closing early', `Can't make it by pickup time`]"
      @close="cancelling = null"
      @confirm="confirmCancel"
    />
  </div>
</template>

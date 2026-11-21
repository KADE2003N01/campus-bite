<script setup>
import { ref, reactive, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { rwf, num, shortDate } from "../../lib/format.js";
import Modal from "../../components/ui/Modal.vue";
import EmptyState from "../../components/ui/EmptyState.vue";

const toast = useToast();
const promos = ref([]);
const loading = ref(true);
const open = ref(false);
const busy = ref(false);
const toggling = ref(null);
const form = reactive({ code: "", percent_off: 10, min_order: 0, max_uses: "", expires_at: "" });

async function load() {
  try {
    const { data } = await api.get("/vendor/promos");
    promos.value = data.promos;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function openNew() {
  Object.assign(form, { code: "", percent_off: 10, min_order: 0, max_uses: "", expires_at: "" });
  open.value = true;
}

async function create() {
  busy.value = true;
  try {
    const { data } = await api.post("/vendor/promos", {
      code: form.code.trim().toUpperCase(),
      percent_off: Number(form.percent_off),
      min_order: Number(form.min_order) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59").toISOString() : null,
    });
    promos.value.unshift(data.promo);
    open.value = false;
    toast.success(`Students can use ${data.promo.code} at checkout now.`, "Code created");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = false;
  }
}

async function toggle(p) {
  toggling.value = p.id;
  try {
    const { data } = await api.patch(`/vendor/promos/${p.id}`);
    p.is_active = data.promo.is_active;
    p.is_active ? toast.success(`Students can use ${p.code} at checkout.`, "Code switched on") : toast.info(`${p.code} no longer works at checkout.`, "Code switched off");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    toggling.value = null;
  }
}

function state(p) {
  if (!p.is_active) return { label: "Off", cls: "bg-paper-2 text-muted" };
  if (p.expires_at && new Date(p.expires_at) < new Date()) return { label: "Expired", cls: "bg-danger-soft text-danger" };
  if (p.max_uses != null && p.used_count >= p.max_uses) return { label: "Used up", cls: "bg-honey-soft text-ink" };
  return { label: "Live", cls: "bg-forest-soft text-forest" };
}
const today = new Date().toISOString().slice(0, 10);
</script>

<template>
  <div>
    <Teleport to="#vendor-actions" defer>
      <button class="btn btn-primary" @click="openNew">New code</button>
    </Teleport>

    <p class="mb-5 max-w-2xl text-sm text-ink-2">
      Discount codes that students type at checkout. Use them for slow afternoons, new dishes, or to thank regulars.
      Discounts come off the order total; you can switch a code off at any time.
    </p>

    <div v-if="loading" class="space-y-2"><div v-for="i in 3" :key="i" class="skeleton h-20" /></div>
    <EmptyState v-else-if="!promos.length" title="No codes yet" body="Create a code like LUNCH10 and share it on your counter or WhatsApp status.">
      <button class="btn btn-primary" @click="openNew">Create a code</button>
    </EmptyState>

    <div v-else class="card overflow-hidden">
      <table class="hidden w-full text-sm md:table">
        <thead class="border-b border-line bg-paper text-left text-xs text-muted">
          <tr>
            <th class="px-4 py-2.5 font-semibold">Code</th>
            <th class="px-4 py-2.5 font-semibold">Discount</th>
            <th class="px-4 py-2.5 font-semibold">Min. order</th>
            <th class="px-4 py-2.5 font-semibold">Used</th>
            <th class="px-4 py-2.5 font-semibold">Expires</th>
            <th class="px-4 py-2.5 text-right font-semibold">Sales / given away</th>
            <th class="px-4 py-2.5 font-semibold">Status</th>
            <th class="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="p in promos" :key="p.id" :class="!p.is_active && 'text-muted'">
            <td class="px-4 py-3 font-mono font-semibold tracking-wide">{{ p.code }}</td>
            <td class="num px-4 py-3 font-semibold">{{ p.percent_off }}%</td>
            <td class="num px-4 py-3">{{ p.min_order ? rwf(p.min_order) : "None" }}</td>
            <td class="num px-4 py-3">{{ p.used_count }}<span class="text-muted"> / {{ p.max_uses ?? "∞" }}</span></td>
            <td class="px-4 py-3">{{ p.expires_at ? shortDate(p.expires_at) : "Never" }}</td>
            <td class="num px-4 py-3 text-right">{{ rwf(p.sales) }}<span class="block text-xs text-muted">−{{ num(p.discount_given) }}</span></td>
            <td class="px-4 py-3"><span class="tag" :class="state(p).cls">{{ state(p).label }}</span></td>
            <td class="px-4 py-3 text-right">
              <button class="btn btn-outline btn-sm" :disabled="toggling === p.id" @click="toggle(p)">{{ p.is_active ? "Switch off" : "Switch on" }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <ul class="divide-y divide-line md:hidden">
        <li v-for="p in promos" :key="p.id" class="p-4 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-mono font-semibold tracking-wide">{{ p.code }}</span>
            <span class="tag" :class="state(p).cls">{{ state(p).label }}</span>
          </div>
          <p class="mt-1 text-ink-2">
            <span class="num font-semibold">{{ p.percent_off }}% off</span>
            <template v-if="p.min_order"> orders over {{ rwf(p.min_order) }}</template>
            · used {{ p.used_count }}/{{ p.max_uses ?? "∞" }}
            · {{ p.expires_at ? `until ${shortDate(p.expires_at)}` : "no expiry" }}
          </p>
          <div class="mt-2 flex items-center justify-between">
            <span class="num text-xs text-muted">{{ rwf(p.sales) }} sales · −{{ num(p.discount_given) }}</span>
            <button class="btn btn-outline btn-sm" :disabled="toggling === p.id" @click="toggle(p)">{{ p.is_active ? "Switch off" : "Switch on" }}</button>
          </div>
        </li>
      </ul>
    </div>

    <Modal :open="open" title="New discount code" width="max-w-md" @close="open = false">
      <form id="promo-form" class="space-y-4" @submit.prevent="create">
        <div>
          <label class="label" for="pr-code">Code</label>
          <input
            id="pr-code"
            v-model="form.code"
            class="field font-mono uppercase tracking-wide"
            required
            pattern="[A-Za-z0-9]{3,16}"
            maxlength="16"
            placeholder="LUNCH10"
            @input="form.code = form.code.toUpperCase().replace(/[^A-Z0-9]/g, '')"
          />
          <p class="hint">3–16 letters or numbers. Keep it easy to say out loud.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="pr-pct">Percent off</label>
            <input id="pr-pct" v-model="form.percent_off" type="number" min="1" max="90" class="field num" required />
          </div>
          <div>
            <label class="label" for="pr-min">Min. order (RWF)</label>
            <input id="pr-min" v-model="form.min_order" type="number" min="0" step="100" class="field num" />
          </div>
          <div>
            <label class="label" for="pr-max">Max. uses</label>
            <input id="pr-max" v-model="form.max_uses" type="number" min="1" class="field num" placeholder="Unlimited" />
          </div>
          <div>
            <label class="label" for="pr-exp">Expires</label>
            <input id="pr-exp" v-model="form.expires_at" type="date" :min="today" class="field" />
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn btn-ghost" @click="open = false">Cancel</button>
        <button class="btn btn-primary" form="promo-form" :disabled="busy">{{ busy ? "Creating…" : "Create code" }}</button>
      </template>
    </Modal>
  </div>
</template>

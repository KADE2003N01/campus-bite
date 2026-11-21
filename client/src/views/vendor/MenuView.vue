<script setup>
import { ref, computed, onMounted } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";
import { rwf, num } from "../../lib/format.js";
import FoodImage from "../../components/ui/FoodImage.vue";
import ConfirmDialog from "../../components/ui/ConfirmDialog.vue";
import EmptyState from "../../components/ui/EmptyState.vue";
import MenuItemModal from "../../components/vendor/MenuItemModal.vue";

const toast = useToast();
const items = ref([]);
const loading = ref(true);
const search = ref("");
const cat = ref("");
const editing = ref(null);
const modalOpen = ref(false);
const removing = ref(null);
const removeBusy = ref(false);
const toggling = ref(null);

async function load() {
  try {
    const { data } = await api.get("/vendor/menu");
    items.value = data.items;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const categories = computed(() => [...new Set(items.value.map((i) => i.category).filter(Boolean))].sort());
const filtered = computed(() => {
  const s = search.value.trim().toLowerCase();
  return items.value.filter(
    (i) => (!cat.value || i.category === cat.value) && (!s || i.name.toLowerCase().includes(s) || (i.description || "").toLowerCase().includes(s)),
  );
});
const groups = computed(() => {
  const m = new Map();
  for (const i of filtered.value) {
    const k = i.category || "Uncategorised";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  return [...m.entries()];
});
const soldOut = computed(() => items.value.filter((i) => !i.is_available).length);

function openNew() {
  editing.value = null;
  modalOpen.value = true;
}
function openEdit(item) {
  editing.value = item;
  modalOpen.value = true;
}
function onSaved(item) {
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx >= 0) items.value[idx] = { ...items.value[idx], ...item };
  else items.value.push(item);
  modalOpen.value = false;
}

async function toggle(item) {
  toggling.value = item.id;
  try {
    const { data } = await api.patch(`/vendor/menu/${item.id}/availability`);
    item.is_available = data.item.is_available;
    item.is_available ? toast.success(`Students can order ${item.name} again.`, "Back on the menu") : toast.warning(`${item.name} can't be ordered until you switch it back on.`, "Marked sold out");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    toggling.value = null;
  }
}

async function confirmRemove() {
  removeBusy.value = true;
  try {
    await api.delete(`/vendor/menu/${removing.value.id}`);
    items.value = items.value.filter((i) => i.id !== removing.value.id);
    toast.success(`${removing.value.name} was removed. Past orders keep it in their history.`, "Item removed");
    removing.value = null;
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    removeBusy.value = false;
  }
}
</script>

<template>
  <div>
    <Teleport to="#vendor-actions" defer>
      <button class="btn btn-primary" @click="openNew">Add item</button>
    </Teleport>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input v-model="search" type="search" class="field sm:max-w-xs" placeholder="Search your menu" />
      <p class="text-sm text-muted">
        <span class="num font-semibold text-ink">{{ items.length }}</span> items
        <template v-if="soldOut"> · <span class="num font-semibold text-danger">{{ soldOut }}</span> sold out</template>
      </p>
    </div>
    <div class="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <button class="chip" :class="!cat && 'chip-on'" @click="cat = ''">All</button>
      <button v-for="c in categories" :key="c" class="chip" :class="cat === c && 'chip-on'" @click="cat = cat === c ? '' : c">{{ c }}</button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 5" :key="i" class="skeleton h-20" />
    </div>
    <EmptyState v-else-if="!items.length" title="Your menu is empty" body="Add the dishes you sell, with prices and a photo. Students can order as soon as you're open.">
      <button class="btn btn-primary" @click="openNew">Add your first item</button>
    </EmptyState>
    <EmptyState v-else-if="!filtered.length" title="No matches" body="Nothing on your menu matches that search." />

    <div v-else class="space-y-6">
      <section v-for="[name, list] in groups" :key="name">
        <h2 class="eyebrow mb-2">{{ name }} <span class="num">· {{ list.length }}</span></h2>
        <ul class="card divide-y divide-line">
          <li v-for="item in list" :key="item.id" class="flex items-center gap-3 p-3 sm:gap-4" :class="!item.is_available && 'bg-paper/70'">
            <FoodImage :src="item.image_url" :alt="item.name" class="h-14 w-14 shrink-0 text-xs sm:h-16 sm:w-16" :class="!item.is_available && 'opacity-50 grayscale'" rounded="rounded-md" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2">
                <p class="font-semibold" :class="!item.is_available && 'text-muted'">{{ item.name }}</p>
                <span v-if="!item.is_available" class="tag bg-paper-2 text-ink-2 ring-1 ring-line">Sold out</span>
              </div>
              <p class="line-clamp-1 text-sm text-muted">{{ item.description || "No description" }}</p>
              <p class="mt-0.5 text-xs text-muted sm:hidden"><span class="num font-semibold text-ink">{{ rwf(item.price) }}</span> · {{ item.sold_30d }} sold</p>
            </div>
            <div class="hidden w-28 text-right sm:block">
              <p class="num font-semibold">{{ rwf(item.price) }}</p>
            </div>
            <div class="hidden w-32 text-right text-sm md:block">
              <p class="num"><span class="font-semibold">{{ item.sold_30d }}</span> <span class="text-muted">sold</span></p>
              <p class="num text-xs text-muted">{{ num(item.revenue_30d) }} RWF / 30d</p>
            </div>
            <button
              class="relative h-6 w-11 shrink-0 rounded-full transition"
              :class="item.is_available ? 'bg-forest' : 'bg-line-2'"
              :disabled="toggling === item.id"
              :title="item.is_available ? 'Available — click to mark sold out' : 'Sold out — click to make available'"
              role="switch"
              :aria-checked="item.is_available"
              @click="toggle(item)"
            >
              <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" :class="item.is_available ? 'left-[22px]' : 'left-0.5'" />
            </button>
            <div class="flex shrink-0 flex-col gap-1 sm:flex-row">
              <button class="btn btn-ghost btn-sm" @click="openEdit(item)">Edit</button>
              <button class="btn btn-ghost btn-sm text-danger" @click="removing = item">Remove</button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <MenuItemModal :open="modalOpen" :item="editing" :categories="categories" @close="modalOpen = false" @saved="onSaved" />
    <ConfirmDialog
      :open="!!removing"
      :title="`Remove ${removing?.name || ''}?`"
      body="It disappears from your menu straight away. Past orders that included it are kept."
      confirm-label="Remove item"
      danger
      :busy="removeBusy"
      @close="removing = null"
      @confirm="confirmRemove"
    />
  </div>
</template>

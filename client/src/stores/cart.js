import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const KEY = "cb-cart-v2";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export const useCartStore = defineStore("cart", () => {
  const saved = load();
  const items = ref(saved?.items || []);
  const vendor = ref(saved?.vendor || null); // { id, shop_name, prep_minutes, opens_at, closes_at, location }
  const open = ref(false);
  const startedAt = ref(saved?.startedAt || null); // for usability measurement (brief §2.10)

  watch(
    [items, vendor, startedAt],
    () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ items: items.value, vendor: vendor.value, startedAt: startedAt.value }));
      } catch {
        /* storage unavailable */
      }
    },
    { deep: true },
  );

  const itemCount = computed(() => items.value.reduce((s, i) => s + i.quantity, 0));
  const subtotal = computed(() => items.value.reduce((s, i) => s + i.price * i.quantity, 0));
  const vendorId = computed(() => vendor.value?.id || null);

  function qtyOf(menuItemId) {
    return items.value.find((i) => i.menu_item_id === menuItemId)?.quantity || 0;
  }

  /** Returns false when the item belongs to a different shop (caller decides whether to replace). */
  function canAdd(v) {
    return !vendor.value || vendor.value.id === v.id || items.value.length === 0;
  }

  function addItem(menuItem, v, qty = 1) {
    if (!canAdd(v)) items.value = [];
    if (!items.value.length) startedAt.value = Date.now();
    vendor.value = {
      id: v.id,
      shop_name: v.shop_name,
      prep_minutes: v.prep_minutes,
      opens_at: v.opens_at,
      closes_at: v.closes_at,
      location: v.location,
    };
    const existing = items.value.find((i) => i.menu_item_id === menuItem.id);
    if (existing) existing.quantity = Math.min(20, existing.quantity + qty);
    else
      items.value.push({
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        image_url: menuItem.image_url || null,
        quantity: qty,
      });
  }

  function setQty(menuItemId, quantity) {
    if (quantity < 1) return removeItem(menuItemId);
    const item = items.value.find((i) => i.menu_item_id === menuItemId);
    if (item) item.quantity = Math.min(20, quantity);
  }

  function removeItem(menuItemId) {
    items.value = items.value.filter((i) => i.menu_item_id !== menuItemId);
    if (!items.value.length) vendor.value = null;
  }

  function clear() {
    items.value = [];
    vendor.value = null;
    startedAt.value = null;
  }

  return { items, vendor, vendorId, open, startedAt, itemCount, subtotal, qtyOf, canAdd, addItem, setQty, removeItem, clear };
});

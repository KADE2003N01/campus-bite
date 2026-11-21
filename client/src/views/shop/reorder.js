import api from "../../composables/useApi.js";
import { useCartStore } from "../../stores/cart.js";

/** Puts a past order's still-available items back in the basket. Returns number of lines skipped. */
export async function reorder(order) {
  const cart = useCartStore();
  const { data } = await api.get(`/vendors/${order.vendor_id}`);
  const menu = new Map(data.items.map((i) => [i.id, i]));
  cart.clear();
  let skipped = 0;
  for (const line of order.items) {
    const m = menu.get(line.menu_item_id);
    if (!m || !m.is_available) {
      skipped++;
      continue;
    }
    cart.addItem(m, data.vendor, line.quantity);
  }
  return { skipped, vendor: data.vendor };
}

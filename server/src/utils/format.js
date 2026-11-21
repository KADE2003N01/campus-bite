/** "Grace Ishimwe" -> "Grace I." */
export function shortName(name = "") {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export function serializeReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    vendor_reply: r.vendor_reply,
    replied_at: r.replied_at,
    created_at: r.created_at,
    author: r.user ? shortName(r.user.name) : "Customer",
    photos: (r.photos || []).map((p) => ({ id: p.id, url: p.url })),
    items: r.order?.items?.map((i) => i.menu_item.name) || [],
    order_code: r.order?.code,
  };
}

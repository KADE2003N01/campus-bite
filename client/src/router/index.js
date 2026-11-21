import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { useShopStore } from "../stores/shop.js";
import HomeView from "../views/shop/HomeView.vue";

const routes = [
  // ── Customer storefront ──
  { path: "/", name: "home", component: HomeView, meta: { customer: true } },
  { path: "/search", name: "search", component: () => import("../views/shop/SearchView.vue"), meta: { customer: true } },
  { path: "/shops/:id", name: "shop", component: () => import("../views/shop/ShopView.vue"), meta: { customer: true } },
  { path: "/checkout", name: "checkout", component: () => import("../views/shop/CheckoutView.vue"), meta: { auth: true, role: "STUDENT" } },
  { path: "/orders", name: "orders", component: () => import("../views/shop/OrdersView.vue"), meta: { auth: true, role: "STUDENT" } },
  { path: "/orders/:id", name: "order", component: () => import("../views/shop/OrderView.vue"), meta: { auth: true, role: "STUDENT" } },
  { path: "/about", name: "about", component: () => import("../views/shop/AboutView.vue"), meta: { customer: true, title: "About" } },
  { path: "/saved", name: "saved", component: () => import("../views/shop/SavedView.vue"), meta: { auth: true, role: "STUDENT" } },
  { path: "/account", name: "account", component: () => import("../views/shop/AccountView.vue"), meta: { auth: true, role: "STUDENT" } },

  // ── Auth ──
  { path: "/login", name: "login", component: () => import("../views/auth/LoginView.vue"), meta: { guest: true, layout: "bare" } },
  { path: "/register", name: "register", component: () => import("../views/auth/RegisterView.vue"), meta: { guest: true, layout: "bare" } },

  // ── Vendor workspace ──
  { path: "/vendor/setup", name: "vendor-setup", component: () => import("../views/vendor/SetupView.vue"), meta: { auth: true, role: "VENDOR", layout: "bare" } },
  {
    path: "/vendor",
    component: () => import("../layouts/VendorLayout.vue"),
    meta: { auth: true, role: "VENDOR", layout: "vendor", needsShop: true },
    children: [
      { path: "", name: "vendor-home", component: () => import("../views/vendor/OverviewView.vue"), meta: { title: "Overview" } },
      { path: "orders", name: "vendor-orders", component: () => import("../views/vendor/OrdersView.vue"), meta: { title: "Orders" } },
      { path: "menu", name: "vendor-menu", component: () => import("../views/vendor/MenuView.vue"), meta: { title: "Menu" } },
      { path: "reviews", name: "vendor-reviews", component: () => import("../views/vendor/ReviewsView.vue"), meta: { title: "Reviews" } },
      { path: "promotions", name: "vendor-promos", component: () => import("../views/vendor/PromosView.vue"), meta: { title: "Promotions" } },
      { path: "settings", name: "vendor-settings", component: () => import("../views/vendor/SettingsView.vue"), meta: { title: "Shop settings" } },
    ],
  },

  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("../views/NotFoundView.vue") },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, top: 90, behavior: "smooth" };
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.guest && auth.isAuthenticated) {
    return auth.isVendor ? { name: "vendor-home" } : { name: "home" };
  }
  if (to.meta.auth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  // Vendors live in their workspace; the storefront is for customers.
  if (to.meta.customer && auth.isVendor && !to.query.preview) {
    return { name: "vendor-home" };
  }
  if (to.meta.role && auth.user?.role !== to.meta.role) {
    return auth.isVendor ? { name: "vendor-home" } : { name: "home" };
  }

  if (auth.isVendor && to.matched.some((r) => r.meta.needsShop)) {
    const shop = useShopStore();
    try {
      const profile = await shop.load();
      if (!profile) return { name: "vendor-setup" };
    } catch {
      /* let the page show its own error */
    }
  }
  if (to.name === "vendor-setup") {
    const shop = useShopStore();
    const profile = await shop.load().catch(() => null);
    if (profile) return { name: "vendor-home" };
  }
});

router.afterEach((to) => {
  const t = to.meta.title;
  document.title = t ? `${t} · CampusBite` : "CampusBite · Order ahead on campus";
});

export default router;

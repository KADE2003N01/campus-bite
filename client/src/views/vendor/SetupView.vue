<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useShopStore } from "../../stores/shop.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";
import { errMsg } from "../../composables/useApi.js";
import Logo from "../../components/ui/Logo.vue";
import ShopForm from "../../components/vendor/ShopForm.vue";

const shop = useShopStore();
const auth = useAuthStore();
const toast = useToast();
const router = useRouter();
const busy = ref(false);

async function create(payload) {
  busy.value = true;
  try {
    await shop.create(payload);
    toast.success("Your shop is set up. Add your first menu items next.");
    router.push("/vendor/menu");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = false;
  }
}

function logout() {
  auth.logout();
  shop.reset();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-paper">
    <header class="flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
      <Logo />
      <button class="btn btn-ghost btn-sm" @click="logout">Log out</button>
    </header>
    <div class="mx-auto grid max-w-5xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-14">
      <div>
        <p class="eyebrow">Step 1 of 2</p>
        <h1 class="display mt-2 text-4xl font-semibold leading-tight">Set up your shop, {{ auth.firstName }}.</h1>
        <p class="mt-4 text-ink-2">This is what students see when they browse. You can change any of it later in Shop settings.</p>
        <ol class="mt-8 space-y-4 border-l border-line-2 pl-5 text-sm">
          <li>
            <p class="font-semibold">Shop details</p>
            <p class="text-muted">Name, location, hours and how long orders usually take.</p>
          </li>
          <li class="text-muted">
            <p class="font-semibold text-ink-2">Menu</p>
            <p>Add dishes with prices and photos.</p>
          </li>
          <li class="text-muted">
            <p class="font-semibold text-ink-2">Open for orders</p>
            <p>Flip the switch in the sidebar when you're ready.</p>
          </li>
        </ol>
      </div>
      <div class="card p-5 sm:p-7">
        <ShopForm submit-label="Create shop" :busy="busy" @submit="create" />
      </div>
    </div>
  </div>
</template>

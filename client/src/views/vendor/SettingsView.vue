<script setup>
import { ref, reactive, watch } from "vue";
import { useShopStore } from "../../stores/shop.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";
import api, { errMsg } from "../../composables/useApi.js";
import ShopForm from "../../components/vendor/ShopForm.vue";
import FoodImage from "../../components/ui/FoodImage.vue";

const shop = useShopStore();
const auth = useAuthStore();
const toast = useToast();

const savingShop = ref(false);
async function saveShop(payload) {
  savingShop.value = true;
  try {
    await shop.update(payload);
    toast.success("Shop details saved");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    savingShop.value = false;
  }
}

// Images
const uploading = ref(null);
async function upload(field, e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) return toast.error("Images must be under 4 MB");
  const fd = new FormData();
  fd.append(field, f);
  uploading.value = field;
  try {
    await shop.uploadImages(fd);
    toast.success(field === "cover" ? "Cover photo updated" : "Logo updated");
  } catch (err) {
    toast.error(errMsg(err));
  } finally {
    uploading.value = null;
  }
}

// Account
const account = reactive({ name: "", phone: "" });
watch(
  () => auth.user,
  (u) => {
    account.name = u?.name || "";
    account.phone = u?.phone || "";
  },
  { immediate: true },
);
const savingAccount = ref(false);
async function saveAccount() {
  savingAccount.value = true;
  try {
    await auth.updateMe({ name: account.name, phone: account.phone || null });
    toast.success("Account updated");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    savingAccount.value = false;
  }
}

const pw = reactive({ current_password: "", new_password: "", confirm: "" });
const savingPw = ref(false);
async function changePassword() {
  if (pw.new_password !== pw.confirm) return toast.error("The new passwords don't match");
  savingPw.value = true;
  try {
    await api.post("/auth/me/password", { current_password: pw.current_password, new_password: pw.new_password });
    Object.assign(pw, { current_password: "", new_password: "", confirm: "" });
    toast.success("Password changed");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    savingPw.value = false;
  }
}
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[220px_1fr]">
    <nav class="hidden text-sm lg:block">
      <div class="sticky top-8 space-y-1">
        <a href="#photos" class="block rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2">Photos</a>
        <a href="#details" class="block rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2">Shop details</a>
        <a href="#account" class="block rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2">Your account</a>
        <a href="#password" class="block rounded-md px-3 py-1.5 text-ink-2 hover:bg-paper-2">Password</a>
      </div>
    </nav>

    <div class="space-y-8">
      <section id="photos" class="card overflow-hidden">
        <div class="relative h-40 bg-paper-2 sm:h-52">
          <img v-if="shop.profile?.cover_url" :src="shop.profile.cover_url" alt="Shop cover" class="h-full w-full object-cover" />
          <div v-else class="flex h-full items-center justify-center text-sm text-muted">No cover photo yet</div>
          <label class="btn btn-outline btn-sm absolute bottom-3 right-3 cursor-pointer">
            {{ uploading === "cover" ? "Uploading…" : shop.profile?.cover_url ? "Change cover" : "Upload cover" }}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" :disabled="!!uploading" @change="upload('cover', $event)" />
          </label>
        </div>
        <div class="flex items-center gap-4 p-4 sm:p-5">
          <FoodImage :src="shop.profile?.image_url" :alt="shop.profile?.shop_name || 'Shop'" class="h-16 w-16 shrink-0 text-base" rounded="rounded-lg" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">Logo</p>
            <p class="text-sm text-muted">Shown next to your name. Square images work best. The cover appears at the top of your shop page.</p>
          </div>
          <label class="btn btn-outline btn-sm cursor-pointer">
            {{ uploading === "logo" ? "Uploading…" : "Upload" }}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" :disabled="!!uploading" @change="upload('logo', $event)" />
          </label>
        </div>
      </section>

      <section id="details" class="card p-5 sm:p-6">
        <h2 class="display text-xl font-semibold">Shop details</h2>
        <p class="mb-5 text-sm text-muted">What customers see on your shop page.</p>
        <ShopForm :initial="shop.profile" :busy="savingShop" submit-label="Save details" @submit="saveShop" />
      </section>

      <section id="account" class="card p-5 sm:p-6">
        <h2 class="display text-xl font-semibold">Your account</h2>
        <p class="mb-5 text-sm text-muted">Signed in as {{ auth.user?.email }}</p>
        <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveAccount">
          <div>
            <label class="label" for="ac-name">Your name</label>
            <input id="ac-name" v-model="account.name" class="field" required maxlength="80" />
          </div>
          <div>
            <label class="label" for="ac-phone">Personal phone</label>
            <input id="ac-phone" v-model="account.phone" class="field" inputmode="tel" placeholder="0788123456" />
          </div>
          <div class="flex justify-end sm:col-span-2">
            <button class="btn btn-primary" :disabled="savingAccount">{{ savingAccount ? "Saving…" : "Save account" }}</button>
          </div>
        </form>
      </section>

      <section id="password" class="card p-5 sm:p-6">
        <h2 class="display mb-5 text-xl font-semibold">Change password</h2>
        <form class="grid gap-4 sm:grid-cols-3" @submit.prevent="changePassword">
          <div>
            <label class="label" for="pw-cur">Current</label>
            <input id="pw-cur" v-model="pw.current_password" type="password" class="field" required autocomplete="current-password" />
          </div>
          <div>
            <label class="label" for="pw-new">New</label>
            <input id="pw-new" v-model="pw.new_password" type="password" class="field" required minlength="6" autocomplete="new-password" />
          </div>
          <div>
            <label class="label" for="pw-con">Repeat new</label>
            <input id="pw-con" v-model="pw.confirm" type="password" class="field" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="flex justify-end sm:col-span-3">
            <button class="btn btn-outline" :disabled="savingPw">{{ savingPw ? "Updating…" : "Update password" }}</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

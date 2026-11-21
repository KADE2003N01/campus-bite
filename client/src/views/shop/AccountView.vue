<script setup>
import { ref } from "vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useAuthStore } from "../../stores/auth.js";
import { useToast } from "../../composables/useToast.js";

const auth = useAuthStore();
const toast = useToast();
const name = ref(auth.user.name);
const phone = ref(auth.user.phone || "");
const saving = ref(false);
const pw = ref({ current_password: "", new_password: "" });
const savingPw = ref(false);

async function save() {
  saving.value = true;
  try {
    await auth.updateMe({ name: name.value, phone: phone.value });
    toast.success("Your name and number are up to date.", "Profile saved");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    saving.value = false;
  }
}

async function changePw() {
  savingPw.value = true;
  try {
    await api.post("/auth/me/password", pw.value);
    pw.value = { current_password: "", new_password: "" };
    toast.success("Use your new password next time you log in.", "Password updated");
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    savingPw.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <h1 class="display text-[2.2rem] font-semibold">Account</h1>
    <p class="mt-1 text-sm text-muted">{{ auth.user.email }} · member since {{ new Date(auth.user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) }}</p>

    <form class="card mt-8 space-y-4 p-6" @submit.prevent="save">
      <h2 class="display text-lg font-semibold">Profile</h2>
      <div>
        <label class="label" for="acc-name">Name</label>
        <input id="acc-name" v-model="name" class="field" required />
      </div>
      <div>
        <label class="label" for="acc-phone">Mobile number</label>
        <input id="acc-phone" v-model="phone" class="field num" inputmode="tel" placeholder="0788123456" />
        <p class="hint">Pre-fills MoMo at checkout and lets the vendor call you if something's wrong.</p>
      </div>
      <button class="btn btn-primary" :disabled="saving">{{ saving ? "Saving…" : "Save changes" }}</button>
    </form>

    <form class="card mt-6 space-y-4 p-6" @submit.prevent="changePw">
      <h2 class="display text-lg font-semibold">Password</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="pw-cur">Current password</label>
          <input id="pw-cur" v-model="pw.current_password" type="password" class="field" autocomplete="current-password" required />
        </div>
        <div>
          <label class="label" for="pw-new">New password</label>
          <input id="pw-new" v-model="pw.new_password" type="password" class="field" minlength="6" autocomplete="new-password" required />
        </div>
      </div>
      <button class="btn btn-outline" :disabled="savingPw">{{ savingPw ? "Updating…" : "Update password" }}</button>
    </form>
  </div>
</template>

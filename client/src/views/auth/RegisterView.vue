<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../../stores/auth.js";
import { errMsg } from "../../composables/useApi.js";
import AuthShell from "./AuthShell.vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const role = ref(route.query.as === "vendor" ? "VENDOR" : "STUDENT");
const form = ref({ name: "", email: "", phone: "", password: "" });
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await auth.register({ ...form.value, phone: form.value.phone || undefined, role: role.value });
    if (role.value === "VENDOR") router.push("/vendor/setup");
    else router.push(route.query.redirect || "/");
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthShell
    :image="role === 'VENDOR' ? 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1400&q=72&auto=format&fit=crop' : 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1400&q=72&auto=format&fit=crop'"
    :quote="role === 'VENDOR' ? 'Half my lunch orders come in before 11 now. I cook to the list instead of guessing.' : 'Cheaper than I expected, and I stopped missing the start of afternoon labs.'"
    :who="role === 'VENDOR' ? 'Diane U., Sweet Tooth Bakery' : 'Kevin N., Civil Engineering, Year 2'"
  >
    <h1 class="display text-[2.1rem] font-semibold">Create your account</h1>

    <div class="mt-6 grid grid-cols-2 rounded-lg border border-line-2 p-1 text-sm" role="radiogroup">
      <button type="button" class="rounded-md py-2 font-semibold transition" :class="role === 'STUDENT' ? 'bg-ink text-paper' : 'text-ink-2'" @click="role = 'STUDENT'">I'm ordering food</button>
      <button type="button" class="rounded-md py-2 font-semibold transition" :class="role === 'VENDOR' ? 'bg-ink text-paper' : 'text-ink-2'" @click="role = 'VENDOR'">I run a food stall</button>
    </div>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="r-name">{{ role === "VENDOR" ? "Your name (owner)" : "Full name" }}</label>
        <input id="r-name" v-model="form.name" class="field" autocomplete="name" required />
      </div>
      <div>
        <label class="label" for="r-email">Email</label>
        <input id="r-email" v-model="form.email" type="email" class="field" autocomplete="email" required />
      </div>
      <div>
        <label class="label" for="r-phone">Mobile number <span class="font-normal text-muted">(optional, used for MoMo and if the vendor needs to reach you)</span></label>
        <input id="r-phone" v-model="form.phone" class="field num" inputmode="tel" placeholder="0788123456" />
      </div>
      <div>
        <label class="label" for="r-pw">Password</label>
        <input id="r-pw" v-model="form.password" type="password" minlength="6" class="field" autocomplete="new-password" required />
        <p class="hint">At least 6 characters.</p>
      </div>
      <p class="rounded-md bg-paper-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
        We only collect what's needed to process orders. Vendors see your name and number only while an order is in progress, and reviews show your first name and initial.
      </p>
      <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
      <button class="btn btn-primary btn-lg w-full" :disabled="busy">
        {{ busy ? "Creating account…" : role === "VENDOR" ? "Continue to shop setup" : "Create account" }}
      </button>
    </form>
    <p class="mt-6 text-sm text-ink-2">Already have an account? <RouterLink :to="{ name: 'login', query: route.query }" class="link">Log in</RouterLink></p>
  </AuthShell>
</template>

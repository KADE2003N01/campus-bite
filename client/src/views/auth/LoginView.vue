<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../../stores/auth.js";
import { errMsg } from "../../composables/useApi.js";
import AuthShell from "./AuthShell.vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    const { user } = await auth.login({ email: email.value, password: password.value });
    const redirect = route.query.redirect;
    if (user.role === "VENDOR") router.push(redirect?.startsWith("/vendor") ? redirect : "/vendor");
    else router.push(redirect && !redirect.startsWith("/vendor") ? redirect : "/");
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    busy.value = false;
  }
}

function demo(which) {
  email.value = which === "vendor" ? "marie@campusbite.test" : "eric@campusbite.test";
  password.value = "password123";
}
</script>

<template>
  <AuthShell
    image="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1400&q=72&auto=format&fit=crop"
    quote="I order the brochettes during my 10 o'clock and they're waiting for me at 11. Game changer during exams."
    who="Grace I., Computer Engineering, Year 3"
  >
    <h1 class="display text-[2.1rem] font-semibold">Welcome back</h1>
    <p class="mt-1 text-sm text-muted">Log in to order, or to run your shop.</p>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="email" type="email" class="field" autocomplete="email" required />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <input id="password" v-model="password" type="password" class="field" autocomplete="current-password" required />
      </div>
      <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
      <button class="btn btn-primary btn-lg w-full" :disabled="busy">{{ busy ? "Logging in…" : "Log in" }}</button>
    </form>

    <p class="mt-6 text-sm text-ink-2">New here? <RouterLink :to="{ name: 'register', query: route.query }" class="link">Create an account</RouterLink></p>

    <div class="mt-10 rounded-lg border border-dashed border-line-3 p-4 text-sm">
      <p class="eyebrow">Demo accounts</p>
      <div class="mt-2 flex gap-2">
        <button type="button" class="btn btn-outline btn-sm flex-1" @click="demo('student')">Student</button>
        <button type="button" class="btn btn-outline btn-sm flex-1" @click="demo('vendor')">Vendor</button>
      </div>
    </div>

    <section class="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-muted" aria-labelledby="disclaimer-title">
      <h2 id="disclaimer-title" class="eyebrow mb-2">Please note</h2>
      <ul class="space-y-1.5">
        <li><strong class="font-semibold text-ink-2">Academic prototype.</strong> Built by Group 5, Year 3 Computer Science, UR-CST, for an e-commerce course. It is not a commercial or official University of Rwanda service.</li>
        <li>
          <strong class="font-semibold text-ink-2">Photos.</strong> Food and venue photos come from
          <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-ink">Unsplash</a>
          and are used under the
          <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-ink">Unsplash License</a>.
          They illustrate dishes and are not photos of the listed vendors' food.
        </li>
        <li><strong class="font-semibold text-ink-2">Sample data.</strong> Shops, people, reviews and orders are fictional demo data. Any resemblance to real people is coincidental.</li>
        <li><strong class="font-semibold text-ink-2">No real payments.</strong> MTN MoMo and Airtel Money are simulated and no money is charged. Those names belong to their owners.</li>
        <li><strong class="font-semibold text-ink-2">Your account.</strong> Don't reuse a password you use elsewhere. We only store what's needed to process orders.</li>
      </ul>
    </section>
  </AuthShell>
</template>

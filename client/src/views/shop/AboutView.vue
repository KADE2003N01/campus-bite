<script setup>
import { ref, onMounted } from "vue";
import api from "../../composables/useApi.js";

const m = ref(null);
onMounted(async () => {
  try {
    m.value = (await api.get("/insights")).data;
  } catch {
    /* metrics are optional on this page */
  }
});

const workflow = [
  ["Vendor", "adds meals, prices and what's available today."],
  ["Student", "browses menus and compares prices across campus."],
  ["Student", "chooses quantities and a pickup time, then submits the order."],
  ["Vendor", "sees the order straight away and updates its status."],
  ["Student", "collects the meal; the vendor marks it completed."],
];

const decisions = [
  {
    need: "Students have a few minutes between lectures.",
    built: "Ordering takes three steps: pick a shop, add food, choose a time. The basket remembers itself if you get interrupted.",
  },
  {
    need: "Prices are hard to find before you get to a stall.",
    built: "Every menu is public without an account, and Compare dishes puts the same meal from different shops side by side.",
  },
  {
    need: "Students need to know when to walk over.",
    built: "Each status says what happens next in plain words, the page updates itself, and a pickup code replaces names shouted across a queue.",
  },
  {
    need: "Small vendors are busy cooking, not looking at screens.",
    built: "New orders get a badge, a count in the browser tab, and an optional chime. One button moves an order to the next step.",
  },
  {
    need: "Lunch rush crowds the counter.",
    built: "Pickup is booked in 10-minute slots with a cap the vendor sets, and vendors can pause orders with one switch.",
  },
  {
    need: "Menus go out of date.",
    built: "Vendors mark a dish sold out in one tap; students can't order it, and the menu still shows it so nobody wonders where it went.",
  },
  {
    need: "Many students use phones with small screens.",
    built: "Every page is designed for a 375px phone first, buttons are at least 44px tall, text meets WCAG AA contrast, and motion is reduced if your phone asks for it.",
  },
];

const fmtSecs = (s) => (s == null ? "—" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
    <p class="eyebrow">About the project</p>
    <h1 class="display mt-2 text-[2.4rem] font-semibold leading-tight sm:text-5xl">Pre-ordering built around how students and vendors actually work</h1>
    <p class="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
      CampusBite connects students at UR-CST with food shops in and around campus. Students view menus, compare prices and pre-order for a pickup time.
      Vendors publish meals and manage orders from a simple dashboard. Version 1 is pickup only.
    </p>

    <section class="mt-14">
      <h2 class="display text-2xl font-semibold">How it works</h2>
      <ol class="mt-5 divide-y divide-line border-y border-line">
        <li v-for="(w, i) in workflow" :key="i" class="flex gap-5 py-4">
          <span class="font-mono text-sm text-muted">0{{ i + 1 }}</span>
          <p><strong class="font-semibold">{{ w[0] }}</strong> {{ w[1] }}</p>
        </li>
      </ol>
      <p class="mt-4 text-sm text-muted">Order status: Submitted → Accepted → Preparing → Ready for pickup → Completed, or Cancelled.</p>
    </section>

    <section class="mt-14">
      <h2 class="display text-2xl font-semibold">Human-centred design</h2>
      <p class="mt-2 max-w-2xl text-ink-2">
        We start from the people using it: a student with ten minutes between classes, and a vendor with both hands busy at a charcoal grill.
        Each feature answers a specific need.
      </p>
      <div class="mt-6 overflow-hidden rounded-xl border border-line">
        <div class="hidden grid-cols-2 bg-paper-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted sm:grid">
          <span>The need</span><span>What we built</span>
        </div>
        <div v-for="d in decisions" :key="d.need" class="grid gap-1 border-t border-line bg-card px-5 py-4 first:border-t-0 sm:grid-cols-2 sm:gap-6 sm:first:border-t">
          <p class="font-semibold">{{ d.need }}</p>
          <p class="text-ink-2">{{ d.built }}</p>
        </div>
      </div>
    </section>

    <section class="mt-14">
      <h2 class="display text-2xl font-semibold">How we evaluate it</h2>
      <p class="mt-2 max-w-2xl text-ink-2">
        The proposal asks whether people can order without help, how long ordering takes, and how easy they find it.
        After each order, students get one optional question. The numbers below are live and anonymous.
      </p>
      <div v-if="m" class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="card p-5">
          <p class="eyebrow">Typical time to order</p>
          <p class="num display mt-2 text-3xl font-semibold">{{ fmtSecs(m.checkout.median_seconds) }}</p>
          <p class="mt-1 text-sm text-muted">{{ m.checkout.under_60s }}% done in under a minute · {{ m.checkout.samples }} orders</p>
        </div>
        <div class="card p-5">
          <p class="eyebrow">Found ordering easy</p>
          <p class="num display mt-2 text-3xl font-semibold">{{ m.ease.found_it_easy ?? "—" }}%</p>
          <p class="mt-1 text-sm text-muted">rated 4 or 5 out of 5 · {{ m.ease.responses }} answers</p>
        </div>
        <div class="card p-5">
          <p class="eyebrow">Orders completed</p>
          <p class="num display mt-2 text-3xl font-semibold">{{ m.last30.completion_rate ?? "—" }}%</p>
          <p class="mt-1 text-sm text-muted">{{ m.last30.completed }} picked up in the last 30 days</p>
        </div>
      </div>
      <p class="mt-3 text-xs text-muted">While we're in pilot, these figures include the demo data loaded into the prototype.</p>
    </section>

    <section class="mt-14 grid gap-10 sm:grid-cols-2">
      <div>
        <h2 class="display text-2xl font-semibold">Your data</h2>
        <ul class="mt-4 list-disc space-y-2 pl-5 text-ink-2">
          <li>We ask only for your name, email and password. A phone number is optional.</li>
          <li>Vendors see your name and number only while your order is in progress.</li>
          <li>Reviews show your first name and initial, never your email.</li>
          <li>Only a shop's owner can change its menu or orders.</li>
        </ul>
      </div>
      <div>
        <h2 class="display text-2xl font-semibold">Not in version 1</h2>
        <ul class="mt-4 list-disc space-y-2 pl-5 text-ink-2">
          <li>Delivery and driver tracking</li>
          <li>Advanced demand prediction</li>
          <li>Multiple campuses</li>
        </ul>
        <p class="mt-3 text-sm text-muted">Mobile money is simulated in this prototype.</p>
      </div>
    </section>

    <p class="mt-16 border-t border-line pt-6 text-sm text-muted">
      University of Rwanda, UR-CST · Year 3 Computer Science · E-commerce project, Group 5
    </p>
  </div>
</template>

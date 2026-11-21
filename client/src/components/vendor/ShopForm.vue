<script setup>
import { reactive, watch } from "vue";

const props = defineProps({
  initial: { type: Object, default: null },
  submitLabel: { type: String, default: "Save" },
  busy: Boolean,
});
const emit = defineEmits(["submit"]);

const CUISINES = ["Rwandan", "East African", "Snacks", "Grill", "Burgers", "Pizza", "Asian", "Healthy", "Bakery & Coffee", "Juices & Breakfast"];

const form = reactive({
  shop_name: "",
  cuisine: "",
  description: "",
  location: "",
  phone: "",
  opens_at: "07:00",
  closes_at: "20:00",
  prep_minutes: 15,
  slot_capacity: 8,
});

watch(
  () => props.initial,
  (v) => {
    if (!v) return;
    for (const k of Object.keys(form)) if (v[k] != null) form[k] = v[k];
  },
  { immediate: true },
);

function submit() {
  emit("submit", { ...form, prep_minutes: Number(form.prep_minutes), slot_capacity: Number(form.slot_capacity) });
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class="label" for="sf-name">Shop name</label>
        <input id="sf-name" v-model="form.shop_name" class="field" required maxlength="80" placeholder="e.g. Mama Marie's Kitchen" />
      </div>
      <div>
        <label class="label" for="sf-cuisine">What do you mainly sell?</label>
        <input id="sf-cuisine" v-model="form.cuisine" class="field" list="sf-cuisines" maxlength="40" placeholder="Rwandan, Snacks, Coffee…" />
        <datalist id="sf-cuisines"><option v-for="c in CUISINES" :key="c" :value="c" /></datalist>
      </div>
      <div>
        <label class="label" for="sf-phone">Shop phone</label>
        <input id="sf-phone" v-model="form.phone" class="field" required inputmode="tel" maxlength="20" placeholder="0788 123 456" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="sf-loc">Where on campus?</label>
        <input id="sf-loc" v-model="form.location" class="field" required maxlength="120" placeholder="e.g. Behind the Main Library" />
        <p class="hint">Customers use this to find you at pickup. Be specific.</p>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="sf-desc">Short description</label>
        <textarea id="sf-desc" v-model="form.description" class="field" rows="3" maxlength="500" placeholder="What you're known for, specials, anything customers should know." />
      </div>
      <div>
        <label class="label" for="sf-open">Opens</label>
        <input id="sf-open" v-model="form.opens_at" type="time" class="field" required />
      </div>
      <div>
        <label class="label" for="sf-close">Closes</label>
        <input id="sf-close" v-model="form.closes_at" type="time" class="field" required />
      </div>
      <div>
        <label class="label" for="sf-prep">Typical prep time (minutes)</label>
        <input id="sf-prep" v-model="form.prep_minutes" type="number" min="5" max="120" class="field num" required />
        <p class="hint">Customers can't pick a pickup time sooner than this.</p>
      </div>
      <div>
        <label class="label" for="sf-cap">Orders per 10-minute pickup slot</label>
        <input id="sf-cap" v-model="form.slot_capacity" type="number" min="1" max="50" class="field num" required />
        <p class="hint">When a slot is full, students pick the next one. Keeps the lunch rush manageable.</p>
      </div>
    </div>
    <div class="flex justify-end pt-2">
      <button class="btn btn-primary" :disabled="busy">{{ busy ? "Saving…" : submitLabel }}</button>
    </div>
  </form>
</template>

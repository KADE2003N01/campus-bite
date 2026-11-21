<script setup>
import { reactive, ref, watch, computed } from "vue";
import Modal from "../ui/Modal.vue";
import FoodImage from "../ui/FoodImage.vue";
import api, { errMsg } from "../../composables/useApi.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps({ open: Boolean, item: Object, categories: Array });
const emit = defineEmits(["close", "saved"]);
const toast = useToast();

const form = reactive({ name: "", description: "", category: "", price: "" });
const file = ref(null);
const preview = ref(null);
const removeImage = ref(false);
const busy = ref(false);
const fileInput = ref(null);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    form.name = props.item?.name || "";
    form.description = props.item?.description || "";
    form.category = props.item?.category || "";
    form.price = props.item?.price ?? "";
    file.value = null;
    preview.value = null;
    removeImage.value = false;
  },
);

const shownImage = computed(() => preview.value || (removeImage.value ? null : props.item?.image_url));

function pickFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) return toast.error("Choose a photo under 4 MB.", "Photo too large");
  file.value = f;
  removeImage.value = false;
  preview.value = URL.createObjectURL(f);
}

function clearImage() {
  file.value = null;
  preview.value = null;
  removeImage.value = true;
  if (fileInput.value) fileInput.value.value = "";
}

async function save() {
  const price = Number(form.price);
  if (!Number.isInteger(price) || price <= 0) return toast.error("Enter the price as a whole number of RWF, e.g. 1500.", "Check the price");
  const fd = new FormData();
  fd.append("name", form.name);
  fd.append("description", form.description);
  fd.append("category", form.category);
  fd.append("price", String(price));
  if (file.value) fd.append("image", file.value);
  else if (removeImage.value && props.item) fd.append("remove_image", "1");
  busy.value = true;
  try {
    const { data } = props.item ? await api.put(`/vendor/menu/${props.item.id}`, fd) : await api.post("/vendor/menu", fd);
    toast.success(props.item ? "Item updated" : `${data.item.name} added to your menu`);
    emit("saved", data.item);
  } catch (e) {
    toast.error(errMsg(e));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="item ? 'Edit item' : 'New menu item'" @close="emit('close')">
    <form id="menu-item-form" class="space-y-4" @submit.prevent="save">
      <div class="flex gap-4">
        <FoodImage :src="shownImage" :alt="form.name || 'New item'" class="h-24 w-24 shrink-0 text-sm" />
        <div class="flex flex-col justify-center gap-2 text-sm">
          <label class="btn btn-outline btn-sm w-fit cursor-pointer">
            {{ shownImage ? "Replace photo" : "Add photo" }}
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickFile" />
          </label>
          <button v-if="shownImage" type="button" class="w-fit text-xs font-semibold text-danger hover:underline" @click="clearImage">Remove photo</button>
          <p class="text-xs text-muted">JPG, PNG or WebP, up to 4 MB. Items with photos sell noticeably better.</p>
        </div>
      </div>
      <div>
        <label class="label" for="mi-name">Name</label>
        <input id="mi-name" v-model="form.name" class="field" required maxlength="80" placeholder="e.g. Beef Brochettes (2)" />
      </div>
      <div>
        <label class="label" for="mi-desc">Description</label>
        <textarea id="mi-desc" v-model="form.description" class="field" rows="2" maxlength="300" placeholder="What's in it, portion size, spice level" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="mi-cat">Category</label>
          <input id="mi-cat" v-model="form.category" class="field" list="mi-cats" maxlength="30" placeholder="Plates, Drinks…" />
          <datalist id="mi-cats"><option v-for="c in categories" :key="c" :value="c" /></datalist>
        </div>
        <div>
          <label class="label" for="mi-price">Price (RWF)</label>
          <input id="mi-price" v-model="form.price" class="field num" type="number" min="1" step="1" required inputmode="numeric" placeholder="1500" />
        </div>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" form="menu-item-form" :disabled="busy">{{ busy ? "Saving…" : item ? "Save changes" : "Add to menu" }}</button>
    </template>
  </Modal>
</template>

// The logged-in vendor's own shop (vendor workspace).
import { ref } from "vue";
import { defineStore } from "pinia";
import api from "../composables/useApi.js";

export const useShopStore = defineStore("shop", () => {
  const profile = ref(null);
  const loaded = ref(false);
  const newOrders = ref(0);

  async function load(force = false) {
    if (loaded.value && !force) return profile.value;
    const { data } = await api.get("/vendor/profile");
    profile.value = data.vendor;
    loaded.value = true;
    return profile.value;
  }

  async function create(payload) {
    const { data } = await api.post("/vendor/profile", payload);
    profile.value = data.vendor;
    return data.vendor;
  }

  async function update(payload) {
    const { data } = await api.put("/vendor/profile", payload);
    profile.value = data.vendor;
    return data.vendor;
  }

  async function uploadImages(formData) {
    const { data } = await api.post("/vendor/profile/images", formData);
    profile.value = data.vendor;
    return data.vendor;
  }

  async function toggleOpen() {
    const { data } = await api.patch("/vendor/status");
    profile.value = data.vendor;
    return data.vendor;
  }

  function reset() {
    profile.value = null;
    loaded.value = false;
    newOrders.value = 0;
  }

  return { profile, loaded, newOrders, load, create, update, uploadImages, toggleOpen, reset };
});

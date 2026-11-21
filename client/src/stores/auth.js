import { ref, computed } from "vue";
import { defineStore } from "pinia";
import api from "../composables/useApi.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const token = ref(localStorage.getItem("token"));

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isVendor = computed(() => user.value?.role === "VENDOR");
  const isStudent = computed(() => user.value?.role === "STUDENT");
  const firstName = computed(() => user.value?.name?.split(" ")[0] || "");

  function setSession(data) {
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    setSession(data);
    return data;
  }

  async function login(payload) {
    const { data } = await api.post("/auth/login", payload);
    setSession(data);
    return data;
  }

  async function fetchMe() {
    if (!token.value) return;
    try {
      const { data } = await api.get("/auth/me");
      user.value = data.user;
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 404) logout();
    }
  }

  async function updateMe(payload) {
    const { data } = await api.patch("/auth/me", payload);
    user.value = data.user;
    return data.user;
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem("token");
  }

  return { user, token, isAuthenticated, isVendor, isStudent, firstName, register, login, logout, fetchMe, updateMe };
});

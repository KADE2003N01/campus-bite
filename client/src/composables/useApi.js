import axios from "axios";
import { API_BASE_URL } from "../lib/urls.js";

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem("token");
    return Promise.reject(error);
  },
);

export function useApi() {
  return api;
}

export function errMsg(e, fallback = "Something went wrong. Try again.") {
  if (!e?.response) return "Can't reach the server. Check your connection.";
  return e.response.data?.error || fallback;
}

export default api;

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const API = process.env.API_URL || "http://localhost:3001";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: { target: "es2022" },
  server: {
    port: Number(process.env.CLIENT_PORT) || 5173,
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/uploads": { target: API, changeOrigin: true },
    },
  },
});

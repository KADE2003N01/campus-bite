import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth.js";
// Fonts are bundled (no Google Fonts request): works offline and keeps visitors private
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());

await useAuthStore().fetchMe();

app.use(router);
await router.isReady();
app.mount("#app");

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth.js";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());

await useAuthStore().fetchMe();

app.use(router);
await router.isReady();
app.mount("#app");

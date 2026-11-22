// Light / dark theme. Starts from the device setting, then remembers the user's choice.
import { ref } from "vue";

const KEY = "cb-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const isDark = ref(document.documentElement.classList.contains("dark"));

function apply(dark) {
  isDark.value = dark;
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1c1c" : "#FFFFE3");
}

// follow the device while the user hasn't picked a theme themselves
media.addEventListener("change", (e) => {
  if (!stored()) apply(e.matches);
});
apply(isDark.value);

export function toggleTheme() {
  const next = !isDark.value;
  apply(next);
  try {
    localStorage.setItem(KEY, next ? "dark" : "light");
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

export function useTheme() {
  return { isDark, toggleTheme };
}

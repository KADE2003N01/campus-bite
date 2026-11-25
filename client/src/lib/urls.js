// Set VITE_API_URL to the deployed API origin plus /api/v1, for example
// https://campusbite-api.onrender.com/api/v1. Leave it unset for local Vite proxying.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const apiOrigin = API_BASE_URL.startsWith("http")
  ? new URL(API_BASE_URL).origin
  : "";

export function assetUrl(url) {
  if (!url || /^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  return apiOrigin ? new URL(url, apiOrigin).href : url;
}

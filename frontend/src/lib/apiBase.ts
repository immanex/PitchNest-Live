/** Canonical backend origin for hosted API calls and server-served media. */
export const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://pitchnestv1.onrender.com"
).replace(/\/+$/, "");

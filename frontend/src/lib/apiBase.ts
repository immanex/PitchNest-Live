/** Canonical backend origin for hosted API calls and server-served media. */
function resolveApiOrigin(): string {
  const raw = (
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "https://pitchnestv1.onrender.com"
  ).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("VITE_API_URL must be a valid absolute URL.");
  }

  const local = ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "VITE_API_URL must be an HTTPS origin with no credentials, path, query, or fragment.",
    );
  }
  return url.origin;
}

export const API_BASE_URL = resolveApiOrigin();

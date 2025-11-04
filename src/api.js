// src/api.js


export async function apiRequest(endpoint, method = "GET", body = null) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = user?.token;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const base = import.meta.env.VITE_API_BASE || ""; // if empty, rely on same-origin/proxy
  const url = `${base}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

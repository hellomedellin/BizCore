import axios from "axios";

// VITE_API_URL is set at build time on Railway (e.g. https://api-xxx.railway.app)
// Falls back to /api/v1 for local dev (Vite proxy forwards to localhost:3001)
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// Set business header for employee multi-business context
export function setBusinessHeader(businessId: string | null) {
  if (businessId) {
    api.defaults.headers.common["X-Business-Id"] = businessId;
  } else {
    delete api.defaults.headers.common["X-Business-Id"];
  }
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

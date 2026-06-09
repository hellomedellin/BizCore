import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Inject Clerk JWT on every request
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
      window.location.href = "/sign-in";
    }
    return Promise.reject(err);
  }
);

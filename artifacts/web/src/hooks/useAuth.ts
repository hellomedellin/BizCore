import { useAuth as useClerkAuth } from "@clerk/react";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api";

export function useAuthToken() {
  const { getToken } = useClerkAuth();

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!cancelled) setAuthToken(token);
    });
    // Refresh token every 50 seconds (Clerk tokens expire in 60s)
    const interval = setInterval(() => {
      getToken().then((token) => {
        if (!cancelled) setAuthToken(token);
      });
    }, 50_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getToken]);
}

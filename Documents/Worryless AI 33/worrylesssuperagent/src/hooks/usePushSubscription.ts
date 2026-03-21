import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const BASE_URL = import.meta.env.VITE_API_URL as string;

// From RESEARCH.md Pitfall 4 — MUST use this to avoid DOMException: Invalid applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function usePushSubscription(userId: string | null) {
  const { token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // On mount: check if subscription already exists
  useEffect(() => {
    if (!userId || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setIsSubscribed(true);
      })
      .catch(() => {
        // Ignore — may be HTTP dev environment where Push API is unavailable
      });
  }, [userId]);

  const subscribe = async () => {
    if (!userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Push API not available (HTTP, old browser) — fail silently
      return;
    }

    setIsLoading(true);
    try {
      // Request permission if not already granted
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          // Permission denied — return gracefully, do NOT throw
          return;
        }
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Serialize keys using platform API pattern from RESEARCH.md
      const p256dh = btoa(
        String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))
      );
      const auth = btoa(
        String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))
      );

      await api.post(
        '/api/push-subscriptions',
        { endpoint: sub.endpoint, keys: { p256dh, auth } },
        { token },
      );

      setIsSubscribed(true);
    } catch (err) {
      // Fail silently — expected on HTTP dev environment
      console.warn("[usePushSubscription] subscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!userId) return;
    if (!("serviceWorker" in navigator)) return;

    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        // api.ts delete does not support a body — use raw fetch with DELETE + body
        await fetch(`${BASE_URL}/api/push-subscriptions`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.warn("[usePushSubscription] unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return { isSubscribed, isLoading, subscribe, unsubscribe };
}

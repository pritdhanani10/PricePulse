/**
 * Universal Cross-Device Notification Client
 * Supports Windows Desktop (Chrome, Edge, Firefox), Mobile Phones (Android Chrome/Firefox, iOS PWA), and macOS.
 */

import { soundService } from "./sound";
import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface DeviceNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  vibrate?: number[];
  data?: any;
}

class DeviceNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isRegistering = false;

  public isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public isServiceWorkerSupported(): boolean {
    return typeof window !== "undefined" && "serviceWorker" in navigator;
  }

  public isPushSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  /**
   * Registers or retrieves the root Service Worker (/sw.js)
   */
  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isServiceWorkerSupported()) return null;
    if (this.swRegistration) return this.swRegistration;
    if (this.isRegistering) return null;

    this.isRegistering = true;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      this.swRegistration = reg;
      logger.log("Service Worker registered successfully:", reg.scope);
      return reg;
    } catch (err) {
      console.warn("Service worker registration failed:", err);
      return null;
    } finally {
      this.isRegistering = false;
    }
  }

  /**
   * Prompts the user for notification permissions and registers Service Worker + Web Push
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const perm = await Notification.requestPermission();
      const granted = perm === "granted";

      if (granted) {
        await this.initServiceWorker();
        await this.syncPushSubscription();
      }

      return granted;
    } catch (e) {
      console.warn("Notification permission request error:", e);
      return false;
    }
  }

  /**
   * Subscribes the current device to Web Push notifications via VAPID
   */
  public async syncPushSubscription(): Promise<boolean> {
    if (!this.isPushSupported() || Notification.permission !== "granted") {
      return false;
    }

    try {
      const reg = await this.initServiceWorker();
      if (!reg) return false;

      // 1. Fetch backend VAPID public key
      const { public_key } = await api.getVapidPublicKey();
      if (!public_key) return false;

      // 2. Check existing subscription or create new
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(public_key);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as unknown as BufferSource,
        });
      }

      // 3. Sync subscription to backend
      const rawSub = sub.toJSON();
      if (rawSub.endpoint && rawSub.keys?.p256dh && rawSub.keys?.auth) {
        await api.savePushSubscription({
          endpoint: rawSub.endpoint,
          keys: {
            p256dh: rawSub.keys.p256dh,
            auth: rawSub.keys.auth,
          },
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Push subscription sync failed:", e);
      return false;
    }
  }

  /**
   * Displays an immediate native system notification across Windows, Android Phone, iOS PWA, or Mac.
   * Handles mobile browser constructor limitations by routing through ServiceWorkerRegistration.showNotification().
   */
  public async displayNotification(
    title: string,
    options: DeviceNotificationOptions = {}
  ): Promise<void> {
    // 1. Always synthesize Web Audio chime sound
    soundService.playAlertTriggerSound();

    // 2. Mobile haptic vibration if supported
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 200]);
      } catch (_) {}
    }

    if (!this.isSupported() || Notification.permission !== "granted") {
      return;
    }

    const defaultIcon = "/favicon.svg";
    const defaultBadge = "/favicon.svg";

    const notifOptions: NotificationOptions = {
      body: options.body || "Stock Market Price Trigger Hit",
      icon: options.icon || defaultIcon,
      badge: options.badge || defaultBadge,
      tag: options.tag || `pricepulse-${Date.now()}`,
      data: {
        url: options.url || "/alerts/history",
        ...(options.data || {}),
      },
      requireInteraction: true,
    };

    // Primary: Service Worker showNotification (Universally supported on Windows Desktop, Android Phone, iOS PWA, macOS)
    try {
      if (this.isServiceWorkerSupported()) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, notifOptions);
          return;
        }
      }
    } catch (swErr) {
      console.warn("SW showNotification fallback triggered:", swErr);
    }

    // Secondary: Post message to active SW
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          options: notifOptions,
        });
        return;
      }
    } catch (_) {}

    // Tertiary Fallback: Traditional window.Notification (legacy desktop browsers)
    try {
      new Notification(title, notifOptions);
    } catch (legacyErr) {
      console.warn("Standard notification failed:", legacyErr);
    }
  }
}

const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DeviceNotification]", ...args);
    }
  },
};

export const deviceNotificationService = new DeviceNotificationService();

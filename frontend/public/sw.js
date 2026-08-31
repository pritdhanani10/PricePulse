// PricePulse - Universal Service Worker for Cross-Device Web Notifications & Web Push
// Supports Windows Desktop (Chrome/Edge/Firefox), Android (Chrome/Firefox/Samsung Internet), iOS Safari PWA, and macOS

const CACHE_NAME = "pricepulse-sw-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications (backgrounded tab, locked phone, or minimized browser)
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      if (event.data) {
        try {
          data = event.data.json();
        } catch (_) {
          data = { title: "PricePulse Alert", body: event.data.text() };
        }
      }

      const title = data.title || "⚡ PricePulse Market Alert";
      const options = {
        body: data.body || "A market condition or breakout target was reached.",
        icon: data.icon || "/favicon.svg",
        badge: data.badge || "/favicon.svg",
        tag: data.tag || `pricepulse-alert-${Date.now()}`,
        data: {
          url: data.url || "/alerts/history",
          customData: data.data || {},
        },
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        renotify: true,
        actions: [
          { action: "open_app", title: "📈 View Alert" },
          { action: "dismiss", title: "Dismiss" },
        ],
      };

      return self.registration.showNotification(title, options);
    })()
  );
});

// Handle user clicking on the notification on Windows Action Center, Android, or iOS
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/alerts/history";

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If an existing tab is open, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }

      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Handle in-page message requests to display notifications (resolves Mobile Chrome / iOS constructor blocks)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || "PricePulse Alert", {
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        ...options,
      })
    );
  }
});

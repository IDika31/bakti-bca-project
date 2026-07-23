/// Admin Service Worker — handles background notifications for the PWA.
/// Receives order events from the client via postMessage and shows system
/// notifications so the admin/cashier never misses a new order even when
/// the app is in the background.

const SW_VERSION = "1.0.0";

// ─── Install / Activate ─────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Message from client ────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "NEW_ORDER") {
    const { orderNumber, orderId } = data;
    self.registration.showNotification("Pesanan baru masuk!", {
      body: `#${orderNumber}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `order-${orderId || orderNumber}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 120, 400, 120, 700],
      data: { orderId, orderNumber, url: `/admin/orders?highlight=${orderId}` },
    });
  }
});

// ─── Notification click ─────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/admin/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing admin tab if one is open.
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // No existing tab — open a new one.
      return self.clients.openWindow(url);
    })
  );
});

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kasir.admin",
  appName: "Admin Kasir",
  // Point the WebView at the live admin URL.
  // Change this to your deployed URL (e.g. https://your-domain.com/admin).
  server: {
    url: "http://10.0.2.2:3000/admin",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    ForegroundService: {
      smallIcon: "ic_stat_restaurant",
      largeIcon: "ic_launcher",
    },
  },
};

export default config;

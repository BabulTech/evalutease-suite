import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Jancho native shell (Capacitor).
 *
 * This app is a TanStack Start (SSR) app with server functions, so the native
 * shell loads the DEPLOYED web app rather than a bundled static build. That
 * keeps AI generation, plan management, and all server-side logic working.
 *
 * - Production: server.url points at the live Vercel deployment.
 * - Local dev:  set CAP_SERVER_URL to your machine's LAN IP, e.g.
 *               CAP_SERVER_URL=http://192.168.1.50:8080 npx cap sync
 *               (run `npm run dev` so the phone can reach it over WiFi).
 *
 * `webDir` is a tiny offline fallback page shown if the device has no network
 * on first launch.
 */
// Must be the CANONICAL production domain. If this points at a URL that
// 301-redirects to a different origin (e.g. the raw *.vercel.app redirecting to
// the custom domain), the Capacitor WebView treats that cross-origin redirect
// as an external link and kicks the user out to the system browser on launch.
const SERVER_URL = process.env.CAP_SERVER_URL ?? "https://jancho.babultech.com";

const config: CapacitorConfig = {
  appId: "com.babultech.jancho",
  appName: "Jancho",
  webDir: "capacitor-shell",
  server: {
    url: SERVER_URL,
    cleartext: SERVER_URL.startsWith("http://"), // allow http only for LAN dev
    androidScheme: "https",
    // Keep navigation to these hosts INSIDE the WebView instead of bouncing to
    // the system browser (covers the raw-vercel → custom-domain redirect path).
    allowNavigation: ["jancho.babultech.com", "*.babultech.com", "evalutease-suite.vercel.app"],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Native splash stays up until our React SplashScreen component calls
      // .hide() (see src/components/SplashScreen.tsx). High upper bound so
      // it never flashes the white-screen-of-death on slow devices.
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0b1220",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

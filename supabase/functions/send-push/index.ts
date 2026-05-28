// @ts-nocheck — Deno runtime
//
// Sends a push notification to every active device of a user, via FCM v1.
// Called by the notifications-insert trigger (or directly via Database Webhook).
//
// Env (Supabase Secrets):
//   FCM_PROJECT_ID         Firebase project id (string)
//   FCM_SERVICE_ACCOUNT    Full service-account JSON (string, one line)
//   SUPABASE_URL           (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided)
//
// Request body:
//   { user_id: UUID, title: string, body?: string, link?: string, type?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Cached OAuth access token (FCM tokens last 1h) ──────────
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM header/footer and whitespace
  const pkcs8 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  if (!FCM_SERVICE_ACCOUNT_RAW) {
    throw new Error("FCM_SERVICE_ACCOUNT secret not configured");
  }
  const sa = JSON.parse(FCM_SERVICE_ACCOUNT_RAW);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const key = await importPrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sigBuf)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to exchange JWT for access token: ${res.status} ${text}`);
  }
  const json = await res.json();
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function sendToToken(
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  link: string,
  type: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const message = {
    message: {
      token: deviceToken,
      notification: { title, body },
      data: { link: link ?? "/", type: type ?? "info" },
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "default",
          click_action: "OPEN_APP",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default", "content-available": 1 },
        },
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT_RAW) {
      // Fail soft so the trigger doesn't block notifications when push isn't configured yet.
      return new Response(JSON.stringify({ skipped: "FCM not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, title, body, link, type } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up active tokens for this user
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("token, platform")
      .eq("user_id", user_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subs?.length) {
      return new Response(JSON.stringify({ skipped: "no subscriptions" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    const results = await Promise.all(
      subs.map((s) =>
        sendToToken(accessToken, s.token, title, body ?? "", link ?? "/", type ?? "info"),
      ),
    );

    // Prune invalid/expired tokens (HTTP 404 or specific FCM errors)
    const invalid = results
      .map((r, i) => ({ r, token: subs[i].token }))
      .filter((x) => x.r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(x.r.text));
    if (invalid.length > 0) {
      await admin
        .from("push_subscriptions")
        .delete()
        .in("token", invalid.map((x) => x.token));
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.ok).length, total: subs.length, pruned: invalid.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

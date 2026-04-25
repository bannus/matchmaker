// Edge Function: unsubscribe (RFC 8058 / RFC 2369 endpoint)
//
// Mail clients like Gmail and Apple Mail surface a native unsubscribe button
// driven by the `List-Unsubscribe` header. Per RFC 8058, the HTTPS endpoint
// MUST act on POST only — GET requests are common from link-checkers, security
// scanners, and pre-fetchers, so honoring them on GET would let crawlers
// silently unsubscribe users.
//
// This function:
//   - Returns 405 on GET / HEAD / anything that isn't POST.
//   - Verifies an HMAC-signed token (signed by send-notification-email).
//   - Flips profiles.email_prefs[type] to false via the service-role client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeRequiredEnv } from "../_shared/env.ts";
import {
  verifyUnsubscribeToken,
  type UnsubType,
} from "../send-notification-email/unsubscribe-token.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const url = new URL(req.url);
  // Token may arrive as ?token=... (query) or "List-Unsubscribe=One-Click" body.
  const token =
    url.searchParams.get("token") ??
    (await readTokenFromBody(req));

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const unsubSecret = normalizeRequiredEnv(
    Deno.env.get("UNSUBSCRIBE_SECRET"),
  );
  if (!unsubSecret) {
    console.error("Missing UNSUBSCRIBE_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }
  const payload = await verifyUnsubscribeToken(token, unsubSecret);
  if (!payload) {
    return new Response("Invalid token", { status: 401 });
  }

  const supabaseUrl = normalizeRequiredEnv(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = normalizeRequiredEnv(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read-modify-write the jsonb pref. We don't use jsonb_set in SQL because
  // PostgREST .update with a function call is awkward; instead we fetch the
  // current map and write it back. Concurrent writes to the same field are
  // last-write-wins, which is acceptable for an unsubscribe action.
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("email_prefs")
    .eq("id", payload.uid)
    .maybeSingle<{ email_prefs: Record<string, boolean> | null }>();

  if (pErr) {
    console.error("Failed to load profile", pErr);
    return new Response("DB error", { status: 500 });
  }
  if (!profile) {
    return new Response("Unknown user", { status: 404 });
  }

  const next: Record<string, boolean> = {
    match_proposed: true,
    match_confirmed: true,
    match_cancelled: true,
    match_declined: true,
    ...(profile.email_prefs ?? {}),
  };
  next[payload.type as UnsubType] = false;

  const { error: uErr } = await supabase
    .from("profiles")
    .update({ email_prefs: next })
    .eq("id", payload.uid);

  if (uErr) {
    console.error("Failed to update email_prefs", uErr);
    return new Response("DB error", { status: 500 });
  }

  return new Response("Unsubscribed", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
});

async function readTokenFromBody(req: Request): Promise<string | null> {
  const contentType = req.headers.get("Content-Type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      return params.get("token");
    }
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { token?: string };
      return body.token ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

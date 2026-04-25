// Edge Function: send-notification-email
//
// Invoked by an AFTER INSERT trigger on `notifications` (via pg_net). Re-fetches
// the notification + recipient profile + match context using the service role,
// renders the email via templates.ts, and POSTs to the Resend API. Stamps
// `email_sent_at` on the notification row only after Resend returns 2xx.
//
// Optional local/test mode: set EMAIL_DELIVERY_MODE=log-only to log the outbound
// email instead of calling Resend. In that mode the function does not stamp
// email_sent_at because no delivery actually occurred.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeRequiredEnv } from "../_shared/env.ts";
import { parseEmailDeliveryMode } from "./delivery-mode.ts";
import { render, type EmailableType } from "./templates.ts";
import { signUnsubscribeToken } from "./unsubscribe-token.ts";

const EMAILABLE_TYPES: EmailableType[] = [
  "match_proposed",
  "match_confirmed",
  "match_cancelled",
  "match_declined",
];

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  email_sent_at: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string;
  email_prefs: Record<string, boolean> | null;
}

interface MatchContextRow {
  id: string;
  date: string;
  start_time: string;
  court_group_id: string;
}

function whenLabel(date: string, startTime: string): string {
  // date: "YYYY-MM-DD", startTime: "HH:MM:SS" — render as "Mon DD at H:MM AM/PM"
  const [y, m, d] = date.split("-").map((p) => parseInt(p, 10));
  const [hh, mm] = startTime.split(":").map((p) => parseInt(p, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getUTCMonth()];
  const hour12 = ((hh + 11) % 12) + 1;
  const ampm = hh < 12 ? "AM" : "PM";
  const mmStr = mm.toString().padStart(2, "0");
  return `${month} ${dt.getUTCDate()} at ${hour12}:${mmStr} ${ampm}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const triggerSecret = normalizeRequiredEnv(
    Deno.env.get("EMAIL_TRIGGER_SECRET"),
  );
  if (!triggerSecret) {
    console.error("Missing EMAIL_TRIGGER_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }
  const provided = req.headers.get("X-Trigger-Secret") ?? "";
  if (provided !== triggerSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabaseUrl = normalizeRequiredEnv(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = normalizeRequiredEnv(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const notificationId = body.notification_id;
  if (!notificationId || typeof notificationId !== "string") {
    return new Response("notification_id required", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Re-fetch the notification with service role (avoids trusting trigger payload).
  const { data: notification, error: nErr } = await supabase
    .from("notifications")
    .select("id,user_id,type,title,body,data,email_sent_at")
    .eq("id", notificationId)
    .maybeSingle<NotificationRow>();

  if (nErr) {
    console.error("Failed to load notification", nErr);
    return new Response("DB error", { status: 500 });
  }
  if (!notification) {
    return new Response("Notification not found", { status: 404 });
  }
  if (notification.email_sent_at) {
    return new Response("Already sent", { status: 200 });
  }
  if (!EMAILABLE_TYPES.includes(notification.type as EmailableType)) {
    return new Response("Type not emailable", { status: 200 });
  }
  const type = notification.type as EmailableType;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id,display_name,email_prefs")
    .eq("id", notification.user_id)
    .maybeSingle<ProfileRow>();

  if (pErr) {
    console.error("Failed to load profile", pErr);
    return new Response("DB error", { status: 500 });
  }
  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const prefEnabled = profile.email_prefs ? profile.email_prefs[type] !== false : true;
  if (!prefEnabled) {
    // Respect the opt-out. We do NOT stamp email_sent_at so the row remains a
    // truthful record of "no email was sent" — but we return 200 because this
    // is a normal outcome, not an error.
    return new Response("Recipient opted out of this type", { status: 200 });
  }

  // Look up the recipient's auth email.
  const { data: authUser, error: aErr } = await supabase.auth.admin.getUserById(
    notification.user_id,
  );
  if (aErr || !authUser?.user?.email) {
    console.error("Failed to load auth user email", aErr);
    return new Response("Recipient has no email", { status: 200 });
  }
  const toEmail = authUser.user.email;

  // Optional: pull match context for richer rendering.
  let whenLbl: string | null = null;
  let opponentName: string | null = null;
  let courtGroupName: string | null = null;
  const matchId = (notification.data as { match_id?: string } | null)?.match_id;

  if (matchId) {
    const { data: match } = await supabase
      .from("matches")
      .select("id,date,start_time,court_group_id")
      .eq("id", matchId)
      .maybeSingle<MatchContextRow>();

    if (match) {
      whenLbl = whenLabel(match.date, match.start_time);

      const [{ data: opp }, { data: cg }] = await Promise.all([
        supabase
          .from("match_players")
          .select("player_id, profiles:player_id(display_name)")
          .eq("match_id", matchId)
          .neq("player_id", notification.user_id)
          .limit(1)
          .maybeSingle<{ profiles: { display_name: string } | null }>(),
        supabase
          .from("court_groups")
          .select("name")
          .eq("id", match.court_group_id)
          .maybeSingle<{ name: string }>(),
      ]);
      opponentName = opp?.profiles?.display_name ?? null;
      courtGroupName = cg?.name ?? null;
    }
  }

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const rendered = render(type, {
    recipientName: profile.display_name,
    appUrl,
    whenLabel: whenLbl,
    opponentName,
    courtGroupName,
  });

  // RFC 8058 / RFC 2369 List-Unsubscribe headers — clients like Gmail surface a
  // native unsubscribe button, and the HTTPS endpoint enforces POST-only so
  // crawler/scanner GETs cannot trigger an unsubscribe.
  const unsubSecret = normalizeRequiredEnv(
    Deno.env.get("UNSUBSCRIBE_SECRET"),
  );
  if (!unsubSecret) {
    console.error("Missing UNSUBSCRIBE_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }
  const token = await signUnsubscribeToken(notification.user_id, type, unsubSecret);
  // Edge functions live under SUPABASE_URL, not APP_URL.
  const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
  const fromAddr = Deno.env.get("RESEND_FROM") ?? "Matchmaker <noreply@localhost>";
  // Best-effort mailto: parse domain from RESEND_FROM if present.
  const fromDomainMatch = fromAddr.match(/@([^>\s]+)/);
  const mailtoDomain = fromDomainMatch ? fromDomainMatch[1] : "localhost";
  const mailtoUnsub = `mailto:unsubscribe@${mailtoDomain}?subject=unsubscribe-${encodeURIComponent(token)}`;

  const deliveryMode = parseEmailDeliveryMode(
    Deno.env.get("EMAIL_DELIVERY_MODE"),
  );
  if (!deliveryMode) {
    console.error("Invalid EMAIL_DELIVERY_MODE");
    return new Response("Server misconfigured", { status: 500 });
  }

  if (deliveryMode === "log-only") {
    console.log(
      "[send-notification-email] LOG-ONLY",
      JSON.stringify(
        {
          to: toEmail,
          subject: rendered.subject,
          text: rendered.text,
        },
        null,
        2,
      ),
    );
    return new Response(JSON.stringify({ status: "logged", to: toEmail }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resendKey = normalizeRequiredEnv(Deno.env.get("RESEND_API_KEY"));
  if (!resendKey) {
    console.error("Missing RESEND_API_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [toEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        "List-Unsubscribe": `<${mailtoUnsub}>, <${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend API error", resendRes.status, errText);
    return new Response(`Resend error: ${resendRes.status}`, { status: 502 });
  }

  await supabase
    .from("notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", notification.id);

  return new Response(JSON.stringify({ status: "sent", to: toEmail }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

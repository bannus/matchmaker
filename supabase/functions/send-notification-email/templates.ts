// Email templates for match-related notifications.
//
// Each render function returns { subject, html, text }. Templates are
// intentionally simple: a greeting, one paragraph of context, a primary CTA
// button to /matches, and a footer that points to /profile (and is the body
// fallback for clients that don't surface List-Unsubscribe).

export type EmailableType =
  | "match_proposed"
  | "match_confirmed"
  | "match_cancelled"
  | "match_declined";

export interface RenderContext {
  recipientName: string;
  appUrl: string;
  // Plain text describing the slot, e.g. "Apr 26 at 10:00 AM".
  whenLabel: string | null;
  // Opponent's display name, when known.
  opponentName: string | null;
  courtGroupName: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

function footer(appUrl: string): string {
  const prefsUrl = `${appUrl}/profile`;
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
<p style="color:#6b7280;font-size:12px;line-height:1.5;">
  You're receiving this because you opted in to email notifications.
  <a href="${escapeHtml(prefsUrl)}" style="color:#6b7280;">Manage email preferences</a>.
</p>`;
}

function footerText(appUrl: string): string {
  return `\n--\nYou're receiving this because you opted in to email notifications.\nManage email preferences: ${appUrl}/profile`;
}

function describeMatch(ctx: RenderContext): { html: string; text: string } {
  const bits: string[] = [];
  if (ctx.opponentName) bits.push(`with <strong>${escapeHtml(ctx.opponentName)}</strong>`);
  if (ctx.whenLabel) bits.push(`on <strong>${escapeHtml(ctx.whenLabel)}</strong>`);
  if (ctx.courtGroupName) bits.push(`at <strong>${escapeHtml(ctx.courtGroupName)}</strong>`);
  const html = bits.length ? bits.join(" ") : "for an upcoming slot";

  const tBits: string[] = [];
  if (ctx.opponentName) tBits.push(`with ${ctx.opponentName}`);
  if (ctx.whenLabel) tBits.push(`on ${ctx.whenLabel}`);
  if (ctx.courtGroupName) tBits.push(`at ${ctx.courtGroupName}`);
  const text = tBits.length ? tBits.join(" ") : "for an upcoming slot";

  return { html, text };
}

export function render(type: EmailableType, ctx: RenderContext): RenderedEmail {
  const matchesUrl = `${ctx.appUrl}/matches`;
  const greetName = escapeHtml(ctx.recipientName || "there");
  const desc = describeMatch(ctx);

  switch (type) {
    case "match_proposed": {
      const subject = "New tennis match proposed 🎾";
      const html = `<p>Hi ${greetName},</p>
<p>You have a new match proposal ${desc.html}. Take a look and let your opponent know if it works for you.</p>
${ctaButton(matchesUrl, "Review match")}
${footer(ctx.appUrl)}`;
      const text = `Hi ${ctx.recipientName || "there"},\n\nYou have a new match proposal ${desc.text}. Review it here: ${matchesUrl}${footerText(ctx.appUrl)}`;
      return { subject, html, text };
    }
    case "match_confirmed": {
      const subject = "Match confirmed 🎾";
      const html = `<p>Hi ${greetName},</p>
<p>Your match ${desc.html} is confirmed. Add it to your calendar from the matches page so you don't miss it.</p>
${ctaButton(matchesUrl, "View match")}
${footer(ctx.appUrl)}`;
      const text = `Hi ${ctx.recipientName || "there"},\n\nYour match ${desc.text} is confirmed. View it here: ${matchesUrl}${footerText(ctx.appUrl)}`;
      return { subject, html, text };
    }
    case "match_cancelled": {
      const subject = "Match cancelled";
      const html = `<p>Hi ${greetName},</p>
<p>Heads up — your match ${desc.html} was cancelled. Your availability has been re-opened, so you may match again automatically. You can also post a new slot any time.</p>
${ctaButton(matchesUrl, "Find another match")}
${footer(ctx.appUrl)}`;
      const text = `Hi ${ctx.recipientName || "there"},\n\nYour match ${desc.text} was cancelled. Find another match: ${matchesUrl}${footerText(ctx.appUrl)}`;
      return { subject, html, text };
    }
    case "match_declined": {
      const subject = "Opponent declined the match";
      const html = `<p>Hi ${greetName},</p>
<p>Your opponent declined the proposed match ${desc.html}. No worries — your availability is open again and we'll keep looking.</p>
${ctaButton(matchesUrl, "Post new availability")}
${footer(ctx.appUrl)}`;
      const text = `Hi ${ctx.recipientName || "there"},\n\nYour opponent declined the proposed match ${desc.text}. Post new availability: ${matchesUrl}${footerText(ctx.appUrl)}`;
      return { subject, html, text };
    }
  }
}

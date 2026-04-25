// HMAC-signed tokens for List-Unsubscribe links.
//
// Token format (URL-safe base64url): "<payload>.<sig>"
//   payload = base64url(JSON({ uid, type, iat }))
//   sig     = base64url(HMAC-SHA256(payload, UNSUBSCRIBE_SECRET))
//
// Tokens never expire (RFC 8058 unsubscribe links must keep working in old
// emails) but encode user_id so they cannot be replayed across accounts.

const encoder = new TextEncoder();

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type UnsubType =
  | "match_proposed"
  | "match_confirmed"
  | "match_cancelled"
  | "match_declined";

interface TokenPayload {
  uid: string;
  type: UnsubType;
  iat: number;
}

export async function signUnsubscribeToken(
  userId: string,
  type: UnsubType,
  secret: string,
): Promise<string> {
  const payload: TokenPayload = { uid: userId, type, iat: Math.floor(Date.now() / 1000) };
  const payloadB64 = bytesToB64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64)),
  );
  return `${payloadB64}.${bytesToB64Url(sig)}`;
}

export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<TokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  let sigBytes: Uint8Array;
  try {
    sigBytes = b64UrlToBytes(sigB64);
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    encoder.encode(payloadB64),
  );
  if (!ok) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as TokenPayload).uid !== "string" ||
    typeof (parsed as TokenPayload).type !== "string" ||
    typeof (parsed as TokenPayload).iat !== "number"
  ) {
    return null;
  }
  const p = parsed as TokenPayload;
  const validTypes: UnsubType[] = [
    "match_proposed",
    "match_confirmed",
    "match_cancelled",
    "match_declined",
  ];
  if (!validTypes.includes(p.type)) return null;
  return p;
}

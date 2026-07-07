// Single-user auth: correct password -> signed session cookie.
// Edge-safe (Web Crypto only) because the middleware runs on the edge runtime.

export const SESSION_COOKIE = "newsdash_session";

const SESSION_MESSAGE = "newsdash-session-v1";

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionTokenForPassword(password: string): Promise<string> {
  return hmacHex(password, SESSION_MESSAGE);
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password || !token) return false;
  const expected = await sessionTokenForPassword(password);
  // constant-time-ish compare; token lengths are fixed
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

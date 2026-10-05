import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const COOKIE = "chorus_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const LOGIN_USER = "Hitkarini";
export const LOGIN_PASS = "Hitkarini@123";

async function sign(value: string): Promise<string> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Sign-in is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, "");
}

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  setCookie(COOKIE, `${exp}.${await sign(exp)}`, {
    httpOnly: true,
    secure: true,
    // The editor preview loads the app inside an iframe on another site;
    // "none" + partitioned lets the cookie work there as well as directly.
    sameSite: "none",
    partitioned: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function endSession() {
  deleteCookie(COOKIE, { path: "/", secure: true, sameSite: "none", partitioned: true });
}

export async function hasSession(): Promise<boolean> {
  const raw = getCookie(COOKIE);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  return (await sign(exp)) === sig;
}

export async function requireSession() {
  if (!(await hasSession())) throw new Error("Please sign in again.");
}

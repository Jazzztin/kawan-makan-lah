import { env } from "cloudflare:workers";
import { SELLER_EMAIL } from "./seller-config";

const COOKIE_NAME = "__Host-kml_seller";
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

type SessionPayload = {
  v: 1;
  email: string;
  expiresAt: number;
};

type SellerSecrets = {
  SELLER_PASSWORD?: string;
  SELLER_SESSION_SECRET?: string;
};

function secrets(): SellerSecrets {
  return env as typeof env & SellerSecrets;
}

export function passwordAuthConfigured(): boolean {
  const bindings = secrets();
  return Boolean(bindings.SELLER_PASSWORD && bindings.SELLER_SESSION_SECRET);
}

export async function verifySellerPassword(candidate: string): Promise<boolean> {
  const expected = secrets().SELLER_PASSWORD;
  if (!expected || candidate.length > 256) return false;

  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return constantTimeEqual(
    new Uint8Array(candidateHash),
    new Uint8Array(expectedHash),
  );
}

export async function createSellerSessionToken(): Promise<string> {
  const payload: SessionPayload = {
    v: 1,
    email: SELLER_EMAIL,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encodedPayload = base64UrlEncode(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function sellerEmailFromCookie(
  cookieHeader: string | null,
): Promise<string | null> {
  const token = readCookie(cookieHeader, COOKIE_NAME);
  if (!token) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  let signature: Uint8Array;
  let payload: unknown;
  try {
    signature = base64UrlDecode(encodedSignature);
    payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    );
  } catch {
    return null;
  }

  const key = await signingKey(["verify"]);
  if (!key) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(encodedPayload),
  );
  if (!valid || !isSessionPayload(payload)) return null;
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  if (payload.email.toLowerCase() !== SELLER_EMAIL) return null;
  return payload.email;
}

export function sellerSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSellerSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

async function sign(value: string): Promise<Uint8Array> {
  const key = await signingKey(["sign"]);
  if (!key) throw new Error("Seller session secret is unavailable");
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return new Uint8Array(signature);
}

async function signingKey(
  usages: KeyUsage[],
): Promise<CryptoKey | null> {
  const secret = secrets().SELLER_SESSION_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SessionPayload>;
  return (
    payload.v === 1 &&
    typeof payload.email === "string" &&
    typeof payload.expiresAt === "number" &&
    Number.isSafeInteger(payload.expiresAt)
  );
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return null;
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}


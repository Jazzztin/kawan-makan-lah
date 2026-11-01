import { ApiError } from "./http";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type LoginAttempt = {
  attempts: number;
  window_started: number;
  blocked_until: number;
};

export async function sellerLoginKey(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip.slice(0, 128)),
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireLoginAttemptAllowed(
  db: D1Database,
  key: string,
): Promise<void> {
  const row = await db
    .prepare(
      "SELECT attempts, window_started, blocked_until FROM seller_login_attempts WHERE key = ?",
    )
    .bind(key)
    .first<LoginAttempt>();
  if (row && row.blocked_until > Date.now()) {
    throw new ApiError(
      "TOO_MANY_LOGIN_ATTEMPTS",
      "Too many attempts. Wait 15 minutes and try again.",
      429,
    );
  }
}

export async function recordFailedSellerLogin(
  db: D1Database,
  key: string,
): Promise<void> {
  const now = Date.now();
  const staleBefore = now - WINDOW_MS;
  await db
    .prepare(
      `INSERT INTO seller_login_attempts (key, attempts, window_started, blocked_until)
       VALUES (?, 1, ?, 0)
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE WHEN window_started < ? THEN 1 ELSE attempts + 1 END,
         window_started = CASE WHEN window_started < ? THEN excluded.window_started ELSE window_started END,
         blocked_until = CASE
           WHEN window_started < ? THEN 0
           WHEN attempts + 1 >= ? THEN ?
           ELSE blocked_until
         END`,
    )
    .bind(
      key,
      now,
      staleBefore,
      staleBefore,
      staleBefore,
      MAX_ATTEMPTS,
      now + WINDOW_MS,
    )
    .run();
}

export async function clearSellerLoginAttempts(
  db: D1Database,
  key: string,
): Promise<void> {
  await db.prepare("DELETE FROM seller_login_attempts WHERE key = ?").bind(key).run();
}


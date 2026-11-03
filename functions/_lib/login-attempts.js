export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCK_SECONDS = 15 * 60;

export async function getLoginLock(db, email, now = Math.floor(Date.now() / 1000)) {
  const row = await db.prepare(
    "SELECT failed_attempts, locked_until FROM login_attempts WHERE email = ? LIMIT 1"
  ).bind(email).first();
  const lockedUntil = Number(row?.locked_until || 0);
  return { locked: lockedUntil > now, lockedUntil, failedAttempts: Number(row?.failed_attempts || 0) };
}

export async function recordLoginFailure(db, email, now = Math.floor(Date.now() / 1000)) {
  await db.prepare(`
    INSERT INTO login_attempts (email, failed_attempts, locked_until, updated_at)
    VALUES (?, 1, 0, ?)
    ON CONFLICT(email) DO UPDATE SET
      failed_attempts = CASE
        WHEN login_attempts.locked_until > excluded.updated_at THEN login_attempts.failed_attempts
        WHEN login_attempts.locked_until > 0 THEN 1
        ELSE login_attempts.failed_attempts + 1
      END,
      locked_until = CASE
        WHEN login_attempts.locked_until > excluded.updated_at THEN login_attempts.locked_until
        WHEN login_attempts.locked_until > 0 THEN 0
        WHEN login_attempts.failed_attempts + 1 >= ${LOGIN_FAILURE_LIMIT} THEN excluded.updated_at + ${LOGIN_LOCK_SECONDS}
        ELSE 0
      END,
      updated_at = excluded.updated_at
  `).bind(email, now).run();
}

export async function clearLoginFailures(db, email) {
  await db.prepare("DELETE FROM login_attempts WHERE email = ?").bind(email).run();
}

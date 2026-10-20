import { Router } from "express";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "../lib/db.js";
import {
  clearLocalSessionCookie,
  getSessionToken,
  hashSessionToken,
  LOCAL_SESSION_SECONDS,
  resolveLocalSession,
  setLocalSessionCookie,
} from "../lib/localAuth.js";

const router = Router();
const scrypt = promisify(scryptCallback);
const SCRYPT_COST = 16384;
const failedLogins = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;

function loginRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = failedLogins.get(key);
  if (current?.resetAt <= now) failedLogins.delete(key);
  if (failedLogins.get(key)?.count >= MAX_FAILED_LOGINS) {
    return res.status(429).json({ message: "Too many sign-in attempts. Wait 15 minutes and try again." });
  }
  return next();
}

function recordFailedLogin(key) {
  const current = failedLogins.get(key);
  if (!current || current.resetAt <= Date.now()) {
    failedLogins.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
  } else {
    current.count += 1;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role || "patient",
    fullName: user.full_name || user.email.split("@")[0],
    user_metadata: { full_name: user.full_name || "" },
    app_metadata: {},
  };
}

async function makePasswordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: SCRYPT_COST, r: 8, p: 1 });
  return `scrypt$${SCRYPT_COST}$8$1$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltHex, hashHex] = String(encoded || "").split("$");
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  if (
    algorithm !== "scrypt"
    || cost !== SCRYPT_COST
    || blockSize !== 8
    || parallelization !== 1
    || !/^[\da-f]{32}$/i.test(saltHex || "")
    || !/^(?:[\da-f]{2}){64}$/i.test(hashHex || "")
  ) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: cost, r: blockSize, p: parallelization,
  }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function startSession(user, res) {
  const token = randomBytes(32).toString("base64url");
  await db.createLocalSession({
    tokenHash: hashSessionToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + LOCAL_SESSION_SECONDS * 1000).toISOString(),
  });
  setLocalSessionCookie(res, token);
  return publicUser(user);
}

router.post("/register", async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({ message: "Enter your name (2–120 characters)." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address to use as your login ID." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "Use a password between 8 and 128 characters." });
    }
    if (await db.getLocalUserByEmail(email)) {
      return res.status(409).json({ message: "An account with this email already exists. Sign in instead." });
    }
    const passwordHash = await makePasswordHash(password);
    const user = await db.createLocalUser({ email, fullName, passwordHash });
    if (!user) return res.status(409).json({ message: "An account with this email already exists. Sign in instead." });
    return res.status(201).json({ user: await startSession(user, res) });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const rateKey = req.ip || req.socket.remoteAddress || "unknown";
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await db.getLocalUserByEmail(email);
    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!valid) {
      recordFailedLogin(rateKey);
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    failedLogins.delete(rateKey);
    return res.json({ user: await startSession(user, res) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const session = await resolveLocalSession(req);
    const user = session ? await db.getLocalUserById(session.user.id) : null;
    if (!user) {
      clearLocalSessionCookie(res);
      return res.status(401).json({ message: "Sign in to continue." });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) await db.deleteLocalSession(hashSessionToken(token));
    clearLocalSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;

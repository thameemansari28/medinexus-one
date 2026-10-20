import { createHash } from "node:crypto";
import { db } from "./db.js";

export const LOCAL_SESSION_COOKIE = "medinexus_session";
export const LOCAL_SESSION_SECONDS = 60 * 60 * 24 * 14;

export function hashSessionToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function getSessionToken(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === LOCAL_SESSION_COOKIE) {
      try { return decodeURIComponent(value.join("=")); } catch { return ""; }
    }
  }
  return "";
}

export async function resolveLocalSession(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const result = await db.getLocalSession(hashSessionToken(token));
  if (!result) return null;
  const { user } = result;
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role || "patient",
      fullName: user.full_name || user.email.split("@")[0],
      userMetadata: { full_name: user.full_name || "" },
      appMetadata: {},
    },
  };
}

export function setLocalSessionCookie(res, token) {
  res.cookie(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCAL_SESSION_SECONDS * 1000,
    path: "/",
  });
}

export function clearLocalSessionCookie(res) {
  res.clearCookie(LOCAL_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * MediNexus One - Authentication Middleware
 * 
 * Verifies Supabase Auth JWT tokens using Supabase Auth endpoint.
 * Injects req.user, req.token, and req.role.
 */

import { globalSupabase, isSupabaseLive, db } from "../lib/db.js";
import { resolveLocalSession } from "../lib/localAuth.js";

export async function requireAuth(req, res, next) {
  try {
    const localSession = await resolveLocalSession(req);
    if (localSession) {
      req.user = localSession.user;
      req.token = localSession.token;
      req.role = localSession.user.role;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Missing or invalid Authorization header. Provide a valid Bearer token.",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Bearer token cannot be empty.",
      });
    }

    req.token = token;

    // Verify token with Supabase Auth
    if (globalSupabase && isSupabaseLive) {
      const { data, error } = await globalSupabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({
          error: "Invalid session",
          message: error?.message || "User session has expired or is invalid. Please sign in again.",
        });
      }

      const user = data.user;
      const profile = await db.getProfile(user.id);

      req.user = {
        id: user.id,
        email: user.email,
        role: profile?.role || user.app_metadata?.role || user.user_metadata?.role || "patient",
        fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0],
        userMetadata: user.user_metadata || {},
        appMetadata: user.app_metadata || {},
      };

      return next();
    }

    return res.status(503).json({
      error: "Authentication required",
      message: "Your local sign-in session is missing or expired. Please sign in again.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Authentication error",
      message: err.message,
    });
  }
}

/**
 * Optional Auth Middleware: If Bearer token is present, resolves user; otherwise leaves req.user = null.
 */
export async function optionalAuth(req, res, next) {
  const localSession = await resolveLocalSession(req);
  if (localSession) {
    req.user = localSession.user;
    req.token = localSession.token;
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    req.token = null;
    return next();
  }

  const token = authHeader.slice(7).trim();
  req.token = token;

  if (globalSupabase && isSupabaseLive) {
    try {
      const { data } = await globalSupabase.auth.getUser(token);
      if (data?.user) {
        const user = data.user;
        const profile = await db.getProfile(user.id);
        req.user = {
          id: user.id,
          email: user.email,
          role: profile?.role || user.app_metadata?.role || user.user_metadata?.role || "patient",
          fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0],
        };
      }
    } catch {
      req.user = null;
    }
  }

  return next();
}
